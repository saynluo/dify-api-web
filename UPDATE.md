# AI 智能助手 v2.1 - 功能更新说明

## 🎉 新增功能

### 1. 💎 积分系统

用户每次与AI对话消耗 **1个积分**。积分获取方式：

#### 获取积分途径

- **新用户注册**: 免费获得 10 积分
- **每日签到**: 获得 1-3 积分
  - 基础签到: 1 积分
  - 连续3天签到: 2 积分
  - 连续7天签到: 3 积分
- **邀请好友**: 好友成功注册后,双方各得 5 积分

#### 使用说明

1. 登录后,在侧边栏底部可以看到当前积分
2. 点击积分旁的 `ℹ️` 按钮打开积分管理中心
3. 在积分管理中心可以:
   - 查看积分概览 (当前/累计获得/累计消耗)
   - 每日签到获取积分
   - 生成邀请码邀请好友
   - 查看积分交易记录

### 2. 🛡️ 后台管理系统

访问 `/admin.html` 进入管理后台,功能包括:

#### 功能模块

1. **📊 数据概览**
   - 总用户数
   - 总对话数
   - 总消息数
   - 总积分消耗
   - 今日新增用户
   - 今日活跃用户

2. **👥 用户管理**
   - 查看所有用户列表
   - 搜索用户 (用户名/邮箱)
   - 查看用户详细信息
   - 查看用户对话记录
   - 调整用户积分 (增加/减少)

3. **💬 对话管理**
   - 查看用户的所有对话
   - 查看对话中的完整消息
   - 查看AI思考过程

4. **💎 积分管理**
   - 查看用户积分明细
   - 手动调整用户积分
   - 查看积分交易历史

#### 管理员账户创建

首次使用需要创建管理员账户:

```bash
# 1. 在 .env 文件中设置初始化密钥
ADMIN_INIT_KEY=your-secret-key-here

# 2. 使用 POST 请求创建管理员
curl -X POST http://localhost:3000/api/admin/init \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password",
    "email": "admin@example.com",
    "initKey": "your-secret-key-here"
  }'
```

或使用Postman/Thunder Client等工具发送请求。

### 3. 🎨 UI优化

- 移除了彩色渐变效果
- 统一为清爽的蓝白色调
- 保持专业简洁的视觉风格

## 📊 数据库结构

新增以下数据表:

### user_points (用户积分表)
```sql
- id: 主键
- user_id: 用户ID (唯一)
- points: 当前积分
- total_earned: 累计获得
- total_spent: 累计消耗
- last_checkin_date: 最后签到日期
- checkin_streak: 连续签到天数
- invited_by: 邀请人ID
```

### point_transactions (积分交易记录)
```sql
- id: 主键
- user_id: 用户ID
- type: 类型 (earn/spend/admin)
- amount: 积分数量
- reason: 原因说明
- related_id: 关联ID (如对话ID)
- created_at: 创建时间
```

### invitations (邀请记录)
```sql
- id: 主键
- inviter_id: 邀请人ID
- invitee_id: 被邀请人ID
- invite_code: 邀请码 (唯一)
- status: 状态 (pending/completed)
- created_at: 创建时间
- completed_at: 完成时间
```

### admins (管理员表)
```sql
- id: 主键
- username: 用户名 (唯一)
- password: 密码 (bcrypt加密)
- email: 邮箱 (唯一)
- role: 角色 (admin/super_admin)
- created_at: 创建时间
```

## 🔧 API 接口

### 积分系统 API

- `GET /api/points` - 获取用户积分信息
- `POST /api/points/checkin` - 每日签到
- `POST /api/points/invite` - 获取邀请码
- `GET /api/points/transactions` - 获取积分交易记录

### 管理员 API

- `POST /api/admin/login` - 管理员登录
- `POST /api/admin/init` - 初始化管理员账户
- `GET /api/admin/stats` - 获取系统统计数据
- `GET /api/admin/users` - 获取用户列表
- `GET /api/admin/users/:userId` - 获取用户详情
- `GET /api/admin/conversations/:id` - 获取对话内容
- `POST /api/admin/users/:userId/points` - 调整用户积分

## 🚀 部署说明

### 环境变量配置

在 `.env` 文件中添加:

```env
# 管理员初始化密钥 (首次创建管理员时使用)
ADMIN_INIT_KEY=your-admin-init-key-change-this
```

### 启动步骤

1. 安装依赖: `npm install`
2. 配置环境变量: 复制 `.env.example` 为 `.env` 并填写配置
3. 启动服务: `npm start`
4. 访问应用: `http://localhost:3000`
5. 访问后台: `http://localhost:3000/admin.html`

### 数据库迁移

项目启动时会自动创建所有必需的数据表。如果是从旧版本升级,数据库会自动添加新字段,不会影响现有数据。

## 📝 使用建议

### 积分策略调整

可以在 `server.js` 中调整积分相关参数:

```javascript
// 每次对话消耗积分 (第782行附近)
const pointsCost = 1;

// 新用户注册赠送积分 (第374行附近)
const initialPoints = 10;

// 邀请奖励积分 (第400行附近)
const inviteReward = 5;

// 签到奖励 (第1509行附近)
let checkinReward = 1;  // 基础
if (newStreak >= 7) checkinReward = 3;  // 连续7天
else if (newStreak >= 3) checkinReward = 2;  // 连续3天
```

### 安全建议

1. **修改默认密钥**: 务必修改 `.env` 中的所有密钥
2. **管理员密码**: 使用强密码,定期更换
3. **API限流**: 建议添加请求频率限制
4. **HTTPS**: 生产环境务必使用HTTPS
5. **备份数据**: 定期备份 `database.sqlite` 文件

## 🐛 故障排查

### 积分不足错误

如果用户遇到积分不足:
1. 检查 `user_points` 表中的积分余额
2. 管理员可通过后台手动增加积分
3. 提醒用户通过签到或邀请获取积分

### 管理员无法登录

1. 确认 `admins` 表中有管理员记录
2. 检查 `ADMIN_INIT_KEY` 环境变量是否正确
3. 重新执行 `/api/admin/init` 接口创建管理员

### 数据库错误

如果遇到数据库相关错误:
```bash
# 删除数据库文件重新初始化 (注意:会丢失所有数据)
rm database.sqlite

# 重启服务,自动创建新数据库
npm start
```

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🙏 致谢

感谢使用 AI 智能助手!如有问题或建议,欢迎反馈。

---

**版本**: v2.1
**更新日期**: 2025-01-XX
**维护者**: [Your Name]
