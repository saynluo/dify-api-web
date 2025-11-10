# 🤖 AI智能助手 - Dify API Web应用

<div align="center">

![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0-brightgreen.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

**现代化、功能完整的AI对话Web应用**

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [文档](#-文档) • [部署](#-部署) • [贡献](#-贡献)

</div>

---

## 📖 项目简介

基于 **Dify API** 使用 **claude code** 构建的现代化AI对话Web应用，采用蓝白科技风格设计，提供流畅的AI对话体验。支持用户认证、积分系统、对话管理、文件上传等完整功能。

### 🎯 核心亮点

- 💎 **完整的积分系统** - 签到、邀请、消费积分全流程
- 🎨 **现代化UI设计** - 蓝白科技风格，流畅动画效果
- 💬 **流式对话体验** - 实时响应，思考过程可视化
- 📱 **管理后台** - 用户管理、对话管理、积分管理
- 🔐 **安全可靠** - JWT认证、密码加密、XSS防护

---

## ✨ 功能特性

### 💎 积分系统 (v2.1.0 新增)

<table>
<tr>
<td width="50%">

#### 积分显示
- ✅ 侧边栏积分条
- ✅ 输入框积分徽章（可点击）
- ✅ 实时积分更新
- ✅ 积分不足自动警告

</td>
<td width="50%">

#### 获取积分
- ✅ 每日签到 (+1~3)
- ✅ 邀请好友 (+5)
- ✅ 新用户注册 (+10)
- ✅ 积分历史记录

</td>
</tr>
</table>

#### 积分规则

| 操作 | 积分变化 | 说明 |
|------|----------|------|
| 🎁 新用户注册 | **+10** | 初始赠送积分 |
| 📅 每日签到 | **+1~3** | 连续签到奖励递增（3天+2分，7天+3分） |
| 👥 邀请好友 | **+5** | 邀请人和被邀请人各得5积分 |
| 💬 AI对话 | **-1** | 每次对话消耗1积分 |

### 💬 智能对话

- ✅ **实时流式响应** - Server-Sent Events (SSE) 实现
- ✅ **思考过程展示** - 显示AI思考步骤
- ✅ **Markdown渲染** - 支持代码高亮、表格等
- ✅ **上下文管理** - 智能对话历史管理
- ✅ **多媒体支持** - 图片、音频上传

### 🔐 用户系统

- ✅ **注册/登录** - 支持用户名或邮箱登录
- ✅ **JWT认证** - 安全的令牌认证机制
- ✅ **密码加密** - Bcrypt 10轮哈希加密
- ✅ **会话管理** - 24小时自动登录
- ✅ **邀请码系统** - 支持邀请好友注册

### 📱 管理后台

- ✅ **用户管理** - 查看、搜索、删除用户
- ✅ **对话管理** - 查看用户对话内容
- ✅ **积分管理** - 手动调整用户积分
- ✅ **数据概览** - 系统统计信息

访问地址: http://localhost:3000/admin.html

### 🎨 界面特色

- ✅ **现代化设计** - 蓝白科技风格
- ✅ **响应式布局** - 完美适配移动端
- ✅ **流畅动画** - 0.3s ease过渡效果
- ✅ **毛玻璃效果** - backdrop-filter实现
- ✅ **自定义Logo** - 支持品牌定制

---

## 🚀 快速开始

### 📋 环境要求

- **Node.js** >= 16.0
- **npm** >= 7.0 或 **yarn** >= 1.22
- **Dify API Key** - 从 [Dify平台](https://dify.ai) 获取

### 📦 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/saynluo/dify-api-web.git
cd dify-api-web
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

复制环境变量模板并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写必需配置：

```env
# Dify API 配置（必需）
DIFY_API_KEY=your-dify-api-key
DIFY_BASE_URL=https://api.dify.ai/v1

# 服务器配置
PORT=3000
NODE_ENV=production

# JWT密钥（必需，建议使用强密码）
JWT_SECRET=your-super-secret-jwt-key-change-this

# 会话密钥（必需）
SESSION_SECRET=your-session-secret-key-change-this

# 管理员初始化密钥（首次创建管理员使用）
ADMIN_INIT_KEY=your-admin-init-key-change-this

# 数据库和上传目录
DATABASE_PATH=./database.sqlite
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

#### 4. 启动服务

```bash
# 生产环境
npm start

# 开发环境（自动重启）
npm run dev
```

#### 5. 访问应用

- **用户端**: http://localhost:3000
- **管理后台**: http://localhost:3000/admin.html

---

## 📁 项目结构

```
dify-api-web/
├── public/                      # 前端静态文件
│   ├── index.html              # 主页面
│   ├── admin.html              # 管理后台页面
│   ├── app.js                  # 主应用逻辑
│   ├── admin.js                # 管理后台逻辑
│   ├── points.js               # 积分系统逻辑
│   ├── styles.css              # 主样式文件
│   ├── points-styles.css       # 积分样式
│   ├── logo.png                # AI助手Logo
│   └── pandalink.png           # 品牌Logo
├── middleware/                  # Express中间件
│   └── auth.js                 # JWT认证中间件
├── services/                    # 业务服务层
│   └── difyService.js          # Dify API服务
├── uploads/                     # 文件上传目录（运行时生成）
├── server.js                   # Express服务器主程序
├── package.json                # 项目依赖配置
├── .env.example                # 环境变量模板
├── .gitignore                  # Git忽略配置
├── README.md                   # 项目说明（本文件）
├── CHANGELOG.md                # 更新日志
├── POINTS_SYSTEM_GUIDE.md     # 积分系统指南
└── POINTS_DEBUG.md             # 调试指南
```

---

## 🎯 使用指南

### 👤 用户操作

#### 注册账号
1. 点击右下角"登录"按钮
2. 切换到"注册"标签
3. 填写用户名、邮箱、密码
4. 可选填入邀请码（获得额外5积分）
5. 点击注册，自动登录并获得10积分

#### 开始对话
1. 登录后在输入框输入消息
2. 点击发送或按 Enter 键
3. AI会实时流式响应
4. 每次对话消耗1积分

#### 获取积分
1. **每日签到**: 点击积分徽章 → 立即签到 (+1~3分)
2. **邀请好友**: 点击积分徽章 → 获取邀请码 → 分享给好友 (+5分)
3. 积分不足时会有红色警告提示

### 👨‍💼 管理员操作

#### 创建管理员账号
```bash
# 首次创建需要 ADMIN_INIT_KEY
POST /api/admin/create
{
  "username": "admin",
  "password": "your-password",
  "initKey": "your-admin-init-key"
}
```

#### 登录管理后台
1. 访问 http://localhost:3000/admin.html
2. 输入管理员账号密码
3. 查看数据概览、管理用户、查看对话、调整积分

---

## 🔧 配置说明

### Dify API配置

1. **注册Dify账号**: 访问 [https://dify.ai](https://dify.ai)
2. **创建应用**: 在Dify控制台创建AI应用
3. **获取API Key**: 复制应用的API密钥
4. **配置环境变量**: 将API Key填入 `.env` 文件的 `DIFY_API_KEY`

### 自定义Logo

#### Logo文件位置
- `public/logo.png` - AI助手头像
- `public/pandalink.png` - 品牌Logo

#### Logo要求
- **格式**: PNG（推荐透明背景）
- **尺寸**: 256x256px 或更高
- **设计**: 圆形或方形均可（系统自动适配）

#### Logo显示位置
- 欢迎页面的AI图标
- 对话消息中的AI头像
- 开场白中的AI头像

### 安全配置建议

```env
# 使用强密码（32位以上随机字符）
JWT_SECRET=your-very-long-random-string-here-at-least-32-chars
SESSION_SECRET=another-very-long-random-string-for-session

# 生产环境建议
NODE_ENV=production
PORT=3000
```

---

## 🚢 部署指南

### 本地部署

```bash
npm install
npm start
```

### PM2部署（推荐生产环境）

```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name "dify-api-web"

# 查看状态
pm2 status

# 查看日志
pm2 logs dify-api-web

# 设置开机自启
pm2 startup
pm2 save
```

### Docker部署

```bash
# 构建镜像
docker build -t dify-api-web .

# 运行容器
docker run -d \
  --name dify-api-web \
  -p 3000:3000 \
  -e DIFY_API_KEY=your-api-key \
  -e JWT_SECRET=your-jwt-secret \
  -v $(pwd)/database.sqlite:/app/database.sqlite \
  -v $(pwd)/uploads:/app/uploads \
  dify-api-web

# 查看日志
docker logs -f dify-api-web
```

### Nginx反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📚 文档

- [更新日志 (CHANGELOG.md)](CHANGELOG.md) - 版本更新记录
- [积分系统指南 (POINTS_SYSTEM_GUIDE.md)](POINTS_SYSTEM_GUIDE.md) - 完整的积分系统功能说明
- [调试指南 (POINTS_DEBUG.md)](POINTS_DEBUG.md) - 问题排查和调试步骤

---

## 🔐 安全特性

### 认证安全
- ✅ **JWT令牌认证** - 无状态认证机制
- ✅ **Bcrypt加密** - 密码哈希存储（10轮）
- ✅ **Token过期控制** - 24小时自动过期

### 数据安全
- ✅ **SQL注入防护** - 参数化查询
- ✅ **XSS防护** - DOMPurify内容净化
- ✅ **CSRF防护** - 同源策略验证
- ✅ **文件类型验证** - Multer文件过滤

### 隐私保护
- ✅ **.gitignore配置** - 敏感文件不上传
- ✅ **环境变量隔离** - 密钥分离存储
- ✅ **日志脱敏** - 敏感信息不记录

---

## 🛠️ 开发指南

### 开发环境启动

```bash
# 安装依赖
npm install

# 启动开发服务器（nodemon自动重启）
npm run dev
```

### API端点

#### 认证API
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

#### 对话API
- `GET /api/conversations` - 获取对话列表
- `POST /api/conversations` - 创建新对话
- `GET /api/conversations/:id` - 获取对话详情
- `POST /api/conversations/:id/messages` - 发送消息（SSE流式）
- `DELETE /api/conversations/:id` - 删除对话

#### 积分API
- `GET /api/points` - 获取积分信息
- `POST /api/points/checkin` - 每日签到
- `POST /api/points/invite` - 生成邀请码
- `GET /api/points/transactions` - 积分历史

#### 文件API
- `POST /api/files/upload` - 上传文件
- `GET /api/files` - 获取文件列表

#### 管理API
- `POST /api/admin/login` - 管理员登录
- `GET /api/admin/stats` - 系统统计
- `GET /api/admin/users` - 用户列表
- `DELETE /api/admin/users/:id` - 删除用户
- `POST /api/admin/users/:id/points` - 调整积分

### 数据库结构

项目使用SQLite作为数据库，自动创建以下表：

- `users` - 用户账户
- `conversations` - 对话会话
- `messages` - 聊天消息
- `files` - 上传文件
- `user_points` - 用户积分
- `point_transactions` - 积分交易记录
- `message_feedbacks` - 消息反馈
- `admins` - 管理员账户

---

## 🐛 问题排查

### 常见问题

<details>
<summary><b>Q1: 启动时提示端口被占用？</b></summary>

**解决方案**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <进程ID> /F

# Linux/Mac
lsof -i :3000
kill -9 <进程ID>

# 或修改.env中的PORT配置
PORT=3001
```
</details>

<details>
<summary><b>Q2: 积分显示不出来？</b></summary>

**解决方案**:
1. 打开浏览器开发者工具（F12）
2. 查看Console是否有错误
3. 检查Network请求 `/api/points` 是否返回200
4. 确认已登录账号
5. 清除浏览器缓存并硬刷新（Ctrl+F5）

详见: [POINTS_DEBUG.md](POINTS_DEBUG.md)
</details>

<details>
<summary><b>Q3: Dify API调用失败？</b></summary>

**解决方案**:
1. 检查 `.env` 中的 `DIFY_API_KEY` 是否正确
2. 确认 `DIFY_BASE_URL` 配置正确
3. 验证Dify应用是否已发布
4. 检查网络连接和防火墙设置
</details>

<details>
<summary><b>Q4: 数据库文件损坏？</b></summary>

**解决方案**:
```bash
# 备份旧数据库
mv database.sqlite database.sqlite.backup

# 重启应用，自动创建新数据库
npm start
```
</details>

---

## 📊 性能指标

- ⚡ **首屏加载** < 1s
- 🚀 **API响应** < 100ms
- 💬 **流式对话** 实时响应
- 📱 **移动端适配** 完美支持

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

### 贡献流程

1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交Pull Request

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` Bug修复
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构
- `perf:` 性能优化
- `test:` 测试相关
- `chore:` 构建/工具相关

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

---

## 🙏 致谢

- [Dify](https://dify.ai) - 强大的AI应用开发平台
- [Express](https://expressjs.com/) - Web应用框架
- [SQLite](https://www.sqlite.org/) - 轻量级数据库
- 所有贡献者和用户的支持

---

## 📞 联系方式

- **GitHub**: https://github.com/saynluo/dify-api-web
- **Issues**: https://github.com/saynluo/dify-api-web/issues

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给个Star支持一下！**

Made with ❤️ by [saynluo](https://github.com/saynluo)

</div>
