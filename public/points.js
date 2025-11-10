// 积分管理系统
(function() {
    'use strict';

    // 积分数据
    let pointsData = {
        points: 0,
        total_earned: 0,
        total_spent: 0,
        last_checkin_date: null,
        checkin_streak: 0
    };

    // 初始化积分系统
    function initPointsSystem() {
        // 如果用户已登录,加载积分数据
        if (window.app && window.app.currentUser) {
            loadPointsData();
        }

        // 绑定事件
        bindEvents();
    }

    // 绑定事件
    function bindEvents() {
        // 积分管理按钮
        const pointsManageBtn = document.getElementById('pointsManageBtn');
        if (pointsManageBtn) {
            pointsManageBtn.addEventListener('click', showPointsModal);
        }

        // 输入框积分徽章点击事件（新增）
        const inputPointsBadge = document.getElementById('inputPointsBadge');
        if (inputPointsBadge) {
            inputPointsBadge.addEventListener('click', showPointsModal);
            inputPointsBadge.style.cursor = 'pointer';
        }

        // 关闭积分模态窗口
        const closePointsModal = document.getElementById('closePointsModal');
        if (closePointsModal) {
            closePointsModal.addEventListener('click', hidePointsModal);
        }

        // 签到按钮
        const checkinBtn = document.getElementById('checkinBtn');
        if (checkinBtn) {
            checkinBtn.addEventListener('click', handleCheckin);
        }

        // 邀请按钮
        const inviteBtn = document.getElementById('inviteBtn');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', handleInvite);
        }

        // 复制邀请码
        const copyInviteBtn = document.getElementById('copyInviteBtn');
        if (copyInviteBtn) {
            copyInviteBtn.addEventListener('click', copyInviteCode);
        }

        // 点击模态窗口外部关闭
        const pointsModal = document.getElementById('pointsModal');
        if (pointsModal) {
            pointsModal.addEventListener('click', (e) => {
                if (e.target === pointsModal) {
                    hidePointsModal();
                }
            });
        }
    }

    // 加载积分数据
    async function loadPointsData() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch('/api/points', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                pointsData = await response.json();
                updatePointsDisplay();
            }
        } catch (error) {
            console.error('加载积分失败:', error);
        }
    }

    // 更新积分显示
    function updatePointsDisplay() {
        const pointsDisplay = document.getElementById('pointsDisplay');
        const pointsValue = document.getElementById('pointsValue');
        const inputBadge = document.getElementById('inputPointsBadge');
        const inputPointsValue = document.getElementById('inputPointsValue');

        if (pointsDisplay && pointsValue) {
            pointsValue.textContent = pointsData.points || 0;
            pointsDisplay.style.display = 'flex';
        }

        // 更新输入框右上角的积分显示
        if (inputBadge && inputPointsValue) {
            inputPointsValue.textContent = pointsData.points || 0;
            inputBadge.style.display = 'flex';

            // 如果积分不足3,添加警告样式
            if (pointsData.points < 3) {
                inputBadge.classList.add('low-points');
                inputBadge.title = '积分不足，请尽快签到或邀请好友获取积分';
            } else {
                inputBadge.classList.remove('low-points');
                inputBadge.title = `当前积分: ${pointsData.points}`;
            }
        }
    }

    // 显示积分模态窗口
    async function showPointsModal() {
        const modal = document.getElementById('pointsModal');
        if (!modal) return;

        // 刷新积分数据
        await loadPointsData();

        // 更新模态窗口中的数据
        document.getElementById('modalPointsValue').textContent = pointsData.points || 0;
        document.getElementById('totalEarned').textContent = pointsData.total_earned || 0;
        document.getElementById('totalSpent').textContent = pointsData.total_spent || 0;

        // 加载交易记录
        loadTransactions();

        // 显示模态窗口
        modal.style.display = 'flex';
    }

    // 隐藏积分模态窗口
    function hidePointsModal() {
        const modal = document.getElementById('pointsModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 处理签到
    async function handleCheckin() {
        const btn = document.getElementById('checkinBtn');
        const statusDiv = document.getElementById('checkinStatus');

        if (!btn || !statusDiv) return;

        try {
            btn.disabled = true;
            btn.textContent = '签到中...';

            const token = localStorage.getItem('token');
            const response = await fetch('/api/points/checkin', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                statusDiv.innerHTML = `<span class="success">✓ 签到成功！获得 ${data.reward} 积分（连续${data.streak}天）</span>`;
                statusDiv.style.display = 'block';

                // 更新积分显示
                await loadPointsData();
                document.getElementById('modalPointsValue').textContent = data.newTotal;

                btn.textContent = '已签到';
            } else {
                statusDiv.innerHTML = `<span class="error">${data.error || '签到失败'}</span>`;
                statusDiv.style.display = 'block';
                btn.textContent = '立即签到';
                btn.disabled = false;
            }
        } catch (error) {
            console.error('签到失败:', error);
            statusDiv.innerHTML = '<span class="error">签到失败，请稍后重试</span>';
            statusDiv.style.display = 'block';
            btn.textContent = '立即签到';
            btn.disabled = false;
        }
    }

    // 处理邀请
    async function handleInvite() {
        const inviteCodeDisplay = document.getElementById('inviteCode');
        const inviteCodeInput = document.getElementById('inviteCodeInput');

        if (!inviteCodeDisplay || !inviteCodeInput) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/points/invite', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                // 生成完整的邀请链接
                const inviteUrl = `${window.location.origin}/?invite=${data.inviteCode}`;
                inviteCodeInput.value = inviteUrl;
                inviteCodeDisplay.style.display = 'flex';

                // 添加分享按钮
                showShareButtons(inviteUrl, data.inviteCode);
            } else {
                alert(data.error || '获取邀请码失败');
            }
        } catch (error) {
            console.error('获取邀请码失败:', error);
            alert('获取邀请码失败，请稍后重试');
        }
    }

    // 显示分享按钮
    function showShareButtons(url, code) {
        // 检查是否已存在分享按钮
        if (document.querySelector('.share-buttons')) {
            return;
        }

        const shareText = `🎁 邀请您使用AI智能助手，使用邀请码 ${code}，我们都能获得5积分奖励！`;

        const shareHtml = `
            <div class="share-buttons">
                <button onclick="window.copyShareLink('${url}', '${shareText}')" class="share-btn" style="background: #1DA1F2;">
                    📋 复制分享文案
                </button>
                <button onclick="if(navigator.share) { navigator.share({title: 'AI助手邀请', text: '${shareText}', url: '${url}'}); } else { alert('您的浏览器不支持系统分享功能，请使用复制链接'); }" class="share-btn" style="background: #25D366;">
                    🔗 系统分享
                </button>
            </div>
        `;

        const inviteCodeDisplay = document.getElementById('inviteCode');
        if (inviteCodeDisplay) {
            inviteCodeDisplay.insertAdjacentHTML('afterend', shareHtml);
        }
    }

    // 复制分享链接和文案
    window.copyShareLink = function(url, text) {
        const fullText = `${text}\n\n${url}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullText).then(() => {
                showCopySuccess('分享文案已复制到剪贴板！');
            }).catch(() => {
                fallbackCopy(fullText);
            });
        } else {
            fallbackCopy(fullText);
        }
    };

    // 降级复制方案
    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            showCopySuccess('分享文案已复制到剪贴板！');
        } catch (err) {
            alert('复制失败，请手动复制');
        }

        document.body.removeChild(textarea);
    }

    // 显示复制成功提示
    function showCopySuccess(message) {
        // 检查是否已存在提示
        let toast = document.querySelector('.copy-toast');
        if (toast) {
            toast.remove();
        }

        toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 82, 204, 0.95);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 82, 204, 0.3);
            z-index: 10000;
            font-size: 16px;
            font-weight: 500;
            animation: fadeInOut 2s ease;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.remove();
            }
        }, 2000);
    }

    // 复制邀请码
    function copyInviteCode() {
        const input = document.getElementById('inviteCodeInput');
        if (!input) return;

        input.select();
        document.execCommand('copy');

        const btn = document.getElementById('copyInviteBtn');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = '已复制';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        }
    }

    // 加载交易记录
    async function loadTransactions() {
        const listDiv = document.getElementById('transactionsList');
        if (!listDiv) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/points/transactions?limit=10', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                displayTransactions(result.data);
            } else {
                listDiv.innerHTML = '<div class="error-message">加载记录失败</div>';
            }
        } catch (error) {
            console.error('加载交易记录失败:', error);
            listDiv.innerHTML = '<div class="error-message">加载记录失败</div>';
        }
    }

    // 显示交易记录
    function displayTransactions(transactions) {
        const listDiv = document.getElementById('transactionsList');
        if (!listDiv) return;

        if (!transactions || transactions.length === 0) {
            listDiv.innerHTML = '<div class="empty-message">暂无积分记录</div>';
            return;
        }

        listDiv.innerHTML = transactions.map(tx => {
            const amount = tx.amount;
            const sign = amount > 0 ? '+' : '';
            const type = amount > 0 ? 'earn' : 'spend';
            const date = new Date(tx.created_at).toLocaleString('zh-CN');

            return `
                <div class="transaction-item ${type}">
                    <div class="transaction-info">
                        <div class="transaction-reason">${tx.reason}</div>
                        <div class="transaction-time">${date}</div>
                    </div>
                    <div class="transaction-amount ${type}">
                        ${sign}${amount}
                    </div>
                </div>
            `;
        }).join('');
    }

    // 当用户登录后刷新积分
    window.refreshPoints = loadPointsData;

    // 导出到全局
    window.PointsSystem = {
        init: initPointsSystem,
        load: loadPointsData,
        show: showPointsModal
    };

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPointsSystem);
    } else {
        initPointsSystem();
    }

})();
