// 用户设置功能模块
// 这个文件包含用户头像和用户名设置的所有功能

// 初始化用户设置功能
function initUserSettings(app) {
    // 绑定侧边栏头像点击事件打开设置
    const sidebarUserAvatar = document.getElementById('sidebarUserAvatar');
    if (sidebarUserAvatar) {
        sidebarUserAvatar.addEventListener('click', () => {
            // 只有登录状态下才能打开设置
            if (app.token) {
                showSettingsModal(app);
            }
        });
        // 添加鼠标悬停效果提示
        sidebarUserAvatar.style.cursor = 'pointer';
        sidebarUserAvatar.title = '点击设置个人信息';
    }

    // 绑定关闭按钮
    const closeSettings = document.getElementById('closeSettings');
    if (closeSettings) {
        closeSettings.addEventListener('click', hideSettingsModal);
    }

    // 绑定头像上传
    const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
    const avatarInput = document.getElementById('avatarInput');
    const avatarPreview = document.getElementById('avatarPreview');

    if (uploadAvatarBtn && avatarInput) {
        uploadAvatarBtn.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', (e) => handleAvatarUpload(e, app));
        avatarPreview.addEventListener('click', () => avatarInput.click());
    }

    // 绑定用户名表单
    const usernameForm = document.getElementById('usernameForm');
    if (usernameForm) {
        usernameForm.addEventListener('submit', (e) => handleUsernameUpdate(e, app));
    }

    // 点击模态框外部关闭
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                hideSettingsModal();
            }
        });
    }
}

// 显示设置弹窗
function showSettingsModal(app) {
    const modal = document.getElementById('settingsModal');
    const avatarPreviewImg = document.getElementById('avatarPreviewImg');
    const avatarPlaceholder = document.querySelector('.avatar-placeholder');
    const usernameInput = document.getElementById('newUsername');

    if (app.currentUser) {
        // 设置当前用户名
        if (usernameInput) {
            usernameInput.value = app.currentUser.username || '';
        }

        // 设置当前头像
        if (app.currentUser.avatar) {
            avatarPreviewImg.src = app.currentUser.avatar;
            avatarPreviewImg.style.display = 'block';
            if (avatarPlaceholder) {
                avatarPlaceholder.style.display = 'none';
            }
        } else {
            avatarPreviewImg.style.display = 'none';
            if (avatarPlaceholder) {
                avatarPlaceholder.style.display = 'block';
            }
        }
    }

    if (modal) {
        modal.classList.add('show');
    }
}

// 隐藏设置弹窗
function hideSettingsModal() {
    const modal = document.getElementById('settingsModal');
    const settingsError = document.getElementById('settingsError');

    if (modal) {
        modal.classList.remove('show');
    }

    if (settingsError) {
        settingsError.style.display = 'none';
    }
}

// 处理头像上传
async function handleAvatarUpload(event, app) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showSettingsError('仅支持 JPG, PNG, GIF, WEBP 格式的图片');
        return;
    }

    // 检查文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showSettingsError('图片大小不能超过 5MB');
        return;
    }

    // 预览图片
    const reader = new FileReader();
    reader.onload = (e) => {
        const avatarPreviewImg = document.getElementById('avatarPreviewImg');
        const avatarPlaceholder = document.querySelector('.avatar-placeholder');

        if (avatarPreviewImg) {
            avatarPreviewImg.src = e.target.result;
            avatarPreviewImg.style.display = 'block';
        }

        if (avatarPlaceholder) {
            avatarPlaceholder.style.display = 'none';
        }
    };
    reader.readAsDataURL(file);

    // 上传到服务器
    try {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch('/api/auth/avatar', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '上传头像失败');
        }

        // 更新当前用户信息
        app.currentUser.avatar = data.avatar;

        // 更新所有显示头像的地方
        updateUserAvatar(data.avatar, app);

        showSettingsError('头像上传成功！', 'success');

        // 1.5秒后关闭弹窗
        setTimeout(() => {
            hideSettingsModal();
        }, 1500);

    } catch (error) {
        console.error('上传头像失败:', error);
        showSettingsError(error.message);
    }
}

// 处理用户名更新
async function handleUsernameUpdate(event, app) {
    event.preventDefault();

    const usernameInput = document.getElementById('newUsername');
    const newUsername = usernameInput.value.trim();

    if (!newUsername) {
        showSettingsError('用户名不能为空');
        return;
    }

    if (newUsername.length < 2 || newUsername.length > 50) {
        showSettingsError('用户名长度必须在2-50个字符之间');
        return;
    }

    try {
        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ username: newUsername })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '更新用户名失败');
        }

        // 更新当前用户信息
        app.currentUser = data.user;

        // 更新侧边栏显示
        const currentUsername = document.getElementById('currentUsername');
        if (currentUsername) {
            currentUsername.textContent = data.user.username;
        }

        showSettingsError('用户名更新成功！', 'success');

        // 1.5秒后关闭弹窗
        setTimeout(() => {
            hideSettingsModal();
        }, 1500);

    } catch (error) {
        console.error('更新用户名失败:', error);
        showSettingsError(error.message);
    }
}

// 显示设置错误/成功消息
function showSettingsError(message, type = 'error') {
    const errorDiv = document.getElementById('settingsError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        if (type === 'success') {
            errorDiv.style.background = 'rgba(76, 175, 80, 0.1)';
            errorDiv.style.borderColor = 'rgba(76, 175, 80, 0.2)';
            errorDiv.style.color = '#4caf50';
        } else {
            errorDiv.style.background = 'rgba(233, 30, 99, 0.1)';
            errorDiv.style.borderColor = 'rgba(233, 30, 99, 0.2)';
            errorDiv.style.color = '#e91e63';
        }

        // 5秒后自动隐藏
        setTimeout(() => {
            if (type !== 'success') {
                errorDiv.style.display = 'none';
            }
        }, 5000);
    }
}

// 更新所有显示用户头像的地方
function updateUserAvatar(avatarUrl, app) {
    // 1. 更新侧边栏头像
    const sidebarAvatar = document.getElementById('sidebarUserAvatar');
    if (sidebarAvatar) {
        sidebarAvatar.innerHTML = `<img src="${avatarUrl}" alt="用户头像">`;
    }

    // 2. 更新聊天界面中用户的消息头像
    const userMessages = document.querySelectorAll('.message.user .message-avatar');
    userMessages.forEach(avatar => {
        avatar.innerHTML = `<img src="${avatarUrl}" alt="用户头像">`;
    });
}

// 更新用户信息显示（在登录后调用）
function updateUserInfo(user) {
    const currentUsername = document.getElementById('currentUsername');
    const sidebarAvatar = document.getElementById('sidebarUserAvatar');

    if (currentUsername) {
        currentUsername.textContent = user.username;
    }

    // 显示用户头像
    if (sidebarAvatar && user.avatar) {
        sidebarAvatar.innerHTML = `<img src="${user.avatar}" alt="用户头像">`;
    } else if (sidebarAvatar) {
        // 使用默认头像（用户名首字母）
        sidebarAvatar.textContent = user.username.charAt(0).toUpperCase();
    }
}

// 获取用户头像HTML
function getUserAvatarHTML(user) {
    if (user && user.avatar) {
        return `<img src="${user.avatar}" alt="用户头像">`;
    } else if (user && user.username) {
        return user.username.charAt(0).toUpperCase();
    } else {
        return 'U';
    }
}

// 导出函数供外部使用
window.UserSettings = {
    init: initUserSettings,
    updateUserInfo: updateUserInfo,
    getUserAvatarHTML: getUserAvatarHTML
};
