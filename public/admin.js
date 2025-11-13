// 管理后台JavaScript

let adminToken = localStorage.getItem('adminToken');
let currentUser = null;
let currentPage = 1;
let currentView = 'dashboard';
let selectedConversationUser = null;
let selectedPointsUser = null;
let savedSmtpPassword = null; // 存储从后端获取的真实授权码

// 辅助函数：获取用户头像HTML
function getUserAvatarHTML(user, size = 40) {
    if (user && user.avatar) {
        return `<img src="${user.avatar}" alt="${user.username}" style="width: ${size}px; height: ${size}px; border-radius: 50%; object-fit: cover; border: 2px solid #e3f2fd;">`;
    } else if (user && user.username) {
        return `<div style="width: ${size}px; height: ${size}px; border-radius: 50%; background: linear-gradient(135deg, #0052cc 0%, #1976d2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: ${size * 0.5}px; border: 2px solid #e3f2fd;">${user.username.charAt(0).toUpperCase()}</div>`;
    }
    return `<div style="width: ${size}px; height: ${size}px; border-radius: 50%; background: #94a3b8; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: ${size * 0.5}px;">?</div>`;
}

// 页面加载
document.addEventListener('DOMContentLoaded', () => {
    if (adminToken) {
        showAdminPanel();
        loadDashboard();
    }

    bindEvents();
});

// 绑定事件
function bindEvents() {
    // 登录表单
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 侧边栏菜单
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
        });
    });

    // 用户搜索
    let searchTimeout;
    document.getElementById('userSearch').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadUsers(1, e.target.value);
        }, 500);
    });

    // 对话管理用户搜索
    let convSearchTimeout;
    document.getElementById('convUserSearch').addEventListener('input', (e) => {
        clearTimeout(convSearchTimeout);
        convSearchTimeout = setTimeout(() => {
            loadConversationUsers(e.target.value);
        }, 300);
    });

    // 积分管理用户搜索
    let pointsSearchTimeout;
    document.getElementById('pointsUserSearchInput').addEventListener('input', (e) => {
        clearTimeout(pointsSearchTimeout);
        pointsSearchTimeout = setTimeout(() => {
            loadPointsUsers(e.target.value);
        }, 300);
    });
}

// 管理员登录
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            adminToken = data.token;
            localStorage.setItem('adminToken', adminToken);
            document.getElementById('adminUsername').textContent = data.admin.username;
            showAdminPanel();
            loadDashboard();
        } else {
            errorDiv.textContent = data.error || '登录失败';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('登录失败:', error);
        errorDiv.textContent = '登录失败，请稍后重试';
        errorDiv.style.display = 'block';
    }
}

// 退出登录
function handleLogout() {
    adminToken = null;
    localStorage.removeItem('adminToken');
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('adminContainer').style.display = 'none';
}

// 显示管理面板
function showAdminPanel() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminContainer').style.display = 'block';
}

// 切换视图
function switchView(view) {
    // 更新菜单激活状态
    document.querySelectorAll('.admin-menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === view) {
            item.classList.add('active');
        }
    });

    // 隐藏所有视图
    document.querySelectorAll('.view-content').forEach(v => {
        v.style.display = 'none';
    });

    // 显示当前视图
    document.getElementById(view + 'View').style.display = 'block';
    currentView = view;

    // 加载数据
    switch (view) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'users':
            loadUsers();
            break;
        case 'conversations':
            loadConversationUsers();
            break;
        case 'points':
            loadPointsUsers();
            break;
    }
}

// 加载数据概览
async function loadDashboard() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.ok) {
            const stats = await response.json();
            document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
            document.getElementById('totalConversations').textContent = stats.totalConversations || 0;
            document.getElementById('totalMessages').textContent = stats.totalMessages || 0;
            document.getElementById('totalPointsSpent').textContent = stats.totalPointsSpent || 0;
            document.getElementById('todayNewUsers').textContent = stats.todayNewUsers || 0;
            document.getElementById('todayActiveUsers').textContent = stats.todayActiveUsers || 0;

            // 渲染图表
            renderCharts(stats);
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 加载用户列表
async function loadUsers(page = 1, search = '') {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">加载中...</td></tr>';

    try {
        const response = await fetch(`/api/admin/users?page=${page}&limit=20&search=${search}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            displayUsers(result.data);
            displayPagination(result.pagination, 'usersPagination', loadUsers);
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">加载失败</td></tr>';
        }
    } catch (error) {
        console.error('加载用户列表失败:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="empty">加载失败</td></tr>';
    }
}

// 显示用户列表
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无用户</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${getUserAvatarHTML(user, 40)}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.points || 0}</td>
            <td>${new Date(user.created_at).toLocaleString('zh-CN')}</td>
            <td>
                <button class="action-btn" onclick="viewUser('${user.id}')">查看</button>
                <button class="action-btn" onclick="adjustPoints('${user.id}', '${user.username}')">调整积分</button>
                <button class="action-btn" onclick="deleteUser('${user.id}', '${user.username}')" style="color: #c62828;">删除</button>
            </td>
        </tr>
    `).join('');
}

// 显示分页
function displayPagination(pagination, containerId, loadFunc) {
    const container = document.getElementById(containerId);
    if (!pagination) return;

    const totalPages = Math.ceil(pagination.total / pagination.limit);
    let html = '';

    // 上一页
    html += `<button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''}
        onclick="${loadFunc.name}(${pagination.page - 1})">上一页</button>`;

    // 页码
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
            html += `<button class="page-btn ${i === pagination.page ? 'active' : ''}"
                onclick="${loadFunc.name}(${i})">${i}</button>`;
        } else if (i === pagination.page - 3 || i === pagination.page + 3) {
            html += `<span>...</span>`;
        }
    }

    // 下一页
    html += `<button class="page-btn" ${!pagination.has_more ? 'disabled' : ''}
        onclick="${loadFunc.name}(${pagination.page + 1})">下一页</button>`;

    container.innerHTML = html;
}

// 查看用户详情
async function viewUser(userId) {
    const modal = document.getElementById('userDetailModal');
    const content = document.getElementById('userDetailContent');
    content.innerHTML = '<div class="loading">加载中...</div>';
    modal.style.display = 'flex';

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayUserDetail(data);
        } else {
            content.innerHTML = '<div class="empty">加载失败</div>';
        }
    } catch (error) {
        console.error('加载用户详情失败:', error);
        content.innerHTML = '<div class="empty">加载失败</div>';
    }
}

// 显示用户详情
function displayUserDetail(data) {
    const content = document.getElementById('userDetailContent');
    const user = data.user;

    let html = `
        <div class="detail-row">
            <span class="detail-label">用户名</span>
            <span class="detail-value">${user.username}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">邮箱</span>
            <span class="detail-value">${user.email}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">当前积分</span>
            <span class="detail-value">${user.points || 0}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">累计获得</span>
            <span class="detail-value">${user.total_earned || 0}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">累计消耗</span>
            <span class="detail-value">${user.total_spent || 0}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">注册时间</span>
            <span class="detail-value">${new Date(user.created_at).toLocaleString('zh-CN')}</span>
        </div>
        <h3 style="margin-top: 24px; margin-bottom: 12px; color: #0052cc;">对话记录 (${data.conversations.length})</h3>
        <div class="conversation-list">
    `;

    if (data.conversations.length > 0) {
        html += data.conversations.map(conv => `
            <div class="conversation-item" onclick="viewConversation('${conv.id}')">
                <div style="font-weight: 600; margin-bottom: 4px;">${conv.title}</div>
                <div style="font-size: 12px; color: #64748b;">
                    ${new Date(conv.created_at).toLocaleString('zh-CN')}
                </div>
            </div>
        `).join('');
    } else {
        html += '<div class="empty">暂无对话记录</div>';
    }

    html += '</div>';

    html += `
        <h3 style="margin-top: 24px; margin-bottom: 12px; color: #0052cc;">积分记录 (最近50条)</h3>
        <div class="conversation-list">
    `;

    if (data.transactions.length > 0) {
        html += data.transactions.map(tx => {
            const amount = tx.amount;
            const color = amount > 0 ? '#2e7d32' : '#c62828';
            return `
                <div style="padding: 12px; background: #f5f7fa; border-radius: 8px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">${tx.reason}</div>
                            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                                ${new Date(tx.created_at).toLocaleString('zh-CN')}
                            </div>
                        </div>
                        <div style="font-size: 18px; font-weight: 700; color: ${color};">
                            ${amount > 0 ? '+' : ''}${amount}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        html += '<div class="empty">暂无积分记录</div>';
    }

    html += '</div>';

    content.innerHTML = html;
}

// 查看对话内容
async function viewConversation(conversationId) {
    const modal = document.getElementById('conversationModal');
    const content = document.getElementById('conversationContent');
    content.innerHTML = '<div class="loading">加载中...</div>';
    modal.style.display = 'flex';

    try {
        const response = await fetch(`/api/admin/conversations/${conversationId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayConversation(data);
        } else {
            content.innerHTML = '<div class="empty">加载失败</div>';
        }
    } catch (error) {
        console.error('加载对话内容失败:', error);
        content.innerHTML = '<div class="empty">加载失败</div>';
    }
}

// 显示对话内容
function displayConversation(data) {
    const content = document.getElementById('conversationContent');
    const conversation = data.conversation;
    const messages = data.messages;

    let html = `
        <div style="margin-bottom: 24px;">
            <div class="detail-row">
                <span class="detail-label">对话标题</span>
                <span class="detail-value">${conversation.title}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">创建时间</span>
                <span class="detail-value">${new Date(conversation.created_at).toLocaleString('zh-CN')}</span>
            </div>
        </div>
        <h3 style="margin-bottom: 16px; color: #0052cc;">消息内容</h3>
    `;

    if (messages.length > 0) {
        html += messages.map(msg => `
            <div class="message-item ${msg.role}">
                <div class="message-role">${msg.role === 'user' ? '👤 用户' : '🤖 AI助手'}</div>
                <div class="message-content">${msg.content.replace(/\n/g, '<br>')}</div>
                ${msg.thinking_content ? `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e3f2fd;">
                        <div style="font-weight: 600; margin-bottom: 8px; color: #64748b;">思考过程：</div>
                        <div style="font-size: 13px; color: #64748b;">${msg.thinking_content.replace(/\n/g, '<br>')}</div>
                    </div>
                ` : ''}
                <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
                    ${new Date(msg.created_at).toLocaleString('zh-CN')}
                </div>
            </div>
        `).join('');
    } else {
        html += '<div class="empty">暂无消息</div>';
    }

    content.innerHTML = html;
}

// 调整积分
function adjustPoints(userId, username) {
    currentUser = { id: userId, username };
    document.getElementById('pointsModal').style.display = 'flex';
    document.getElementById('pointsAmount').value = '';
    document.getElementById('pointsReason').value = '';
}

// 提交积分调整
async function submitPointsAdjust() {
    const amount = parseInt(document.getElementById('pointsAmount').value);
    const reason = document.getElementById('pointsReason').value;

    if (!amount || amount === 0) {
        alert('请输入有效的积分数量');
        return;
    }

    if (!reason) {
        alert('请输入调整原因');
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${currentUser.id}/points`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount, reason })
        });

        if (response.ok) {
            alert(`成功为用户 ${currentUser.username} 调整积分：${amount > 0 ? '+' : ''}${amount}`);
            closePointsModal();
            // 刷新用户列表
            if (currentView === 'users') {
                loadUsers(currentPage);
            }
            // 刷新积分管理页面
            if (currentView === 'points' && selectedPointsUser) {
                selectPointsUser(selectedPointsUser.id, selectedPointsUser.username, selectedPointsUser.email);
            }
        } else {
            const data = await response.json();
            alert(data.error || '调整失败');
        }
    } catch (error) {
        console.error('调整积分失败:', error);
        alert('调整失败，请稍后重试');
    }
}

// 关闭模态窗口
function closeUserDetail() {
    document.getElementById('userDetailModal').style.display = 'none';
}

function closeConversation() {
    document.getElementById('conversationModal').style.display = 'none';
}

function closePointsModal() {
    document.getElementById('pointsModal').style.display = 'none';
}

// 删除用户
async function deleteUser(userId, username) {
    if (!confirm(`确定要删除用户 "${username}" 吗？\n\n此操作将删除该用户的所有数据，包括：\n- 所有对话和消息\n- 所有积分记录\n- 所有文件\n\n此操作不可撤销！`)) {
        return;
    }

    // 二次确认
    if (!confirm(`再次确认：真的要删除用户 "${username}" 吗？`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.ok) {
            alert(`用户 "${username}" 已成功删除`);
            // 刷新用户列表
            if (currentView === 'users') {
                loadUsers(currentPage);
            }
            // 刷新统计数据
            loadDashboard();
        } else {
            const data = await response.json();
            alert(data.error || '删除失败');
        }
    } catch (error) {
        console.error('删除用户失败:', error);
        alert('删除失败，请稍后重试');
    }
}

// 点击模态窗口外部关闭
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// ========== 对话管理功能 ==========

// 加载对话管理的用户列表
async function loadConversationUsers(search = '') {
    const container = document.getElementById('conversationUsersList');
    container.innerHTML = '<div class="loading-placeholder">加载中...</div>';

    try {
        const response = await fetch(`/api/admin/users?page=1&limit=100&search=${search}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            displayConversationUsersList(result.data);
        } else {
            container.innerHTML = '<div class="loading-placeholder">加载失败</div>';
        }
    } catch (error) {
        console.error('加载用户列表失败:', error);
        container.innerHTML = '<div class="loading-placeholder">加载失败</div>';
    }
}

// 显示对话管理的用户列表
function displayConversationUsersList(users) {
    const container = document.getElementById('conversationUsersList');

    if (!users || users.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">暂无用户</div>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="user-list-item" onclick="selectConversationUser('${user.id}', '${user.username}', '${user.email}')">
            <div style="display: flex; align-items: center; gap: 12px;">
                ${getUserAvatarHTML(user, 36)}
                <div style="flex: 1;">
                    <div class="user-name">${user.username}</div>
                    <div class="user-meta">
                        <span>${user.email}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 选择用户查看对话
async function selectConversationUser(userId, username, email) {
    // 高亮选中项
    document.querySelectorAll('#conversationUsersList .user-list-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.user-list-item').classList.add('active');

    selectedConversationUser = { id: userId, username, email };

    // 显示加载状态
    const detailContainer = document.getElementById('conversationDetail');
    detailContainer.innerHTML = '<div class="loading-placeholder">加载中...</div>';

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayConversationDetail(data, username, email);
        } else {
            detailContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">加载失败</div></div>';
        }
    } catch (error) {
        console.error('加载用户对话失败:', error);
        detailContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">加载失败</div></div>';
    }
}

// 显示对话详情
function displayConversationDetail(data, username, email) {
    const container = document.getElementById('conversationDetail');
    const conversations = data.conversations;
    const user = data.user; // 获取完整的用户信息（包含头像）

    let html = `
        <div class="detail-header">
            <div class="detail-user-info">
                <div class="detail-avatar">${user && user.avatar ? `<img src="${user.avatar}" alt="${username}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;">` : username.charAt(0).toUpperCase()}</div>
                <div class="detail-user-text">
                    <div class="detail-user-name">${username}</div>
                    <div class="detail-user-email">${email}</div>
                </div>
            </div>
        </div>
    `;

    if (!conversations || conversations.length === 0) {
        html += '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-text">该用户暂无对话记录</div></div>';
    } else {
        html += '<div class="data-table"><table><thead><tr><th>对话标题</th><th>消息数</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
        html += conversations.map(conv => `
            <tr>
                <td>${conv.title}</td>
                <td>${conv.message_count || 0}</td>
                <td>${new Date(conv.created_at).toLocaleString('zh-CN')}</td>
                <td><button class="action-btn" onclick="viewConversation('${conv.id}')">查看详情</button></td>
            </tr>
        `).join('');
        html += '</tbody></table></div>';
    }

    container.innerHTML = html;
}

// ========== 积分管理功能 ==========

// 加载积分管理的用户列表
async function loadPointsUsers(search = '') {
    const container = document.getElementById('pointsUsersList');
    container.innerHTML = '<div class="loading-placeholder">加载中...</div>';

    try {
        const response = await fetch(`/api/admin/users?page=1&limit=100&search=${search}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            displayPointsUsersList(result.data);
        } else {
            container.innerHTML = '<div class="loading-placeholder">加载失败</div>';
        }
    } catch (error) {
        console.error('加载用户列表失败:', error);
        container.innerHTML = '<div class="loading-placeholder">加载失败</div>';
    }
}

// 显示积分管理的用户列表
function displayPointsUsersList(users) {
    const container = document.getElementById('pointsUsersList');

    if (!users || users.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">暂无用户</div>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="user-list-item" onclick="selectPointsUser('${user.id}', '${user.username}', '${user.email}')">
            <div style="display: flex; align-items: center; gap: 12px;">
                ${getUserAvatarHTML(user, 36)}
                <div style="flex: 1;">
                    <div class="user-name">${user.username}</div>
                    <div class="user-meta">
                        <span class="meta-badge">💎 ${user.points || 0}</span>
                        <span>${user.email}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// 选择用户管理积分
async function selectPointsUser(userId, username, email) {
    // 高亮选中项
    document.querySelectorAll('#pointsUsersList .user-list-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.user-list-item').classList.add('active');

    selectedPointsUser = { id: userId, username, email };
    currentUser = selectedPointsUser;

    // 显示加载状态
    const detailContainer = document.getElementById('pointsDetail');
    detailContainer.innerHTML = '<div class="loading-placeholder">加载中...</div>';

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayPointsDetail(data, username, email);
        } else {
            detailContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">加载失败</div></div>';
        }
    } catch (error) {
        console.error('加载用户积分失败:', error);
        detailContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">加载失败</div></div>';
    }
}

// 显示积分详情
function displayPointsDetail(data, username, email) {
    const container = document.getElementById('pointsDetail');
    const user = data.user;
    const transactions = data.transactions;

    let html = `
        <div class="detail-header">
            <div class="detail-user-info">
                <div class="detail-avatar">${user && user.avatar ? `<img src="${user.avatar}" alt="${username}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover;">` : username.charAt(0).toUpperCase()}</div>
                <div class="detail-user-text">
                    <div class="detail-user-name">${username}</div>
                    <div class="detail-user-email">${email}</div>
                </div>
            </div>
            <button class="admin-action-btn primary" onclick="adjustPoints('${user.id}', '${username}')">
                <span class="btn-icon">⚡</span>
                <span>调整积分</span>
            </button>
        </div>

        <!-- 积分概览 -->
        <div class="stats-grid" style="margin-bottom: 32px; grid-template-columns: repeat(3, 1fr);">
            <div class="stat-card">
                <div class="stat-icon">💎</div>
                <div class="stat-label">当前积分</div>
                <div class="stat-value">${user.points || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-label">累计获得</div>
                <div class="stat-value">${user.total_earned || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📉</div>
                <div class="stat-label">累计消耗</div>
                <div class="stat-value">${user.total_spent || 0}</div>
            </div>
        </div>

        <h3 style="margin: 0 0 16px; color: #0052cc; font-size: 18px; font-weight: 700;">积分记录</h3>
    `;

    if (!transactions || transactions.length === 0) {
        html += '<div class="empty-state" style="min-height: 200px;"><div class="empty-icon">📭</div><div class="empty-text">暂无积分记录</div></div>';
    } else {
        html += '<div class="data-table"><table><thead><tr><th>类型</th><th>原因</th><th>变动积分</th><th>时间</th></tr></thead><tbody>';
        html += transactions.map(tx => {
            const amount = tx.amount;
            const type = amount > 0 ? '获得' : '消耗';
            const typeColor = amount > 0 ? '#2e7d32' : '#c62828';
            const typeBg = amount > 0 ? '#e8f5e9' : '#ffebee';
            return `
                <tr>
                    <td><span style="background: ${typeBg}; color: ${typeColor}; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">${type}</span></td>
                    <td>${tx.reason}</td>
                    <td style="color: ${typeColor}; font-weight: 700;">${amount > 0 ? '+' : ''}${amount}</td>
                    <td style="color: #64748b; font-size: 13px;">${new Date(tx.created_at).toLocaleString('zh-CN')}</td>
                </tr>
            `;
        }).join('');
        html += '</tbody></table></div>';
    }

    container.innerHTML = html;
}


// ========== 图表渲染功能 ==========

let chartInstances = {}; // 存储图表实例,用于更新时销毁旧图表

// 渲染所有图表
function renderCharts(stats) {
    // 销毁旧图表
    Object.values(chartInstances).forEach(chart => {
        if (chart) chart.destroy();
    });
    chartInstances = {};

    // 渲染用户增长趋势图
    renderUserGrowthChart(stats);

    // 渲染对话活跃度图
    renderConversationActivityChart(stats);

    // 渲染积分消耗分布图
    renderPointsDistributionChart(stats);

    // 渲染消息类型占比图
    renderMessageTypeChart(stats);
}

// 1. 用户增长趋势图
function renderUserGrowthChart(stats) {
    try {
        const userGrowthData = stats.userGrowthData || [];

        // 生成最近7天的日期数组
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toISOString().split('T')[0]);
        }

        // 构建数据映射
        const dataMap = {};
        userGrowthData.forEach(item => {
            dataMap[item.date] = item.new_users;
        });

        // 填充数据,没有数据的日期填0
        const days = [];
        const newUsers = [];
        let cumulativeTotal = stats.totalUsers - userGrowthData.reduce((sum, item) => sum + item.new_users, 0);
        const totalUsers = [];

        last7Days.forEach(dateStr => {
            const date = new Date(dateStr);
            days.push(`${date.getMonth() + 1}/${date.getDate()}`);
            const newUserCount = dataMap[dateStr] || 0;
            newUsers.push(newUserCount);
            cumulativeTotal += newUserCount;
            totalUsers.push(cumulativeTotal);
        });

        const ctx = document.getElementById('userGrowthChart');
        chartInstances.userGrowth = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [
                    {
                        label: '新增用户',
                        data: newUsers,
                        borderColor: '#0052cc',
                        backgroundColor: 'rgba(0, 82, 204, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#0052cc',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    },
                    {
                        label: '累计用户',
                        data: totalUsers,
                        borderColor: '#1976d2',
                        backgroundColor: 'rgba(25, 118, 210, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#1976d2',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 12, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 82, 204, 0.9)',
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        borderColor: '#0052cc',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 82, 204, 0.05)' },
                        ticks: { font: { size: 11 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    } catch (error) {
        console.error('渲染用户增长图表失败:', error);
    }
}

// 2. 对话活跃度图
function renderConversationActivityChart(stats) {
    try {
        const conversationActivityData = stats.conversationActivityData || [];

        // 生成最近7天的日期数组
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toISOString().split('T')[0]);
        }

        // 构建数据映射
        const dataMap = {};
        conversationActivityData.forEach(item => {
            dataMap[item.date] = {
                conversations: item.conversation_count,
                messages: item.message_count
            };
        });

        // 填充数据
        const days = [];
        const conversations = [];
        const messages = [];

        last7Days.forEach(dateStr => {
            const date = new Date(dateStr);
            days.push(`${date.getMonth() + 1}/${date.getDate()}`);
            const data = dataMap[dateStr] || { conversations: 0, messages: 0 };
            conversations.push(data.conversations);
            messages.push(data.messages);
        });

        const ctx = document.getElementById('conversationActivityChart');
        chartInstances.conversationActivity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: days,
                datasets: [
                    {
                        label: '新增对话',
                        data: conversations,
                        backgroundColor: 'rgba(0, 82, 204, 0.7)',
                        borderColor: '#0052cc',
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false
                    },
                    {
                        label: '消息数量',
                        data: messages,
                        backgroundColor: 'rgba(25, 118, 210, 0.5)',
                        borderColor: '#1976d2',
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 12, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 82, 204, 0.9)',
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 82, 204, 0.05)' },
                        ticks: { font: { size: 11 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    } catch (error) {
        console.error('渲染对话活跃度图表失败:', error);
    }
}

// 3. 积分消耗分布图
function renderPointsDistributionChart(stats) {
    try {
        const pointsDistributionData = stats.pointsDistributionData || {
            '活跃用户': 0,
            '普通用户': 0,
            '新用户': 0,
            '休眠用户': 0
        };

        // 计算总数和百分比
        const total = Object.values(pointsDistributionData).reduce((sum, val) => sum + val, 0);
        const percentages = {};
        Object.keys(pointsDistributionData).forEach(key => {
            percentages[key] = total > 0 ? ((pointsDistributionData[key] / total) * 100).toFixed(1) : 0;
        });

        const ctx = document.getElementById('pointsDistributionChart');
        chartInstances.pointsDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['活跃用户', '普通用户', '新用户', '休眠用户'],
                datasets: [{
                    data: [
                        parseFloat(percentages['活跃用户']),
                        parseFloat(percentages['普通用户']),
                        parseFloat(percentages['新用户']),
                        parseFloat(percentages['休眠用户'])
                    ],
                    backgroundColor: [
                        'rgba(0, 82, 204, 0.8)',
                        'rgba(25, 118, 210, 0.7)',
                        'rgba(144, 202, 249, 0.6)',
                        'rgba(227, 242, 253, 0.8)'
                    ],
                    borderColor: [
                        '#0052cc',
                        '#1976d2',
                        '#90caf9',
                        '#e3f2fd'
                    ],
                    borderWidth: 3,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 12, weight: '600' },
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const count = pointsDistributionData[label] || 0;
                                        return {
                                            text: `${label}: ${count}人 (${value}%)`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 82, 204, 0.9)',
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function(context) {
                                const label = context.label;
                                const count = pointsDistributionData[label] || 0;
                                return `${label}: ${count}人 (${context.parsed}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('渲染积分分布图表失败:', error);
    }
}

// 4. 消息类型占比图
function renderMessageTypeChart(stats) {
    try {
        const messageTypeData = stats.messageTypeData || { user: 0, assistant: 0 };
        const userMessages = messageTypeData.user || 0;
        const assistantMessages = messageTypeData.assistant || 0;

        const ctx = document.getElementById('messageTypeChart');
        chartInstances.messageType = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['用户消息', 'AI助手消息'],
                datasets: [{
                    data: [userMessages, assistantMessages],
                    backgroundColor: [
                        'rgba(0, 82, 204, 0.8)',
                        'rgba(25, 118, 210, 0.6)'
                    ],
                    borderColor: [
                        '#0052cc',
                        '#1976d2'
                    ],
                    borderWidth: 3,
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: { size: 12, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 82, 204, 0.9)',
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('渲染消息类型图表失败:', error);
    }
}

// ========== 邮箱验证设置功能 ==========

// 加载邮箱验证设置
async function loadEmailSettings() {
    try {
        const response = await fetch('/api/admin/email-settings', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        if (!response.ok) {
            throw new Error('获取邮箱设置失败');
        }

        const settings = await response.json();

        // 保存真实的授权码（如果后端返回了）
        savedSmtpPassword = settings.smtp_password || null;

        // 填充表单
        document.getElementById('emailVerificationEnabled').checked = settings.enabled === 1;
        document.getElementById('smtpHost').value = settings.smtp_host || '';
        document.getElementById('smtpPort').value = settings.smtp_port || 587;
        document.getElementById('smtpUser').value = settings.smtp_user || '';
        document.getElementById('fromEmail').value = settings.from_email || '';
        document.getElementById('fromName').value = settings.from_name || 'AI智能助手';
        document.getElementById('smtpSecure').checked = settings.smtp_secure === 1;
        document.getElementById('emailSubject').value = settings.email_subject || '【AI智能助手】邮箱验证码';
        document.getElementById('emailTemplate').value = settings.email_template || '您好！\n\n您的邮箱验证码是：{code}\n\n验证码将在5分钟后过期，请尽快完成验证。\n\n如果这不是您的操作，请忽略此邮件。\n\n祝您使用愉快！\nAI智能助手团队';

        // 如果已配置SMTP用户，说明已保存过密码，显示占位符
        const passwordInput = document.getElementById('smtpPassword');
        const toggleBtn = document.getElementById('togglePasswordBtn');

        if (settings.smtp_user && savedSmtpPassword) {
            // 后端返回了密码，显示占位符
            passwordInput.value = '••••••••••••••••';
            passwordInput.type = 'password';
            passwordInput.setAttribute('data-has-password', 'true');
        } else if (settings.smtp_user && !savedSmtpPassword) {
            // 有配置但后端没返回密码（出于安全考虑），显示提示
            passwordInput.value = '';
            passwordInput.type = 'password';
            passwordInput.placeholder = '已保存授权码，如需修改请输入新的授权码';
            passwordInput.setAttribute('data-has-password', 'true');
        } else {
            passwordInput.value = '';
            passwordInput.type = 'password';
            passwordInput.removeAttribute('data-has-password');
        }

        // 重置显示按钮文本
        if (toggleBtn) {
            toggleBtn.textContent = '👁️ 显示';
        }

        // 根据启用状态显示/隐藏表单
        toggleSmtpForm(settings.enabled === 1);
    } catch (error) {
        console.error('加载邮箱设置失败:', error);
        showNotification('加载邮箱设置失败', 'error');
    }
}

// 切换SMTP表单显示
function toggleSmtpForm(show) {
    const form = document.getElementById('smtpConfigForm');
    if (form) {
        form.style.display = show ? 'block' : 'none';
    }
}

// 保存邮箱验证设置
async function saveEmailSettings() {
    const enabled = document.getElementById('emailVerificationEnabled').checked ? 1 : 0;
    const smtpHost = document.getElementById('smtpHost').value.trim();
    const smtpPort = parseInt(document.getElementById('smtpPort').value) || 587;
    const smtpUser = document.getElementById('smtpUser').value.trim();
    const passwordInput = document.getElementById('smtpPassword');
    const smtpPassword = passwordInput.value.trim();
    const fromEmail = document.getElementById('fromEmail').value.trim();
    const fromName = document.getElementById('fromName').value.trim();
    const smtpSecure = document.getElementById('smtpSecure').checked ? 1 : 0;
    const emailSubject = document.getElementById('emailSubject').value.trim();
    const emailTemplate = document.getElementById('emailTemplate').value.trim();

    // 如果启用，验证必填字段
    if (enabled) {
        if (!smtpHost || !smtpUser) {
            showNotification('请填写SMTP服务器地址和用户名', 'error');
            return;
        }
        if (!emailSubject || !emailTemplate) {
            showNotification('请填写邮件主题和邮件模板', 'error');
            return;
        }
        if (!emailTemplate.includes('{code}')) {
            showNotification('邮件模板必须包含 {code} 占位符', 'error');
            return;
        }
    }

    try {
        const data = {
            enabled,
            smtp_host: smtpHost,
            smtp_port: smtpPort,
            smtp_user: smtpUser,
            from_email: fromEmail || smtpUser,
            from_name: fromName || 'AI智能助手',
            smtp_secure: smtpSecure,
            email_subject: emailSubject || '【AI智能助手】邮箱验证码',
            email_template: emailTemplate || '您好！\n\n您的邮箱验证码是：{code}\n\n验证码将在5分钟后过期，请尽快完成验证。\n\n如果这不是您的操作，请忽略此邮件。\n\n祝您使用愉快！\nAI智能助手团队'
        };

        // 只有填写了新密码才发送（不是占位符）
        const hasPassword = passwordInput.getAttribute('data-has-password') === 'true';
        const isPlaceholder = smtpPassword === '••••••••••••••••';

        if (smtpPassword && !isPlaceholder) {
            data.smtp_password = smtpPassword;
        }

        const response = await fetch('/api/admin/email-settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '保存失败');
        }

        // 如果保存了新密码，更新 savedSmtpPassword
        if (smtpPassword && !isPlaceholder) {
            savedSmtpPassword = smtpPassword;
        }

        showNotification('邮箱验证设置保存成功！', 'success');

        // 保存成功后显示占位符，并重置输入框状态
        passwordInput.value = '••••••••••••••••';
        passwordInput.type = 'password';  // 确保类型为password
        passwordInput.setAttribute('data-has-password', 'true');

        // 重置显示按钮文本
        const toggleBtn = document.getElementById('togglePasswordBtn');
        if (toggleBtn) {
            toggleBtn.textContent = '👁️ 显示';
        }
    } catch (error) {
        console.error('保存邮箱设置失败:', error);
        showNotification(error.message || '保存邮箱设置失败', 'error');
    }
}

// 测试SMTP配置
async function testEmailSettings() {
    // 检查是否启用了邮箱验证
    const enabled = document.getElementById('emailVerificationEnabled').checked;
    if (!enabled) {
        showNotification('请先启用邮箱验证功能', 'error');
        return;
    }

    // 检查必填字段
    const smtpHost = document.getElementById('smtpHost').value.trim();
    const smtpUser = document.getElementById('smtpUser').value.trim();
    const smtpPassword = document.getElementById('smtpPassword').value.trim();

    if (!smtpHost || !smtpUser) {
        showNotification('请先填写SMTP服务器地址和用户名，然后保存配置', 'error');
        return;
    }

    // 提示用户如果修改了配置需要先保存
    if (smtpPassword) {
        const confirmSave = confirm('检测到您填写了新的SMTP密码。\n\n请确认：\n1. 是否已点击"保存配置"按钮？\n2. 如果未保存，请先保存后再测试。\n\n点击"确定"继续测试，点击"取消"返回保存配置。');
        if (!confirmSave) {
            return;
        }
    }

    const testEmail = prompt('请输入测试邮箱地址：');

    if (!testEmail) {
        return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
        showNotification('邮箱地址格式不正确', 'error');
        return;
    }

    try {
        showNotification('正在发送测试邮件，请稍候...', 'info');

        const response = await fetch('/api/admin/email-settings/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ email: testEmail })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || result.details || '发送失败');
        }

        showNotification(`✅ 测试邮件已成功发送到 ${testEmail}\n\n请检查邮箱（包括垃圾邮件文件夹）！`, 'success');
    } catch (error) {
        console.error('发送测试邮件失败:', error);

        // 显示详细的错误信息
        let errorMessage = '发送测试邮件失败\n\n';
        if (error.message.includes('无法连接')) {
            errorMessage += '❌ 错误原因：无法连接到SMTP服务器\n\n';
            errorMessage += '🔧 解决方案：\n';
            errorMessage += '1. 检查SMTP服务器地址是否正确\n';
            errorMessage += '2. 检查端口号是否正确（587/465）\n';
            errorMessage += '3. 检查网络连接和防火墙设置';
        } else if (error.message.includes('认证失败')) {
            errorMessage += '❌ 错误原因：SMTP认证失败\n\n';
            errorMessage += '🔧 解决方案：\n';
            errorMessage += '1. 检查邮箱地址是否正确\n';
            errorMessage += '2. 确认使用的是授权码而非密码\n';
            errorMessage += '3. 重新生成授权码并保存';
        } else {
            errorMessage += '❌ ' + error.message;
        }

        alert(errorMessage);
        showNotification(error.message, 'error');
    }
}

// 通知函数
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    // 添加动画样式
    if (!document.getElementById('notificationStyles')) {
        const style = document.createElement('style');
        style.id = 'notificationStyles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // 3秒后自动消失
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 在switchView函数中添加emailSettings视图的处理
const originalSwitchView = window.switchView;
window.switchView = function(view) {
    if (view === 'emailSettings') {
        // 调用原始函数切换视图
        if (originalSwitchView) {
            originalSwitchView(view);
        } else {
            // 如果原始函数不存在，手动切换
            document.querySelectorAll('.admin-menu-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.view === view) {
                    item.classList.add('active');
                }
            });

            document.querySelectorAll('.view-content').forEach(content => {
                content.style.display = 'none';
            });

            const viewElement = document.getElementById(view + 'View');
            if (viewElement) {
                viewElement.style.display = 'block';
            }
        }

        // 加载邮箱设置
        loadEmailSettings();
    } else if (originalSwitchView) {
        originalSwitchView(view);
    }
};

// 监听邮箱验证启用开关
document.addEventListener('DOMContentLoaded', () => {
    const enabledSwitch = document.getElementById('emailVerificationEnabled');
    if (enabledSwitch) {
        enabledSwitch.addEventListener('change', (e) => {
            toggleSmtpForm(e.target.checked);
        });
    }
});

// 切换密码可见性
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('smtpPassword');
    const toggleBtn = document.getElementById('togglePasswordBtn');

    // 检测是否是占位符
    const isPlaceholder = passwordInput.value === '••••••••••••••••';

    if (isPlaceholder) {
        // 如果是占位符，检查是否有保存的真实密码
        if (savedSmtpPassword) {
            // 显示真实密码
            passwordInput.value = savedSmtpPassword;
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈 隐藏';
        } else {
            // 没有保存的密码（后端出于安全考虑未返回）
            alert('⚠️ 已保存的授权码无法显示\n\n出于安全考虑，后端未返回已保存的授权码。\n如需修改，请点击输入框清空后重新输入新的授权码。');
        }
        return;
    }

    // 如果输入框为空，提示用户
    if (passwordInput.value === '') {
        alert('💡 密码框为空\n\n请先输入授权码');
        return;
    }

    // 正常切换显示/隐藏
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🙈 隐藏';
    } else {
        // 如果当前显示的是真实密码，隐藏时恢复为占位符
        if (passwordInput.value === savedSmtpPassword && savedSmtpPassword) {
            passwordInput.value = '••••••••••••••••';
        }
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️ 显示';
    }
}

// 监听密码输入框的输入事件，清除占位符标记
document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('smtpPassword');
    const toggleBtn = document.getElementById('togglePasswordBtn');

    if (passwordInput) {
        passwordInput.addEventListener('focus', function() {
            // 当用户聚焦到密码框时，如果是占位符就清空
            if (this.value === '••••••••••••••••') {
                this.value = '';
                this.removeAttribute('data-has-password');
                this.placeholder = '请输入新的授权码（留空则保持原有授权码不变）';
                // 重置显示按钮
                if (toggleBtn) {
                    toggleBtn.textContent = '👁️ 显示';
                }
            }
        });

        passwordInput.addEventListener('blur', function() {
            // 失去焦点时，如果为空且之前有保存的密码，恢复占位符
            if (this.value === '' && savedSmtpPassword) {
                this.value = '••••••••••••••••';
                this.setAttribute('data-has-password', 'true');
                this.placeholder = '如需修改请输入新的授权码';
            } else if (this.value === '') {
                this.placeholder = '如需修改请输入新的授权码';
            }
        });

        passwordInput.addEventListener('input', function() {
            // 当用户输入内容时，确保密码框类型为password，并重置显示按钮
            if (this.value !== '' && this.value !== '••••••••••••••••') {
                this.type = 'password';
                if (toggleBtn) {
                    toggleBtn.textContent = '👁️ 显示';
                }
            }
        });
    }
});

