# 邀请链接功能测试指南

## 修复内容

### 1. 前端修改 (public/app.js)

#### ✅ showAuthModal() 方法增强（439行）
- 添加 `inviteCode` 参数
- 注册模式下显示邀请码输入框
- 自动预填邀请码到输入框

#### ✅ handleAuth() 方法增强（480行）
- 注册时提取 `inviteCode` 字段
- 发送邀请码给后端API

#### ✅ checkInviteCode() 方法（新增，414行）
- 解析URL参数 `?invite=xxx` 或 `?inviteCode=xxx`
- 检测到邀请码且用户未登录时：
  - 自动打开注册模态窗口
  - 预填邀请码到输入框

#### ✅ init() 方法调用（29行）
- 在初始化完成后调用 `checkInviteCode()`

---

## 测试步骤

### 前提条件
1. 确保服务器正在运行：`npm start`
2. 准备两个测试账户（或准备注册新账户）

### 测试场景 1：生成邀请链接
1. 登录现有账户
2. 点击积分管理
3. 点击"邀请好友"
4. 点击"获取邀请链接"
5. 复制生成的邀请URL（格式：`http://localhost:3000/?invite=INV_xxxxxx`）

### 测试场景 2：使用邀请链接注册
1. 退出当前账户（或使用隐私浏览模式）
2. 访问邀请链接
3. **预期结果**：
   - ✅ 自动打开注册模态窗口
   - ✅ 邀请码输入框已预填邀请码
   - ✅ 邀请码输入框可见

4. 填写注册信息：
   - 用户名（必填）
   - 邮箱（必填）
   - 密码（必填）
   - 邀请码（已预填，可修改）

5. 点击"注册"按钮

6. **预期结果**：
   - ✅ 注册成功
   - ✅ 新用户获得 10（初始）+ 5（邀请奖励）= 15 积分
   - ✅ 邀请者获得 5 积分

### 测试场景 3：验证积分奖励
1. 登录邀请者账户
2. 查看积分余额，应该增加了 5 积分

3. 登录新注册的账户
4. 查看积分余额，应该是 15 积分（10 初始 + 5 邀请奖励）

### 测试场景 4：直接访问首页（无邀请码）
1. 退出登录
2. 直接访问 `http://localhost:3000/`
3. **预期结果**：
   - ✅ 不自动打开注册窗口
   - ✅ 显示欢迎页面
   - ✅ 用户可以手动点击"登录"按钮

---

## 后端验证

邀请码逻辑在 `server.js` 中已经实现：

```javascript
// server.js 注册API（约336-435行）
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, inviteCode } = req.body;

    // ... 注册逻辑 ...

    // 处理邀请码
    if (inviteCode) {
        // 查找邀请码
        const inviterStmt = db.prepare('SELECT user_id FROM invitation_codes WHERE code = ? AND status = "active"');
        const invitation = inviterStmt.get(inviteCode);

        if (invitation) {
            // 给邀请者加5积分
            db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(5, invitation.user_id);

            // 给新用户加5积分
            db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(5, userId);

            // 标记邀请码已使用
            db.prepare('UPDATE invitation_codes SET status = "used", used_at = ? WHERE code = ?')
                .run(new Date().toISOString(), inviteCode);
        }
    }
});
```

---

## 浏览器控制台验证

打开浏览器控制台（F12），应该看到以下日志：

### 访问邀请链接时：
```
检测到邀请码: INV_xxxxxx
设置认证模式为: register
已自动打开注册界面并预填邀请码
```

### 提交注册表单时：
```
表单提交处理开始
当前认证模式: register
表单数据提取结果: {
    mode: "register",
    extractedData: {
        username: "testuser",
        email: "test@example.com",
        password: "***",
        inviteCode: "INV_xxxxxx"  // 关键：应该包含邀请码
    }
}
认证响应状态: 200
认证响应数据: { token: "...", user: {...} }
注册成功！
```

---

## 常见问题排查

### 问题1：邀请码不显示在注册界面
- 检查 `inviteCodeGroup` 元素是否存在于 HTML
- 检查 `showAuthModal()` 是否正确设置了 `display: 'block'`

### 问题2：注册后没有获得积分
- 检查浏览器控制台，确认 `inviteCode` 字段已包含在请求中
- 检查服务器日志，确认后端收到了邀请码
- 检查数据库，确认邀请码状态为 "active"

### 问题3：访问邀请链接不自动打开注册窗口
- 检查URL格式是否正确：`?invite=INV_xxxxxx`
- 检查浏览器控制台，确认 `checkInviteCode()` 被调用
- 确认用户未登录状态

---

## 数据库查询验证

### 查看邀请码状态
```sql
SELECT * FROM invitation_codes WHERE code = 'INV_xxxxxx';
```

### 查看用户积分
```sql
SELECT id, username, points FROM users WHERE username = 'testuser';
```

### 查看积分交易记录
```sql
SELECT * FROM points_transactions WHERE user_id = (SELECT id FROM users WHERE username = 'testuser');
```

---

## 成功标准

✅ **功能正常**的标志：
1. 访问邀请链接自动打开注册窗口
2. 邀请码自动预填到输入框
3. 注册成功后新用户获得 15 积分
4. 邀请者获得 5 积分
5. 邀请码状态变为 "used"
6. 直接访问首页不打开注册窗口

---

**修复完成时间**: 2025-11-11
**修复版本**: v0.1.2（待发布）
