const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const difyService = require('./services/difyService');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// 创建必要的目录
const uploadsDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 初始化数据库
const db = new sqlite3.Database(process.env.DATABASE_PATH || './database.sqlite');

// 创建数据表
db.serialize(() => {
    // 用户表
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // 对话表
    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            dify_conversation_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);
    
    // 消息表
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            thinking_content TEXT,
            metadata TEXT,
            dify_message_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        )
    `);
    
    // 为已存在的表添加新字段（如果不存在）
    db.run(`ALTER TABLE messages ADD COLUMN dify_message_id TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            
        }
    });
    
    // 反馈表
    db.run(`
        CREATE TABLE IF NOT EXISTS message_feedbacks (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            dify_message_id TEXT,
            conversation_id TEXT,
            user_id TEXT NOT NULL,
            rating TEXT CHECK (rating IN ('like', 'dislike')),
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (message_id) REFERENCES messages (id),
            FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        )
    `);
    
    // 文件表
    db.run(`
        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            path TEXT NOT NULL,
            dify_file_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // 积分表
    db.run(`
        CREATE TABLE IF NOT EXISTS user_points (
            id TEXT PRIMARY KEY,
            user_id TEXT UNIQUE NOT NULL,
            points INTEGER DEFAULT 10,
            total_earned INTEGER DEFAULT 10,
            total_spent INTEGER DEFAULT 0,
            last_checkin_date DATE,
            checkin_streak INTEGER DEFAULT 0,
            invited_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // 积分历史记录表
    db.run(`
        CREATE TABLE IF NOT EXISTS point_transactions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'admin')),
            amount INTEGER NOT NULL,
            reason TEXT NOT NULL,
            related_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // 邀请记录表
    db.run(`
        CREATE TABLE IF NOT EXISTS invitations (
            id TEXT PRIMARY KEY,
            inviter_id TEXT NOT NULL,
            invitee_id TEXT,
            invite_code TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (inviter_id) REFERENCES users (id),
            FOREIGN KEY (invitee_id) REFERENCES users (id)
        )
    `);

    // 管理员表
    db.run(`
        CREATE TABLE IF NOT EXISTS admins (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 为users表添加积分字段（兼容旧数据）
    db.run(`ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 10`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.log('用户表积分字段已存在或创建失败');
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN invite_code TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.log('用户表邀请码字段已存在或创建失败');
        }
    });
});

// 中间件配置
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
}));

// 静态文件服务
app.use('/uploads', express.static(uploadsDir));
app.use(express.static('public'));

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname);
        const filename = uuidv4() + fileExtension;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        // 支持的文件类型
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp3|mp4|mpeg|mpga|m4a|wav|webm/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'));
        }
    }
});

// API路由

// 获取应用配置
app.get('/api/config', (req, res) => {
    res.json({
        // 只提供前端需要的非敏感配置信息
        features: {
            registration: true,
            fileUpload: true
        },
        apiVersion: '1.0.0',
        dify: {
            baseUrl: process.env.DIFY_BASE_URL,
            hasApiKey: !!process.env.DIFY_API_KEY, // 只告诉前端是否配置了API Key
            apiKey: process.env.DIFY_API_KEY // 为了前端能直接使用，暂时提供API Key
        }
    });
});

// 获取应用参数 - 直接对接Dify API
app.get('/api/parameters', async (req, res) => {
    try {
        // 检查是否配置了Dify API
        if (!process.env.DIFY_API_KEY || !process.env.DIFY_BASE_URL) {
            return res.status(500).json({ 
                error: 'Dify API未配置，请检查环境变量' 
            });
        }

        // 调用Dify API获取应用参数
        const difyService = require('./services/difyService');
        const parameters = await difyService.getApplicationParameters();
        
        if (parameters) {
            console.log('成功获取应用参数:', {
                hasOpeningStatement: !!parameters.opening_statement,
                suggestedQuestionsCount: parameters.suggested_questions?.length || 0,
                hasFileUpload: !!parameters.file_upload,
                hasSpeechToText: !!parameters.speech_to_text
            });
            
            res.json(parameters);
        } else {
            res.status(500).json({ 
                error: '无法获取应用参数' 
            });
        }
    } catch (error) {
        console.error('获取应用参数错误:', error);
        res.status(500).json({ 
            error: '获取应用参数失败: ' + error.message 
        });
    }
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, inviteCode } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: '请填写所有必填字段' });
        }

        // 验证用户名和邮箱格式
        if (username.length < 3) {
            return res.status(400).json({ error: '用户名至少需要3个字符' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: '密码至少需要6个字符' });
        }

        // 使用Promise包装数据库操作
        const checkUser = new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, user) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(user);
                }
            });
        });

        const existingUser = await checkUser;

        if (existingUser) {
            return res.status(400).json({
                error: existingUser.username === username ? '用户名已存在' : '邮箱已存在'
            });
        }

        // 验证邀请码（如果提供）
        let inviterId = null;
        if (inviteCode) {
            const inviter = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM users WHERE invite_code = ?', [inviteCode], (err, user) => {
                    if (err) reject(err);
                    else resolve(user);
                });
            });

            if (inviter) {
                inviterId = inviter.id;
            }
        }

        // 创建新用户
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        const userInviteCode = uuidv4().substring(0, 8).toUpperCase(); // 生成8位邀请码

        const createUser = new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (id, username, email, password, invite_code) VALUES (?, ?, ?, ?, ?)',
                [userId, username, email, hashedPassword, userInviteCode],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this);
                    }
                }
            );
        });

        await createUser;

        // 初始化积分（新用户10积分）
        const pointsId = uuidv4();
        const initialPoints = 10;
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO user_points (id, user_id, points, total_earned, invited_by) VALUES (?, ?, ?, ?, ?)',
                [pointsId, userId, initialPoints, initialPoints, inviterId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this);
                }
            );
        });

        // 记录积分获取
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO point_transactions (id, user_id, type, amount, reason) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), userId, 'earn', initialPoints, '新用户注册奖励'],
                function(err) {
                    if (err) reject(err);
                    else resolve(this);
                }
            );
        });

        // 如果使用了邀请码，给邀请人奖励积分
        if (inviterId) {
            const inviteReward = 5;
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE user_points SET points = points + ?, total_earned = total_earned + ? WHERE user_id = ?',
                    [inviteReward, inviteReward, inviterId],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this);
                    }
                );
            });

            // 记录邀请人获得积分
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO point_transactions (id, user_id, type, amount, reason, related_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [uuidv4(), inviterId, 'earn', inviteReward, '邀请新用户奖励', userId],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this);
                    }
                );
            });

            // 更新邀请记录
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE invitations SET invitee_id = ?, status = ?, completed_at = CURRENT_TIMESTAMP WHERE invite_code = ?',
                    [userId, 'completed', inviteCode],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this);
                    }
                );
            });
        }

        // 生成JWT token
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: '服务器配置错误' });
        }

        const token = jwt.sign({ userId, username, email }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.json({
            success: true,
            token,
            user: {
                id: userId,
                username,
                email,
                points: initialPoints,
                inviteCode: userInviteCode
            }
        });

    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: `服务器错误: ${error.message}` });
    }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        
        
        if (!username || !password) {
            return res.status(400).json({ error: '请填写用户名和密码' });
        }
        
        // 使用Promise包装数据库操作
        const findUser = new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], (err, user) => {
                if (err) {
                    
                    reject(err);
                } else {
                    resolve(user);
                }
            });
        });
        
        const user = await findUser;
        
        if (!user) {
            
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        // 生成JWT token
        if (!process.env.JWT_SECRET) {
            
            return res.status(500).json({ error: '服务器配置错误' });
        }
        
        const token = jwt.sign({ userId: user.id, username: user.username, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        
        
        res.json({
            success: true,
            token,
            user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar }
        });
        
    } catch (error) {
        
        res.status(500).json({ error: `服务器错误: ${error.message}` });
    }
});

// 获取用户信息
app.get('/api/auth/me', authMiddleware, (req, res) => {
    db.get('SELECT id, username, email, avatar FROM users WHERE id = ?', [req.userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: '数据库错误' });
        }
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json(user);
    });
});

// 获取对话列表（增强版，支持从 Dify 获取）
app.get('/api/conversations', authMiddleware, async (req, res) => {
    const { limit = 20, offset = 0, use_dify = 'auto' } = req.query;
    
    try {
        // 如果指定使用 Dify API 或者自动检测到有 Dify 配置
        if (use_dify === 'true' || (use_dify === 'auto' && process.env.DIFY_API_KEY)) {
            
            const userEmail = req.userEmail || req.userId;
            const difyConversations = await difyService.getConversations(userEmail, parseInt(limit));
            
            // 转换 Dify 格式为我们的格式，并同步到本地数据库
            const conversations = [];
            
            for (const difyConv of difyConversations.data) {
                // 检查本地是否已存在此对话
                const localConv = await new Promise((resolve, reject) => {
                    db.get('SELECT * FROM conversations WHERE dify_conversation_id = ? AND user_id = ?', 
                           [difyConv.id, req.userId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                
                if (!localConv) {
                    // 如果本地不存在，创建新记录
                    const newId = uuidv4();
                    await new Promise((resolve, reject) => {
                        db.run('INSERT INTO conversations (id, user_id, title, dify_conversation_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                               [newId, req.userId, difyConv.name || '未命名对话', difyConv.id, 
                                new Date(difyConv.created_at * 1000).toISOString(),
                                new Date(difyConv.updated_at * 1000).toISOString()], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    conversations.push({
                        id: newId,
                        title: difyConv.name || '未命名对话',
                        dify_conversation_id: difyConv.id,
                        created_at: new Date(difyConv.created_at * 1000).toISOString(),
                        updated_at: new Date(difyConv.updated_at * 1000).toISOString()
                    });
                } else {
                    // 更新本地记录
                    await new Promise((resolve, reject) => {
                        db.run('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
                               [difyConv.name || localConv.title, new Date(difyConv.updated_at * 1000).toISOString(), localConv.id], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    conversations.push({
                        ...localConv,
                        title: difyConv.name || localConv.title,
                        updated_at: new Date(difyConv.updated_at * 1000).toISOString()
                    });
                }
            }
            
            res.json({
                conversations,
                hasMore: difyConversations.has_more
            });
        } else {
            // 从本地数据库获取（原有逻辑）
            db.all(
                `SELECT c.*, 
                        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
                 FROM conversations c 
                 WHERE c.user_id = ? 
                 ORDER BY c.updated_at DESC 
                 LIMIT ? OFFSET ?`,
                [req.userId, parseInt(limit), parseInt(offset)],
                (err, conversations) => {
                    if (err) {
                        return res.status(500).json({ error: '数据库错误' });
                    }
                    
                    res.json({
                        conversations,
                        hasMore: conversations.length === parseInt(limit)
                    });
                }
            );
        }
    } catch (error) {
        
        // 回退到本地数据库
        db.all(
            `SELECT c.*, 
                    (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                    (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
             FROM conversations c 
             WHERE c.user_id = ? 
             ORDER BY c.updated_at DESC 
             LIMIT ? OFFSET ?`,
            [req.userId, parseInt(limit), parseInt(offset)],
            (err, conversations) => {
                if (err) {
                    return res.status(500).json({ error: '数据库错误' });
                }
                
                res.json({
                    conversations,
                    hasMore: conversations.length === parseInt(limit)
                });
            }
        );
    }
});

// 创建新对话
app.post('/api/conversations', authMiddleware, (req, res) => {
    const { title = '新的对话' } = req.body;
    const conversationId = uuidv4();
    
    db.run(
        'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)',
        [conversationId, req.userId, title],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '创建对话失败' });
            }
            
            res.json({
                id: conversationId,
                title,
                created_at: new Date().toISOString()
            });
        }
    );
});

// 获取对话详情
app.get('/api/conversations/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    // 先获取对话信息
    db.get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [id, req.userId], async (err, conversation) => {
        if (err) {
            return res.status(500).json({ error: '数据库错误' });
        }
        
        if (!conversation) {
            return res.status(404).json({ error: '对话不存在' });
        }
        
        try {
            // 如果有 dify_conversation_id，从 Dify 获取历史消息
            if (conversation.dify_conversation_id) {
                
                const difyMessages = await difyService.getMessages(
                    conversation.dify_conversation_id, 
                    req.userEmail || req.userId, 
                    parseInt(limit)
                );
                
                // 转换 Dify 消息格式为我们的格式
                const sortedMessages = [];
                difyMessages.data.forEach(msg => {
                    // 添加用户消息
                    if (msg.query) {
                        sortedMessages.push({
                            id: msg.id + '_user',
                            conversation_id: id,
                            role: 'user',
                            content: msg.query,
                            created_at: new Date(msg.created_at * 1000).toISOString()
                        });
                    }
                    // 添加助手消息
                    sortedMessages.push({
                        id: msg.id,
                        conversation_id: id,
                        role: 'assistant',
                        content: msg.answer,
                        metadata: JSON.stringify({
                            dify_message_id: msg.id,
                            agent_thoughts: msg.agent_thoughts
                        }),
                        created_at: new Date(msg.created_at * 1000).toISOString()
                    });
                });
                
                res.json({
                    conversation,
                    messages: sortedMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                });
            } else {
                // 从本地数据库获取消息（向后兼容）
                db.all(
                    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
                    [id, parseInt(limit), parseInt(offset)],
                    (err, messages) => {
                        if (err) {
                            return res.status(500).json({ error: '数据库错误' });
                        }
                        
                        res.json({
                            conversation,
                            messages: messages.map(msg => ({
                                ...msg,
                                metadata: msg.metadata ? JSON.parse(msg.metadata) : null
                            }))
                        });
                    }
                );
            }
        } catch (error) {
            
            // 如果 Dify API 调用失败，回退到本地数据库
            db.all(
                'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
                [id, parseInt(limit), parseInt(offset)],
                (err, messages) => {
                    if (err) {
                        return res.status(500).json({ error: '数据库错误' });
                    }
                    
                    res.json({
                        conversation,
                        messages: messages.map(msg => ({
                            ...msg,
                            metadata: msg.metadata ? JSON.parse(msg.metadata) : null
                        }))
                    });
                }
            );
        }
    });
});

// 发送消息
app.post('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { content, files = [] } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: '消息内容不能为空' });
        }

        // 检查用户积分是否足够 (每次对话消耗1积分)
        const pointsCost = 1;
        const userPoints = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM user_points WHERE user_id = ?', [req.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!userPoints || userPoints.points < pointsCost) {
            return res.status(402).json({
                error: '积分不足',
                message: '您的积分不足，请通过签到或邀请好友获取积分',
                currentPoints: userPoints ? userPoints.points : 0,
                required: pointsCost
            });
        }

        // 扣除积分
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE user_points SET points = points - ?, total_spent = total_spent + ? WHERE user_id = ?',
                [pointsCost, pointsCost, req.userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 记录积分消耗
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO point_transactions (id, user_id, type, amount, reason, related_id) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), req.userId, 'spend', -pointsCost, 'AI对话消耗', id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 验证对话所有权
        db.get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [id, req.userId], async (err, conversation) => {
            if (err) {
                return res.status(500).json({ error: '数据库错误' });
            }
            
            if (!conversation) {
                return res.status(404).json({ error: '对话不存在' });
            }
            
            // 保存用户消息
            const userMessageId = uuidv4();
            db.run(
                'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)',
                [userMessageId, id, 'user', content],
                async function(err) {
                    if (err) {
                        return res.status(500).json({ error: '保存消息失败' });
                    }
                    
                    // 设置流式响应头
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Cache-Control'
                    });
                    
                    try {
                        // 调用Dify API
                        const assistantMessageId = uuidv4();
                        let fullResponse = '';
                        let thinkingContent = '';
                        let metadata = {};
                        
                        
                        
                        
                        
                        
                        let userEmail = req.userEmail;
                        
                        // 如果JWT中没有邮箱信息，从数据库查询
                        if (!userEmail) {
                            
                            const user = await new Promise((resolve, reject) => {
                                db.get('SELECT email FROM users WHERE id = ?', [req.userId], (err, row) => {
                                    if (err) reject(err);
                                    else resolve(row);
                                });
                            });
                            
                            if (user && user.email) {
                                userEmail = user.email;
                                
                            } else {
                                
                                return res.status(400).json({ error: '用户信息不完整，请重新登录' });
                            }
                        }
                        
                        await difyService.sendMessage({
                            query: content,
                            conversation_id: conversation.dify_conversation_id,
                            user: userEmail,
                            files: files
                        }, (chunk) => {
                            // 处理不同类型的流式事件
                            if (chunk.event === 'message' || chunk.event === 'agent_message') {
                                if (chunk.answer) {
                                    // 分离思考内容和回答内容（向后兼容）
                                    const { answer, thinking } = difyService.separateThinking(chunk.answer);
                                    fullResponse += answer;
                                    thinkingContent += thinking;
                                }
                                
                                // 保存message_id用于后续操作
                                if (chunk.message_id) {
                                    assistantMessageDifyId = chunk.message_id;
                                }
                                
                                // 更新对话ID
                                if (chunk.conversation_id && !conversation.dify_conversation_id) {
                                    db.run(
                                        'UPDATE conversations SET dify_conversation_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                        [chunk.conversation_id, id]
                                    );
                                    conversation.dify_conversation_id = chunk.conversation_id;
                                }
                            } else if (chunk.event === 'agent_thought') {
                                // 处理 Agent 思考过程
                                if (chunk.thought) {
                                    const processedThought = chunk.thought.replace(/<\/?think>/g, '').trim();
                                    thinkingContent += processedThought + '\n';
                                }
                            } else if (chunk.event === 'message_end') {
                                // 保存完整的助手消息，包括dify_message_id
                                metadata = chunk.metadata || {};
                                
                                db.run(
                                    'INSERT INTO messages (id, conversation_id, role, content, thinking_content, metadata, dify_message_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                    [assistantMessageId, id, 'assistant', fullResponse, thinkingContent.trim(), JSON.stringify(metadata), assistantMessageDifyId]
                                );
                                
                                // 更新对话时间
                                db.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
                                
                                // 添加本地消息ID到事件数据中
                                chunk.local_message_id = assistantMessageId;
                            }
                            
                            // 发送给前端（所有事件）
                            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                            
                            // 如果是结束事件，关闭连接
                            if (chunk.event === 'message_end' || chunk.event === 'error') {
                                res.end();
                            }
                        });
                        
                    } catch (apiError) {
                        
                        res.write(`data: ${JSON.stringify({
                            event: 'error',
                            message: apiError.message
                        })}\n\n`);
                        res.end();
                    }
                }
            );
        });
        
    } catch (error) {
        
        res.status(500).json({ error: '服务器错误' });
    }
});

// 删除对话
app.delete('/api/conversations/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [id, req.userId], (err, conversation) => {
        if (err) {
            return res.status(500).json({ error: '数据库错误' });
        }
        
        if (!conversation) {
            return res.status(404).json({ error: '对话不存在' });
        }
        
        // 删除对话和相关消息
        db.serialize(async () => {
            try {
                // 如果有 dify_conversation_id，先删除 Dify 端的对话
                if (conversation.dify_conversation_id) {
                    
                    const userEmail = req.userEmail || req.userId;
                    await difyService.deleteConversation(conversation.dify_conversation_id, userEmail);
                }
            } catch (error) {
                
            }
            
            // 删除本地数据库记录
            db.run('DELETE FROM messages WHERE conversation_id = ?', [id]);
            db.run('DELETE FROM conversations WHERE id = ?', [id], function(err) {
                if (err) {
                    return res.status(500).json({ error: '删除对话失败' });
                }
                
                res.json({ success: true });
            });
        });
    });
});

// 重命名对话
app.put('/api/conversations/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    
    if (!title || title.trim() === '') {
        return res.status(400).json({ error: '标题不能为空' });
    }
    
    db.run(
        'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [title.trim(), id, req.userId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '数据库错误' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: '对话不存在' });
            }
            
            res.json({ success: true });
        }
    );
});

// Dify API: 重命名对话（直接调用Dify API）
app.post('/api/conversations/:id/name', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, auto_generate = false } = req.body;
        const userEmail = req.userEmail || req.userId;
        
        // 先获取对话信息
        const conversation = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [id, req.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!conversation || !conversation.dify_conversation_id) {
            return res.status(404).json({ error: '对话不存在或未关联Dify对话' });
        }
        
        // 调用Dify API重命名
        const result = await difyService.renameConversation(
            conversation.dify_conversation_id, 
            name, 
            userEmail, 
            auto_generate
        );
        
        // 同步更新本地数据库
        if (result.name) {
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [result.name, id],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
        
        res.json(result);
    } catch (error) {
        
        res.status(500).json({ error: error.message });
    }
});

// Dify API: 获取对话变量
app.get('/api/conversations/:id/variables', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 20, last_id, variable_name } = req.query;
        const userEmail = req.userEmail || req.userId;
        
        // 先获取对话信息
        const conversation = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [id, req.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!conversation || !conversation.dify_conversation_id) {
            return res.status(404).json({ error: '对话不存在或未关联Dify对话' });
        }
        
        // 调用Dify API获取对话变量
        const result = await difyService.getConversationVariables(
            conversation.dify_conversation_id,
            userEmail,
            parseInt(limit),
            last_id,
            variable_name
        );
        
        res.json(result);
    } catch (error) {
        
        res.status(500).json({ error: error.message });
    }
});

// Dify API: 获取对话历史消息（分页）
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 20, first_id } = req.query;
        const userEmail = req.userEmail || req.userId;
        
        // 先获取对话信息
        const conversation = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [id, req.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!conversation) {
            return res.status(404).json({ error: '对话不存在' });
        }
        
        if (conversation.dify_conversation_id) {
            // 从Dify获取历史消息
            const result = await difyService.getMessages(
                conversation.dify_conversation_id,
                userEmail,
                parseInt(limit)
            );
            res.json(result);
        } else {
            // 从本地数据库获取
            const messages = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?',
                    [id, parseInt(limit)],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
            
            res.json({
                limit: parseInt(limit),
                has_more: messages.length === parseInt(limit),
                data: messages.map(msg => ({
                    ...msg,
                    metadata: msg.metadata ? JSON.parse(msg.metadata) : null
                }))
            });
        }
    } catch (error) {
        
        res.status(500).json({ error: error.message });
    }
});

// 文件上传
app.post('/api/files/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请选择文件' });
        }
        
        // 上传到Dify
        const difyFileId = await difyService.uploadFile(req.file.path, req.file.originalname, req.userId);
        
        // 保存文件信息到数据库
        const fileId = uuidv4();
        db.run(
            'INSERT INTO files (id, user_id, filename, original_name, mime_type, size, path, dify_file_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [fileId, req.userId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.file.path, difyFileId],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: '保存文件信息失败' });
                }
                
                res.json({
                    id: fileId,
                    dify_file_id: difyFileId,
                    filename: req.file.filename,
                    original_name: req.file.originalname,
                    mime_type: req.file.mimetype,
                    size: req.file.size,
                    url: `/uploads/${req.file.filename}`
                });
            }
        );
        
    } catch (error) {
        
        res.status(500).json({ error: error.message });
    }
});

// 获取用户文件列表
app.get('/api/files', authMiddleware, (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    
    db.all(
        'SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [req.userId, parseInt(limit), parseInt(offset)],
        (err, files) => {
            if (err) {
                return res.status(500).json({ error: '数据库错误' });
            }
            
            res.json({
                files: files.map(file => ({
                    ...file,
                    url: `/uploads/${file.filename}`
                })),
                hasMore: files.length === parseInt(limit)
            });
        }
    );
});

// 获取应用信息
app.get('/api/app/info', (req, res) => {
    difyService.getAppInfo()
        .then(info => res.json(info))
        .catch(error => res.status(500).json({ error: error.message }));
});

// 获取应用参数
app.get('/api/app/parameters', (req, res) => {
    const userId = req.headers.authorization ? 'temp-user' : 'anonymous';
    
    difyService.getAppParameters(userId)
        .then(params => res.json(params))
        .catch(error => res.status(500).json({ error: error.message }));
});

// 语音转文字
app.post('/api/audio/transcribe', authMiddleware, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请选择音频文件' });
        }
        
        const result = await difyService.audioToText(req.file.path, req.userId);
        
        // 删除临时文件
        fs.unlinkSync(req.file.path);
        
        res.json(result);
        
    } catch (error) {
        
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});

// 文字转语音
app.post('/api/audio/synthesize', authMiddleware, async (req, res) => {
    try {
        const { text, message_id } = req.body;
        
        if (!text && !message_id) {
            return res.status(400).json({ error: '请提供文本或消息ID' });
        }
        
        const audioStream = await difyService.textToAudio(text, message_id, req.userId);
        
        res.setHeader('Content-Type', 'audio/wav');
        audioStream.pipe(res);
        
    } catch (error) {
        
        res.status(500).json({ error: error.message });
    }
});

// 提供主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 处理favicon请求
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // 返回空响应，避免404错误
});

// 消息反馈API
// 提交消息反馈
app.post('/api/messages/:messageId/feedbacks', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { rating, content } = req.body;
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ error: '用户未认证' });
        }

        // 验证rating值
        if (rating && !['like', 'dislike'].includes(rating)) {
            return res.status(400).json({ error: '无效的评分值' });
        }

        // 查找消息信息
        const message = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM messages WHERE id = ?',
                [messageId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!message) {
            return res.status(404).json({ error: '消息不存在' });
        }

        // 检查是否已存在反馈
        const existingFeedback = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM message_feedbacks WHERE message_id = ? AND user_id = ?',
                [messageId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        const feedbackId = existingFeedback ? existingFeedback.id : uuidv4();
        const now = new Date().toISOString();

        if (existingFeedback) {
            // 更新现有反馈
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE message_feedbacks SET rating = ?, content = ?, updated_at = ? WHERE id = ?',
                    [rating, content || null, now, feedbackId],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this);
                    }
                );
            });
        } else {
            // 创建新反馈
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO message_feedbacks (id, message_id, dify_message_id, conversation_id, user_id, rating, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [feedbackId, messageId, message.dify_message_id, message.conversation_id, userId, rating, content || null, now, now],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this);
                    }
                );
            });
        }

        // 如果有Dify message ID，也向Dify API提交反馈
        if (message.dify_message_id && rating) {
            try {
                const userEmail = req.userEmail || req.userId;
                await difyService.submitMessageFeedback(message.dify_message_id, {
                    rating: rating,
                    user: userEmail,
                    content: content || ''
                });
            } catch (difyError) {
                // Dify反馈失败不影响本地反馈的成功
            }
        }

        res.json({
            result: 'success',
            feedback: {
                id: feedbackId,
                message_id: messageId,
                rating: rating,
                content: content || null,
                created_at: existingFeedback ? existingFeedback.created_at : now,
                updated_at: now
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取消息反馈
app.get('/api/messages/:messageId/feedbacks', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.userId;

        const feedback = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM message_feedbacks WHERE message_id = ? AND user_id = ?',
                [messageId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        res.json({
            feedback: feedback || null
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取应用反馈列表 (管理员功能)
app.get('/api/app/feedbacks', authMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const feedbacks = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    f.*,
                    u.username,
                    u.email,
                    c.title as conversation_title,
                    m.content as message_content
                FROM message_feedbacks f
                LEFT JOIN users u ON f.user_id = u.id
                LEFT JOIN conversations c ON f.conversation_id = c.id
                LEFT JOIN messages m ON f.message_id = m.id
                ORDER BY f.created_at DESC
                LIMIT ? OFFSET ?
            `, [parseInt(limit), offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const totalCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM message_feedbacks', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        res.json({
            data: feedbacks.map(feedback => ({
                id: feedback.id,
                message_id: feedback.message_id,
                dify_message_id: feedback.dify_message_id,
                conversation_id: feedback.conversation_id,
                rating: feedback.rating,
                content: feedback.content,
                user: {
                    id: feedback.user_id,
                    username: feedback.username,
                    email: feedback.email
                },
                conversation_title: feedback.conversation_title,
                message_content: feedback.message_content,
                created_at: feedback.created_at,
                updated_at: feedback.updated_at
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                has_more: offset + feedbacks.length < totalCount
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 积分系统 API ====================

// 获取用户积分信息
app.get('/api/points', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId; // 修复：使用 req.userId

        const points = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM user_points WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!points) {
            // 如果用户没有积分记录，创建一个
            const pointsId = uuidv4();
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO user_points (id, user_id, points, total_earned) VALUES (?, ?, ?, ?)',
                    [pointsId, userId, 10, 10],
                    (err) => {
                        if (err) reject(err);
                        else resolve({ points: 10, total_earned: 10, total_spent: 0 });
                    }
                );
            });
            return res.json({ points: 10, total_earned: 10, total_spent: 0 });
        }

        res.json(points);
    } catch (error) {
        console.error('获取积分失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 签到获取积分
app.post('/api/points/checkin', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId; // 修复：使用 req.userId
        const today = new Date().toISOString().split('T')[0];

        const points = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM user_points WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!points) {
            return res.status(404).json({ error: '用户积分记录不存在' });
        }

        // 检查今天是否已签到
        if (points.last_checkin_date === today) {
            return res.status(400).json({ error: '今天已经签到过了', nextCheckin: tomorrow(today) });
        }

        // 计算连续签到奖励
        const yesterday = getYesterday(today);
        let newStreak = 1;
        let checkinReward = 1; // 基础签到奖励

        if (points.last_checkin_date === yesterday) {
            newStreak = (points.checkin_streak || 0) + 1;
            // 连续签到额外奖励
            if (newStreak >= 7) checkinReward = 3;
            else if (newStreak >= 3) checkinReward = 2;
        }

        // 更新积分和签到记录
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE user_points SET points = points + ?, total_earned = total_earned + ?, last_checkin_date = ?, checkin_streak = ? WHERE user_id = ?',
                [checkinReward, checkinReward, today, newStreak, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 记录积分交易
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO point_transactions (id, user_id, type, amount, reason) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), userId, 'earn', checkinReward, `每日签到奖励（连续${newStreak}天）`],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({
            success: true,
            reward: checkinReward,
            streak: newStreak,
            newTotal: points.points + checkinReward,
            nextCheckin: tomorrow(today)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 生成邀请码
app.post('/api/points/invite', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId; // 修复：使用 req.userId

        // 获取用户的邀请码
        let user = await new Promise((resolve, reject) => {
            db.get('SELECT invite_code FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 如果用户没有邀请码，自动生成一个
        if (!user.invite_code) {
            const newInviteCode = uuidv4().substring(0, 8).toUpperCase();

            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE users SET invite_code = ? WHERE id = ?',
                    [newInviteCode, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            user.invite_code = newInviteCode;
        }

        res.json({
            inviteCode: user.invite_code,
            inviteUrl: `${req.protocol}://${req.get('host')}/?invite=${user.invite_code}`
        });
    } catch (error) {
        console.error('获取邀请码失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取积分交易历史
app.get('/api/points/transactions', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId; // 修复：使用 req.userId
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const transactions = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
                [userId, limit, offset],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        const totalCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM point_transactions WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        res.json({
            data: transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                has_more: offset + transactions.length < totalCount
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 管理员系统 API ====================

// 创建管理员中间件
const adminMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: '未提供认证令牌' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 检查是否是管理员
        const admin = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM admins WHERE id = ?', [decoded.adminId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!admin) {
            return res.status(403).json({ error: '无管理员权限' });
        }

        req.admin = admin;
        next();
    } catch (error) {
        res.status(401).json({ error: '认证失败' });
    }
};

// 管理员登录
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const admin = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM admins WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!admin) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const validPassword = await bcrypt.compare(password, admin.password);
        if (!validPassword) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = jwt.sign(
            { adminId: admin.id, username: admin.username, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建默认管理员账户（首次使用）
app.post('/api/admin/init', async (req, res) => {
    try {
        const { username, password, email, initKey } = req.body;

        // 验证初始化密钥（从环境变量读取）
        if (initKey !== process.env.ADMIN_INIT_KEY) {
            return res.status(403).json({ error: '初始化密钥错误' });
        }

        // 检查是否已有管理员
        const existingAdmin = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM admins LIMIT 1', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existingAdmin) {
            return res.status(400).json({ error: '管理员账户已存在' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const adminId = uuidv4();

        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO admins (id, username, password, email, role) VALUES (?, ?, ?, ?, ?)',
                [adminId, username, hashedPassword, email, 'super_admin'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: '管理员账户创建成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取所有用户列表
app.get('/api/admin/users', adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT u.*, up.points, up.total_earned, up.total_spent, up.last_checkin_date
            FROM users u
            LEFT JOIN user_points up ON u.id = up.user_id
        `;
        let countQuery = 'SELECT COUNT(*) as count FROM users u';
        const params = [];

        if (search) {
            query += ' WHERE u.username LIKE ? OR u.email LIKE ?';
            countQuery += ' WHERE u.username LIKE ? OR u.email LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const users = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const totalCount = await new Promise((resolve, reject) => {
            db.get(countQuery, search ? [`%${search}%`, `%${search}%`] : [], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        res.json({
            data: users.map(u => ({
                ...u,
                password: undefined // 不返回密码
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                has_more: offset + users.length < totalCount
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取用户详细信息（包括对话记录）
app.get('/api/admin/users/:userId', adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await new Promise((resolve, reject) => {
            db.get(`
                SELECT u.*, up.points, up.total_earned, up.total_spent, up.last_checkin_date, up.checkin_streak
                FROM users u
                LEFT JOIN user_points up ON u.id = up.user_id
                WHERE u.id = ?
            `, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 获取对话列表
        const conversations = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        // 获取积分交易记录
        const transactions = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        res.json({
            user: { ...user, password: undefined },
            conversations,
            transactions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取用户的对话内容
app.get('/api/admin/conversations/:conversationId', adminMiddleware, async (req, res) => {
    try {
        const { conversationId } = req.params;

        const conversation = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM conversations WHERE id = ?', [conversationId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!conversation) {
            return res.status(404).json({ error: '对话不存在' });
        }

        const messages = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
                [conversationId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        res.json({
            conversation,
            messages
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 管理员调整用户积分
app.post('/api/admin/users/:userId/points', adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const { amount, reason } = req.body;

        if (!amount || amount === 0) {
            return res.status(400).json({ error: '积分数量不能为0' });
        }

        // 更新积分
        await new Promise((resolve, reject) => {
            const updateField = amount > 0 ? 'total_earned' : 'total_spent';
            db.run(
                `UPDATE user_points SET points = points + ?, ${updateField} = ${updateField} + ? WHERE user_id = ?`,
                [amount, Math.abs(amount), userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 记录交易
        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO point_transactions (id, user_id, type, amount, reason) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), userId, 'admin', amount, reason || '管理员调整'],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, message: '积分调整成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取系统统计数据
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
    try {
        const stats = {};

        // 总用户数
        stats.totalUsers = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // 总对话数
        stats.totalConversations = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM conversations', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // 总消息数
        stats.totalMessages = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM messages', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // 总积分消耗
        stats.totalPointsSpent = await new Promise((resolve, reject) => {
            db.get('SELECT SUM(total_spent) as total FROM user_points', (err, row) => {
                if (err) reject(err);
                else resolve(row.total || 0);
            });
        });

        // 今日新增用户
        stats.todayNewUsers = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = DATE("now")', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // 今日活跃用户（有消息的）
        stats.todayActiveUsers = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(DISTINCT user_id) as count
                FROM conversations c
                JOIN messages m ON c.id = m.conversation_id
                WHERE DATE(m.created_at) = DATE("now")
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        // 最近7天的用户增长数据
        stats.userGrowthData = await new Promise((resolve, reject) => {
            db.all(`
                SELECT
                    DATE(created_at) as date,
                    COUNT(*) as new_users
                FROM users
                WHERE DATE(created_at) >= DATE('now', '-6 days')
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 最近7天的对话活跃度数据
        stats.conversationActivityData = await new Promise((resolve, reject) => {
            db.all(`
                SELECT
                    DATE(c.created_at) as date,
                    COUNT(DISTINCT c.id) as conversation_count,
                    COUNT(m.id) as message_count
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id AND DATE(m.created_at) = DATE(c.created_at)
                WHERE DATE(c.created_at) >= DATE('now', '-6 days')
                GROUP BY DATE(c.created_at)
                ORDER BY date ASC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 用户消息和AI消息统计
        stats.messageTypeData = await new Promise((resolve, reject) => {
            db.all(`
                SELECT
                    role,
                    COUNT(*) as count
                FROM messages
                GROUP BY role
            `, (err, rows) => {
                if (err) reject(err);
                else {
                    const result = {
                        user: 0,
                        assistant: 0
                    };
                    rows.forEach(row => {
                        if (row.role === 'user') result.user = row.count;
                        else if (row.role === 'assistant') result.assistant = row.count;
                    });
                    resolve(result);
                }
            });
        });

        // 按用户活跃度分类的积分消耗分布
        stats.pointsDistributionData = await new Promise((resolve, reject) => {
            db.all(`
                SELECT
                    CASE
                        WHEN total_spent >= 1000 THEN '活跃用户'
                        WHEN total_spent >= 500 THEN '普通用户'
                        WHEN total_spent >= 100 THEN '新用户'
                        ELSE '休眠用户'
                    END as user_type,
                    COUNT(*) as count,
                    SUM(total_spent) as total_points
                FROM user_points
                GROUP BY user_type
            `, (err, rows) => {
                if (err) reject(err);
                else {
                    const result = {
                        '活跃用户': 0,
                        '普通用户': 0,
                        '新用户': 0,
                        '休眠用户': 0
                    };
                    rows.forEach(row => {
                        result[row.user_type] = row.count;
                    });
                    resolve(result);
                }
            });
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除用户
app.delete('/api/admin/users/:userId', adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;

        // 删除用户相关的所有数据
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        try {
            // 删除用户的积分记录
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM point_transactions WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_points WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 删除用户的反馈
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM message_feedbacks WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 删除用户的文件
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM files WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 获取用户的对话ID列表
            const conversations = await new Promise((resolve, reject) => {
                db.all('SELECT id FROM conversations WHERE user_id = ?', [userId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            // 删除对话中的消息
            for (const conv of conversations) {
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM messages WHERE conversation_id = ?', [conv.id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // 删除用户的对话
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM conversations WHERE user_id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 删除邀请记录
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM invitations WHERE inviter_id = ? OR invitee_id = ?', [userId, userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 最后删除用户
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 提交事务
            await new Promise((resolve, reject) => {
                db.run('COMMIT', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({ success: true, message: '用户删除成功' });
        } catch (error) {
            // 回滚事务
            await new Promise((resolve) => {
                db.run('ROLLBACK', () => resolve());
            });
            throw error;
        }
    } catch (error) {
        console.error('删除用户失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 辅助函数
function getYesterday(dateStr) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

function tomorrow(dateStr) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
}

// 错误处理中间件
app.use((error, req, res, next) => {
    
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: '文件过大' });
        }
    }
    
    res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
    
});

module.exports = app;