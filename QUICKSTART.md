# 🚀 快速使用指南

## 启动应用

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件,填写以下必需配置:
# - DIFY_API_KEY: Dify API密钥
# - DIFY_BASE_URL: Dify API地址
# - JWT_SECRET: JWT密钥
# - ADMIN_INIT_KEY: 管理员初始化密钥

# 3. 启动服务
npm start
```

## 用户端使用

访问: `http://localhost:3000`

### 注册/登录
1. 点击侧边栏底部的"登录"按钮
2. 切换到"注册"标签
3. 填写用户名、邮箱、密码(可选填邀请码)
4. 注册成功后自动登录,获得10个初始积分

### 获取积分
1. **每日签到**: 点击侧边栏的积分显示 → 点击"立即签到"
2. **邀请好友**: 点击"获取邀请码" → 复制邀请码分享给好友

### 开始对话
1. 点击"新建对话"按钮
2. 在输入框输入消息 (每次消耗1积分)
3. 查看AI回复

### 查看积分
- 侧边栏底部显示当前积分
- 点击 💎 图标旁的ℹ️按钮打开积分管理中心
- 查看积分明细和交易记录

## 管理员使用

访问: `http://localhost:3000/admin.html`

### 首次使用 - 创建管理员账户

使用API工具(如Postman)或命令行:

```bash
curl -X POST http://localhost:3000/api/admin/init \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "email": "admin@example.com",
    "initKey": "在.env中设置的ADMIN_INIT_KEY"
  }'
```

### 登录后台
1. 输入管理员用户名和密码
2. 登录成功后进入管理后台

### 管理功能
- **数据概览**: 查看系统统计数据
- **用户管理**: 查看/搜索用户,查看用户详情
- **调整积分**: 点击用户列表中的"调整积分"按钮
- **查看对话**: 点击用户详情中的对话记录

## 常见问题

### Q: 积分不足怎么办?
A: 可以通过每日签到或邀请好友获取积分,或联系管理员手动增加

### Q: 忘记管理员密码?
A: 需要直接操作数据库重置密码,或重新创建管理员账户

### Q: 如何修改积分消耗规则?
A: 编辑 [server.js:782](server.js#L782) 的 `pointsCost` 变量

### Q: 如何调整签到奖励?
A: 编辑 [server.js:1509](server.js#L1509) 的 `checkinReward` 变量

## 文件结构

```
网页/
├── server.js                # 后端主文件 (包含所有API)
├── public/
│   ├── index.html          # 用户界面
│   ├── app.js              # 用户端JavaScript
│   ├── points.js           # 积分系统JavaScript
│   ├── styles.css          # 主样式文件
│   ├── points-styles.css   # 积分系统样式
│   ├── admin.html          # 管理后台界面
│   └── admin.js            # 管理后台JavaScript
├── .env                    # 环境变量配置
└── database.sqlite         # SQLite数据库

## 技术支持

如有问题,请查看:
- [UPDATE.md](UPDATE.md) - 详细功能说明
- [README-FOR-AI.md](README-FOR-AI.md) - 完整技术文档
- [application.md](application.md) - 应用说明文档

---
祝使用愉快! 🎉
```
