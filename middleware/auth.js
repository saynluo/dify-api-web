const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: '未提供认证token' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.username = decoded.username;
        req.userEmail = decoded.email;
        
        console.log('认证中间件 - 解析的JWT数据:', {
            userId: decoded.userId,
            username: decoded.username,
            email: decoded.email
        });
        
        next();
    } catch (error) {
        console.error('JWT验证失败:', error.message);
        res.status(401).json({ error: 'token无效' });
    }
};

module.exports = authMiddleware;