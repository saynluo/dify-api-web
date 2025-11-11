class ChatApp {
    constructor() {
        this.currentUser = null;
        this.currentConversation = null;
        this.conversations = [];
        this.isGenerating = false;
        this.currentStreamController = null;
        
        this.init();
    }
    
    async init() {
        // 首先获取配置
        await this.loadConfig();
        this.bindEvents();
        this.checkAuth();
        this.setupMarkdownRenderer();

        // 获取应用信息（如果需要的话）
        await this.loadAppInfo();
        await this.loadAppParameters();

        // 初始化用户设置功能
        if (window.UserSettings) {
            window.UserSettings.init(this);
        }

        // 检查URL中是否有邀请码参数
        this.checkInviteCode();
    }
    
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                
                console.log('配置加载成功:', {
                    apiVersion: config.apiVersion,
                    features: config.features,
                    hasApiKey: config.dify?.hasApiKey
                });
                
                // 检查服务器是否配置了 API Key
                if (!config.dify?.hasApiKey) {
                    this.showApiKeyError();
                }
            } else {
                console.error('加载配置失败:', response.status);
                this.showConfigError();
            }
        } catch (error) {
            console.error('获取配置时发生错误:', error);
            this.showConfigError();
        }
    }
    
    showConfigError() {
        console.error(`
%c⚠️ 配置加载失败
%c无法从服务器获取配置信息。请检查：

%c1. 服务器是否正在运行
%c2. .env文件是否存在并正确配置
%c3. 网络连接是否正常

%c请重新启动应用或检查服务器日志。
        `, 
            'color: #e74c3c; font-size: 16px; font-weight: bold;',
            'color: #2c3e50; font-size: 14px;',
            'color: #e67e22; font-weight: bold;',
            'color: #e67e22; font-weight: bold;',
            'color: #e67e22; font-weight: bold;',
            'color: #c0392b; font-size: 14px; font-weight: bold;'
        );
    }
    
    // 获取应用信息
    async loadAppInfo() {
        try {
            const response = await fetch('/api/app/info');
            
            if (response.ok) {
                const appInfo = await response.json();
                this.appInfo = appInfo;
                console.log('应用信息:', appInfo);
                
                // 可以在界面上显示应用名称
                if (appInfo.name) {
                    document.title = appInfo.name;
                    const headerTitle = document.querySelector('.app-title');
                    if (headerTitle) {
                        headerTitle.textContent = appInfo.name;
                    }
                }
            } else {
                console.warn('获取应用信息失败:', response.status);
            }
        } catch (error) {
            console.error('获取应用信息错误:', error);
        }
    }
    
    // 获取应用参数
    async loadAppParameters() {
        try {
            const response = await fetch('/api/parameters');
            
            if (response.ok) {
                const parameters = await response.json();
                this.appParameters = parameters;
                console.log('应用参数:', parameters);
                
                // 渲染开场白
                if (parameters.opening_statement) {
                    this.renderOpeningStatement(parameters.opening_statement);
                }
                
                // 渲染建议问题
                if (parameters.suggested_questions && parameters.suggested_questions.length > 0) {
                    this.renderSuggestedQuestions(parameters.suggested_questions);
                }
                
                // 配置文件上传设置
                if (parameters.file_upload) {
                    this.configureFileUpload(parameters.file_upload);
                }
                
                // 配置语音功能
                if (parameters.speech_to_text?.enabled) {
                    this.enableSpeechToText();
                }
                
                if (parameters.text_to_speech?.enabled) {
                    this.enableTextToSpeech(parameters.text_to_speech);
                }
                
                // 隐藏默认欢迎屏幕
                this.hideWelcomeScreen();
                
            } else {
                console.warn('获取应用参数失败:', response.status);
                this.showParameterError();
            }
        } catch (error) {
            console.error('获取应用参数错误:', error);
            this.showParameterError();
        }
    }
    
    // 渲染开场白
    renderOpeningStatement(statement) {
        const container = document.getElementById('messagesContainer');
        
        // 创建开场白容器
        const openingDiv = document.createElement('div');
        openingDiv.className = 'opening-statement-container';
        openingDiv.innerHTML = `
            <div class="opening-statement">
                <div class="opening-avatar">
                    <img src="logo.png" alt="AI" class="avatar-logo">
                </div>
                <div class="opening-content">
                    <div class="opening-text">${this.parseMarkdown(statement)}</div>
                </div>
            </div>
        `;
        
        container.appendChild(openingDiv);
        this.scrollToBottom();
    }
    
    // 渲染建议问题
    renderSuggestedQuestions(questions) {
        if (!questions || questions.length === 0) return;
        
        const container = document.getElementById('messagesContainer');
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggested-questions-container';
        
        const questionsHtml = questions.map((question, index) => 
            `<button class="suggested-question-btn" data-question="${this.escapeHtml(question)}">
                <span class="question-icon">💡</span>
                <span class="question-text">${this.escapeHtml(question)}</span>
            </button>`
        ).join('');
        
        suggestionsDiv.innerHTML = `
            <div class="suggestions-header">
                <span class="suggestions-title">💭 推荐问题</span>
            </div>
            <div class="suggested-questions-grid">${questionsHtml}</div>
        `;
        
        // 添加点击事件
        suggestionsDiv.addEventListener('click', (e) => {
            const btn = e.target.closest('.suggested-question-btn');
            if (btn) {
                const question = btn.dataset.question;
                this.fillQuestion(question);
            }
        });
        
        container.appendChild(suggestionsDiv);
        this.scrollToBottom();
    }
    
    bindEvents() {
        console.log('开始绑定事件...');
        
        // 侧边栏相关
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                console.log('侧边栏切换按钮被点击');
                this.toggleSidebar();
            });
        }
        
        const newChatBtn = document.getElementById('newChatBtn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                console.log('新建对话按钮被点击');
                this.createNewConversation();
            });
        }
        
        // 认证相关
        const loginBtn = document.getElementById('loginBtn');
        console.log('登录按钮元素:', loginBtn);
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                console.log('登录按钮被点击');
                this.showAuthModal('login');
            });
        } else {
            console.error('登录按钮元素未找到');
        }
        
        const logoutBtn = document.getElementById('logoutBtn');
        console.log('退出按钮元素:', logoutBtn);
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('退出按钮被点击');
                this.logout();
            });
        } else {
            console.error('退出按钮元素未找到');
        }
        
        const closeAuth = document.getElementById('closeAuth');
        if (closeAuth) {
            closeAuth.addEventListener('click', () => {
                console.log('关闭认证模态框按钮被点击');
                this.hideAuthModal();
            });
        }
        
        const authSwitchLink = document.getElementById('authSwitchLink');
        if (authSwitchLink) {
            authSwitchLink.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('认证模式切换链接被点击');
                this.toggleAuthMode();
            });
        }
        
        const authForm = document.getElementById('authForm');
        if (authForm) {
            authForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('认证表单提交');
                this.handleAuth();
            });
        }
        
        // 消息输入
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.handleInputChange();
            });
            
            messageInput.addEventListener('keydown', (e) => {
                console.log('键盘事件:', e.key, 'Shift键:', e.shiftKey);
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    console.log('Enter键发送触发');
                    this.sendMessage();
                }
            });
        }
        
        const sendBtn = document.getElementById('sendBtn');
        console.log('发送按钮元素:', sendBtn);
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                console.log('发送按钮被点击');
                this.sendMessage();
            });
            console.log('发送按钮事件监听器已绑定');
        } else {
            console.error('发送按钮元素未找到');
        }
        
        // 文件上传
        const attachBtn = document.getElementById('attachBtn');
        if (attachBtn) {
            attachBtn.addEventListener('click', () => {
                document.getElementById('fileInput')?.click();
            });
        }
        
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
            });
        }
        
        // 语音功能
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                this.toggleVoiceRecording();
            });
        }
        
        // 建议提示
        document.querySelectorAll('.prompt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const prompt = e.target.getAttribute('data-prompt');
                if (prompt) {
                    const messageInput = document.getElementById('messageInput');
                    if (messageInput) {
                        messageInput.value = prompt;
                        this.handleInputChange();
                    }
                }
            });
        });
        
        // 模态框点击外部关闭
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.addEventListener('click', (e) => {
                if (e.target.id === 'authModal') {
                    this.hideAuthModal();
                }
            });
        }
        
        // 右键菜单
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.message')) {
                e.preventDefault();
                this.showContextMenu(e, e.target.closest('.message'));
            }
        });
        
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });
        
        console.log('事件绑定完成');
    }
    
    setupMarkdownRenderer() {
        marked.setOptions({
            highlight: function(code, lang) {
                return code;
            },
            breaks: true,
            gfm: true
        });
    }
    
    // 认证相关方法
    async checkAuth() {
        // 检查本地token
        const token = localStorage.getItem('token');
        if (!token) {
            this.updateLoginState(false);
            return;
        }
        
        // 设置token到实例
        this.token = token;
        
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                // API Key 由服务器管理，直接加载对话
                this.updateLoginState(true);
                this.loadConversations();
            } else {
                localStorage.removeItem('token');
                this.updateLoginState(false);
            }
        } catch (error) {
            console.error('验证token失败:', error);
            localStorage.removeItem('token');
            this.updateLoginState(false);
        }
    }

    // 检查URL中的邀请码参数
    checkInviteCode() {
        // 如果用户已登录，不需要处理邀请码
        if (this.currentUser) {
            console.log('用户已登录，跳过邀请码检查');
            return;
        }

        // 解析URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const inviteCode = urlParams.get('invite') || urlParams.get('inviteCode');

        if (inviteCode) {
            console.log('检测到邀请码:', inviteCode);

            // 延迟一小段时间后打开注册界面，确保页面已完全初始化
            setTimeout(() => {
                this.showAuthModal('register', inviteCode);
                console.log('已自动打开注册界面并预填邀请码');
            }, 300);

            // 清理URL参数（可选，避免刷新页面时重复打开）
            // window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    showAuthModal(mode = 'login', inviteCode = null) {
        const modal = document.getElementById('authModal');
        const title = document.getElementById('authTitle');
        const submitBtn = document.getElementById('authSubmit');
        const switchText = document.getElementById('authSwitchText');
        const switchLink = document.getElementById('authSwitchLink');
        const usernameGroup = document.getElementById('usernameGroup');
        const emailGroup = document.getElementById('emailGroup');
        const inviteCodeGroup = document.getElementById('inviteCodeGroup');
        const loginUsernameGroup = document.querySelector('[for="loginUsername"]').parentElement;

        // 设置当前认证模式
        this.currentAuthMode = mode;
        console.log('设置认证模式为:', mode);

        // 获取输入字段
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const inviteCodeInput = document.getElementById('inviteCodeReg');
        const loginUsernameInput = document.getElementById('loginUsername');

        if (mode === 'login') {
            title.textContent = '登录';
            submitBtn.textContent = '登录';
            switchText.textContent = '还没有账户？';
            switchLink.textContent = '注册';
            usernameGroup.style.display = 'none';
            emailGroup.style.display = 'none';
            inviteCodeGroup.style.display = 'none';
            loginUsernameGroup.style.display = 'block';

            // 移除隐藏字段的required属性
            usernameInput.removeAttribute('required');
            emailInput.removeAttribute('required');
            loginUsernameInput.setAttribute('required', '');
        } else {
            title.textContent = '注册';
            submitBtn.textContent = '注册';
            switchText.textContent = '已有账户？';
            switchLink.textContent = '登录';
            usernameGroup.style.display = 'block';
            emailGroup.style.display = 'block';
            inviteCodeGroup.style.display = 'block';
            loginUsernameGroup.style.display = 'none';

            // 设置显示字段的required属性
            usernameInput.setAttribute('required', '');
            emailInput.setAttribute('required', '');
            loginUsernameInput.removeAttribute('required');

            // 如果有邀请码，预填到输入框
            if (inviteCode && inviteCodeInput) {
                inviteCodeInput.value = inviteCode;
            }
        }

        modal.classList.add('show');
    }
    
    hideAuthModal() {
        document.getElementById('authModal').classList.remove('show');
        document.getElementById('authForm').reset();
        document.getElementById('authError').style.display = 'none';
    }
    
    toggleAuthMode() {
        const newMode = this.currentAuthMode === 'login' ? 'register' : 'login';
        this.showAuthModal(newMode);
    }
    
    async handleAuth() {
        const form = document.getElementById('authForm');
        const formData = new FormData(form);
        const errorDiv = document.getElementById('authError');

        console.log('表单提交处理开始');
        console.log('当前认证模式:', this.currentAuthMode);

        errorDiv.style.display = 'none';

        let data;
        if (this.currentAuthMode === 'login') {
            data = {
                username: formData.get('loginUsername'),
                password: formData.get('password')
            };
        } else {
            data = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password')
            };

            // 添加邀请码（如果有）
            const inviteCode = formData.get('inviteCode');
            if (inviteCode && inviteCode.trim()) {
                data.inviteCode = inviteCode.trim();
            }
        }

        console.log('表单数据提取结果:', {
            mode: this.currentAuthMode,
            formEntries: [...formData.entries()],
            extractedData: { ...data, password: data.password ? '***' : 'empty' }
        });

        // 验证必填字段
        if (!data.username || !data.password) {
            console.error('缺少必填字段:', data);
            errorDiv.textContent = '请填写所有必填字段';
            errorDiv.style.display = 'block';
            return;
        }

        if (this.currentAuthMode === 'register' && !data.email) {
            console.error('注册时缺少邮箱');
            errorDiv.textContent = '请填写邮箱地址';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`/api/auth/${this.currentAuthMode}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            console.log('认证响应状态:', response.status);

            const result = await response.json();
            console.log('认证响应数据:', result);

            if (response.ok) {
                this.token = result.token;
                this.currentUser = result.user;
                localStorage.setItem('token', this.token);

                this.hideAuthModal();
                this.updateLoginState(true);
                this.loadConversations();

                // 加载积分信息
                if (window.PointsSystem && window.PointsSystem.load) {
                    window.PointsSystem.load();
                }

                this.showNotification(`${this.currentAuthMode === 'login' ? '登录' : '注册'}成功！`);
            } else {
                errorDiv.textContent = result.error || '认证失败';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('认证失败:', error);
            errorDiv.textContent = `网络错误: ${error.message}`;
            errorDiv.style.display = 'block';
        }
    }
    
    logout() {
        this.token = null;
        this.currentUser = null;
        this.conversations = [];
        this.currentConversation = null;

        localStorage.removeItem('token');
        this.updateLoginState(false);
        this.clearMessages();

        this.showWelcomeScreen();
    }
    
    updateLoginState(loggedIn) {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const username = document.getElementById('currentUsername');
        const avatar = document.querySelector('.user-avatar');

        if (loggedIn && this.currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            if (username) username.textContent = this.currentUser.username;
            if (avatar) avatar.textContent = this.currentUser.username.charAt(0).toUpperCase();

            // 使用UserSettings更新用户信息显示（包括头像）
            if (window.UserSettings && window.UserSettings.updateUserInfo) {
                window.UserSettings.updateUserInfo(this.currentUser);
            }

            // 加载积分信息
            if (window.PointsSystem && window.PointsSystem.load) {
                window.PointsSystem.load();
            }
        } else {
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (username) username.textContent = '未登录';
            if (avatar) avatar.textContent = '?';

            // 隐藏积分显示
            const pointsDisplay = document.getElementById('pointsDisplay');
            const inputPointsBadge = document.getElementById('inputPointsBadge');
            if (pointsDisplay) pointsDisplay.style.display = 'none';
            if (inputPointsBadge) inputPointsBadge.style.display = 'none';
        }
    }
    
    // 对话管理
    async loadConversations() {
        if (!this.currentUser) return;
        
        try {
            const response = await fetch('/api/conversations', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.conversations = data.conversations || [];
                this.renderConversations();
            } else {
                console.error('获取对话列表失败:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('加载对话列表失败:', error);
        }
    }
    
    renderConversations() {
        const container = document.getElementById('conversationsList');
        
        if (this.conversations.length === 0) {
            container.innerHTML = '<div class="no-conversations">暂无对话记录</div>';
            return;
        }
        
        const html = this.conversations.map(conv => `
            <div class="conversation-item ${conv.id === this.currentConversation?.id ? 'active' : ''}" 
                 data-id="${conv.id}">
                <div class="conversation-content" onclick="app.loadConversation('${conv.id}')">
                    <div class="conversation-title">${this.escapeHtml(conv.title)}</div>
                    <div class="conversation-preview">${conv.last_message ? this.escapeHtml(conv.last_message.substring(0, 50) + '...') : '新对话'}</div>
                </div>
                <div class="conversation-time">${this.formatTime(conv.updated_at)}</div>
                <div class="conversation-actions">
                    <button class="action-btn" onclick="app.renameConversation('${conv.id}')" title="重命名">
                        ✏️
                    </button>
                    <button class="action-btn" onclick="app.deleteConversation('${conv.id}')" title="删除">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    async createNewConversation() {
        console.log('createNewConversation 被调用');
        if (!this.currentUser) {
            console.warn('用户未登录');
            return;
        }
        
        try {
            // 使用我们自己的创建对话API
            const response = await fetch('/api/conversations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: '新的对话'
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentConversation = data;
                console.log('创建新对话成功:', this.currentConversation);
                this.clearMessages();
                this.hideWelcomeScreen();
                this.updateConversationTitle(data.title);
                // 刷新对话列表
                this.loadConversations();
            } else {
                console.error('创建对话失败:', response.status, response.statusText);
                this.showNotification('创建对话失败', 'error');
            }
        } catch (error) {
            console.error('创建对话失败:', error);
            this.showNotification('创建对话失败', 'error');
        }
    }
    
    async loadConversation(conversationId) {
        if (!this.currentUser) return;
        
        try {
            // 使用我们自己的API获取历史会话
            const response = await fetch(`/api/conversations/${conversationId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                this.currentConversation = data.conversation;
                this.clearMessages();
                this.hideWelcomeScreen();
                
                // 渲染消息 - addMessage 方法会自动处理 <think> 标签
                data.messages.forEach(message => {
                    this.addMessage(message);
                });
                
                this.updateConversationTitle(this.currentConversation.title);
                this.renderConversations();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('加载对话失败:', error);
            this.showNotification('加载对话失败: ' + error.message, 'error');
        }
    }
    
    async deleteConversation(conversationId) {
        if (!confirm('确定要删除这个对话吗？')) return;
        
        try {
            // 使用我们自己的删除对话API
            const response = await fetch(`/api/conversations/${conversationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.conversations = this.conversations.filter(conv => conv.id !== conversationId);
                
                if (this.currentConversation?.id === conversationId) {
                    this.currentConversation = null;
                    this.clearMessages();
                    this.showWelcomeScreen();
                }
                
                this.renderConversations();
                this.showNotification('对话已删除');
            } else {
                const errorText = await response.text();
                console.error('API返回错误:', response.status, errorText);
                this.showNotification('删除对话失败: ' + response.status, 'error');
            }
        } catch (error) {
            console.error('删除对话失败:', error);
            this.showNotification('删除对话失败', 'error');
        }
    }
    
    async renameConversation(conversationId) {
        const conversation = this.conversations.find(conv => conv.id === conversationId);
        if (!conversation) return;
        
        const newTitle = prompt('请输入新的对话标题:', conversation.title);
        if (!newTitle || newTitle === conversation.title) return;
        
        try {
            // 使用我们自己的重命名对话API
            const response = await fetch(`/api/conversations/${conversationId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    title: newTitle
                })
            });
            
            if (response.ok) {
                conversation.title = newTitle;
                
                if (this.currentConversation?.id === conversationId) {
                    this.currentConversation.title = newTitle;
                    this.updateConversationTitle(newTitle);
                }
                
                this.renderConversations();
                this.showNotification('对话已重命名');
            } else {
                const errorData = await response.json();
                console.error('API返回错误:', errorData);
                this.showNotification('重命名失败: ' + (errorData.error || response.statusText), 'error');
            }
        } catch (error) {
            console.error('重命名对话失败:', error);
            this.showNotification('重命名失败', 'error');
        }
    }
    
    // 消息处理
    async sendMessage() {
        console.log('sendMessage 方法被调用');
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        console.log('输入内容:', content);
        console.log('是否正在生成:', this.isGenerating);
        console.log('当前用户:', this.currentUser);
        console.log('API Key状态:', this.apiKey ? '已配置' : '未配置');
        
        if (!content || this.isGenerating) {
            console.log('发送被阻止 - 内容为空或正在生成');
            return;
        }
        
        if (!this.currentUser) {
            console.log('用户未登录');
            this.showAuthModal('login');
            return;
        }
        
        console.log('验证通过，继续处理消息...');
        
        // 如果没有当前对话，创建一个新对话
        if (!this.currentConversation) {
            console.log('没有当前对话，创建新对话...');
            await this.createNewConversation();
        }
        
        console.log('当前对话状态:', this.currentConversation);
        if (!this.currentConversation) {
            console.error('对话创建失败，无法发送消息');
            return;
        }
        
        // 清空输入框
        console.log('清空输入框并隐藏欢迎屏幕...');
        input.value = '';
        this.handleInputChange();
        this.hideWelcomeScreen();
        
        // 添加用户消息
        console.log('添加用户消息到界面...');
        this.addMessage({
            role: 'user',
            content: content,
            created_at: new Date().toISOString()
        });
        
        // 开始生成
        console.log('设置生成状态...');
        this.isGenerating = true;
        this.currentTaskId = null; // 初始化任务ID
        this.updateSendButton();
        
        const statusMessage = this.addStatusMessage('AI正在思考中...', 'loading');
        
        console.log('准备发送API请求...');
        const requestBody = {
            content: content,  // 后端期望 content 字段
            files: this.getAttachedFiles()
        };
        
        console.log('请求体:', JSON.stringify(requestBody, null, 2));
        
        try {
            const response = await fetch(`/api/conversations/${this.currentConversation.id}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('API请求已发送，响应状态:', response.status);
            if (!response.ok) {
                console.error('API请求失败:', response.status, response.statusText);
                
                // 尝试读取错误响应体
                const errorText = await response.text();
                console.error('错误响应体:', errorText);
                
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }
            
            console.log('API响应正常，准备处理流式数据...');
            // 移除状态消息
            statusMessage.remove();
            
            // 处理流式响应
            await this.handleStreamResponse(response);
            console.log('流式响应处理完成');
            
        } catch (error) {
            console.error('发送消息失败:', error);
            statusMessage.className = 'status-message error';
            statusMessage.textContent = `发送失败: ${error.message}`;
        } finally {
            this.isGenerating = false;
            this.updateSendButton();
            this.clearAttachedFiles();
        }
    }
    
    async handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // 改进的状态管理
        const streamState = {
            assistantMessage: null,
            fullResponse: '',
            thinkingMessages: {}, // 支持多个思考消息，使用键值对
            toolCallMessage: null,
            currentThinkingContent: '',
            isInThinkTag: false,
            thinkTagBuffer: '',
            answerBuffer: '',
            phase: 'init', // init, thinking, tool_calling, answering, completed
            thinkingCount: 0,
            toolCallCount: 0, // 支持多个工具调用
            lastEventType: null, // 跟踪最后的事件类型
            pendingThinking: '', // 待处理的思考内容
            messageGroup: null, // 消息组容器，确保正确的显示顺序
            messageGroupId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 消息组ID
            processedThoughts: new Set(), // 跟踪已处理的思考内容（按position）
            componentOrder: [], // 组件显示顺序 ['thinking_1', 'tool_1', 'thinking_2', 'answer']
            isThinkingComplete: new Map() // 跟踪各个思考段是否完成
        };
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6);
                            if (jsonStr.trim() === '') continue;
                            
                            const data = JSON.parse(jsonStr);
                            this.processSSEEvent(data, streamState);
                            
                        } catch (parseError) {
                            console.warn('解析SSE数据失败:', parseError);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
            this.loadConversations();
        }
    }
    
    processSSEEvent(data, streamState) {
        console.log('处理SSE事件:', data.event, {
            position: data.position,
            hasThought: !!data.thought,
            hasAnswer: !!data.answer,
            hasTool: !!data.tool,
            hasObservation: !!data.observation
        });
        
        // 捕获task_id用于停止生成
        if (data.task_id && !this.currentTaskId) {
            this.currentTaskId = data.task_id;
            console.log('捕获到task_id:', this.currentTaskId);
        }
        
        // 更新conversation_id（首次响应时获得）
        // SSE响应中的conversation_id是Dify的ID，由后端管理
        // 前端不应该用它来创建或修改对话对象
        
        streamState.lastEventType = data.event;
        
        switch (data.event) {
            case 'agent_thought':
                this.handleAgentThought(data, streamState);
                break;
                
            case 'agent_message':
            case 'message':
                this.handleAgentMessage(data, streamState);
                break;
                
            case 'message_end':
                this.handleMessageEnd(data, streamState);
                break;
                
            case 'ping':
                // 心跳事件，保持连接活跃
                console.log('收到ping事件');
                break;
                
            case 'error':
                throw new Error(data.message || '未知错误');
                
            default:
                console.log('未处理的SSE事件类型:', data.event, data);
        }
    }
    
    handleAgentThought(data, streamState) {
        // 确保有消息组
        if (!streamState.messageGroup) {
            streamState.messageGroup = this.createMessageGroup(streamState.messageGroupId);
        }
        
        const position = data.position || 1;
        const thoughtKey = `thought_${position}`;
        
        console.log('处理agent_thought事件:', {
            position,
            hasThought: !!data.thought,
            hasTool: !!data.tool,
            hasObservation: !!data.observation,
            purpose: 'status_check_only'
        });
        
        // agent_thought只用于状态检查，不展示思考内容
        // 标记该position的思考已完成
        if (data.thought) {
            streamState.processedThoughts.add(position);
            streamState.isThinkingComplete.set(position, true);
            console.log(`标记思考段 ${position} 为完成状态（不展示内容）`);
        }
        
        // 处理工具调用
        if (data.tool && data.tool_input) {
            const toolKey = `tool_${streamState.toolCallCount + 1}`;
            
            // 检查是否已经创建了工具调用
            if (!streamState.toolCallMessage || streamState.toolCallMessage.dataset.toolName !== data.tool) {
                streamState.toolCallCount++;
                
                // 添加到组件顺序中
                if (!streamState.componentOrder.includes(toolKey)) {
                    this.insertComponentInOrder(streamState, toolKey, position + 0.5); // 工具调用在思考后
                }
                
                // 创建工具调用消息
                streamState.toolCallMessage = this.addToolCallToGroup(
                    streamState.messageGroup, 
                    data.tool, 
                    data.tool_input
                );
                streamState.toolCallMessage.dataset.toolName = data.tool; // 标记工具名称避免重复
                streamState.phase = 'tool_calling';
                
                console.log(`创建工具调用: ${data.tool}`);
            } else {
                console.log(`跳过重复的工具调用: ${data.tool}`);
            }
        }
        
        // 处理工具执行完成
        if (data.observation && streamState.toolCallMessage) {
            const statusSpan = streamState.toolCallMessage.querySelector('.tool-status');
            if (statusSpan && !statusSpan.classList.contains('completed')) {
                statusSpan.textContent = '执行完成';
                statusSpan.classList.add('completed');
                console.log('工具执行完成');
            }
        }
    }
    
    // 从文本中提取思考内容
    extractThinkingFromText(text) {
        let thinking = '';
        let answer = '';
        
        if (!text) {
            return { thinking: '', answer: '' };
        }
        
        // 查找<think>标签
        const thinkStartMatch = text.match(/<think>/);
        const thinkEndMatch = text.match(/<\/think>/);
        
        if (thinkStartMatch && thinkEndMatch) {
            const startIndex = thinkStartMatch.index + 7; // <think> 长度为 7
            const endIndex = thinkEndMatch.index;
            
            if (startIndex < endIndex) {
                thinking = text.substring(startIndex, endIndex);
                // 提取标签前后的内容作为答案
                answer = text.substring(0, thinkStartMatch.index) + text.substring(thinkEndMatch.index + 8);
            }
        } else if (thinkStartMatch) {
            // 只有开始标签，提取从标签开始的内容
            const startIndex = thinkStartMatch.index + 7;
            thinking = text.substring(startIndex);
        } else {
            // 没有思考标签，整个文本作为答案
            answer = text;
        }
        
        return { thinking: thinking.trim(), answer: answer.trim() };
    }
    
    handleAgentMessage(data, streamState) {
        if (!data.answer) return;
        
        const answerChunk = data.answer;
        
        // 初始化streamState属性
        streamState.thinkingMessages = streamState.thinkingMessages || {};
        streamState.thinkingCount = streamState.thinkingCount || 0;
        streamState.currentThinkingContent = streamState.currentThinkingContent || '';
        streamState.fullResponse = streamState.fullResponse || '';
        streamState.phase = streamState.phase || 'answering';
        
        // 如果没有消息组，创建一个
        if (!streamState.messageGroup) {
            streamState.messageGroup = this.createMessageGroup(streamState.messageGroupId);
        }
        
        console.log('处理agent_message事件:', {
            answerLength: answerChunk.length,
            phase: streamState.phase,
            hasThinkTag: answerChunk.includes('<think>')
        });
        
        // 改进的思考内容分离逻辑
        const result = this.advancedThinkingSeparation(answerChunk, streamState);
        
        // 处理思考内容 - 只有在没有被agent_thought处理过的情况下才处理
        if (result.thinking && streamState.currentThinkingContent !== undefined) {
            streamState.currentThinkingContent += result.thinking;
            
            // 检查当前思考段是否已经在agent_thought中处理过
            const currentThinkingPosition = streamState.thinkingCount + 1;
            const isAlreadyProcessed = streamState.processedThoughts.has(currentThinkingPosition);
            
            if (!isAlreadyProcessed) {
                // 为当前思考段创建消息键
                const thinkingKey = `message_think_${streamState.thinkingCount}`;
                
                // 检查是否需要创建新的思考消息
                if (streamState.currentThinkingContent && !streamState.thinkingMessages[thinkingKey]) {
                    const thinkingMessage = this.addThinkingToGroup(
                        streamState.messageGroup, 
                        streamState.currentThinkingContent, 
                        streamState.thinkingCount + 1,
                        false // 暂不自动折叠
                    );
                    streamState.thinkingMessages[thinkingKey] = thinkingMessage;
                    console.log(`创建流式思考内容 ${streamState.thinkingCount + 1}`);
                } else if (streamState.thinkingMessages[thinkingKey]) {
                    this.updateThinkingMessage(streamState.thinkingMessages[thinkingKey], streamState.currentThinkingContent);
                }
            } else {
                console.log(`跳过重复的思考内容，position: ${currentThinkingPosition}`);
            }
        }
        
        // 检查思考标签是否完成
        if (result.thinkingCompleted) {
            const completedPosition = streamState.thinkingCount + 1;
            streamState.isThinkingComplete.set(completedPosition, true);
            streamState.thinkingCount++;
            streamState.currentThinkingContent = '';
            console.log(`思考段 ${completedPosition} 完成`);
        }
        
        // 处理回答内容
        if (result.answer) {
            streamState.fullResponse += result.answer;
            
            // 确保答案在最后
            const answerKey = 'answer';
            if (!streamState.componentOrder.includes(answerKey)) {
                streamState.componentOrder.push(answerKey);
            }
            
            if (!streamState.assistantMessage) {
                streamState.assistantMessage = this.addAssistantMessageToGroup(streamState.messageGroup, streamState.fullResponse);
                streamState.phase = 'answering';
                console.log('创建助手回答消息');
            } else {
                this.updateMessageContent(streamState.assistantMessage, streamState.fullResponse);
            }
        }
    }
    
    handleMessageEnd(data, streamState) {
        streamState.phase = 'completed';
        
        // 完成最后的助手消息，并添加操作按钮
        if (streamState.assistantMessage) {
            this.finalizeMessage(streamState.assistantMessage);
            
            // 为助手消息添加操作按钮，优先使用本地消息ID
            const messageId = data.local_message_id || data.message_id;
            if (messageId) {
                streamState.assistantMessage.dataset.messageId = messageId;
                streamState.assistantMessage.dataset.difyMessageId = data.message_id;
                
                // 添加消息操作按钮，使用本地消息ID
                const messageContent = streamState.assistantMessage.querySelector('.message-content');
                if (messageContent) {
                    const actionsHtml = this.createMessageActions(messageId);
                    messageContent.insertAdjacentHTML('beforeend', actionsHtml);
                }
            }
        }
        
        // 完成所有思考消息并设置延迟自动折叠
        Object.entries(streamState.thinkingMessages || {}).forEach(([key, thinkingMessage]) => {
            if (thinkingMessage) {
                this.finalizeMessage(thinkingMessage);
                
                // 只有确认思考完成的消息才自动折叠
                const position = this.extractPositionFromKey(key);
                const isComplete = streamState.isThinkingComplete.get(position);
                
                if (isComplete) {
                    // 延迟3秒后自动折叠已完成的思考内容
                    setTimeout(() => {
                        if (!thinkingMessage.classList.contains('collapsed')) {
                            thinkingMessage.classList.add('collapsed');
                            console.log(`自动折叠思考内容 ${position}`);
                        }
                    }, 3000);
                }
            }
        });
        
        // 完成工具调用消息
        if (streamState.toolCallMessage) {
            this.finalizeMessage(streamState.toolCallMessage);
            const statusSpan = streamState.toolCallMessage.querySelector('.tool-status');
            if (statusSpan && !statusSpan.classList.contains('completed')) {
                statusSpan.textContent = '执行完成';
                statusSpan.classList.add('completed');
            }
        }
        
        console.log('SSE流结束，消息处理完成');
        console.log('组件顺序:', streamState.componentOrder);
        console.log('处理的思考消息数:', Object.keys(streamState.thinkingMessages || {}).length);
        console.log('最终回答长度:', streamState.fullResponse?.length || 0);
        
        // 更新当前对话信息
        if (this.currentConversation && data.conversation_id) {
            // 不需要手动更新 updated_at，这应该由后端处理
            
            // 如果对话还没有标题，可以考虑自动生成标题
            if (this.currentConversation.title === '新的对话' && streamState.assistantMessage) {
                // 可以使用第一条用户消息或助手回复的前几个字作为标题
                const userMessage = document.querySelector('.message.user .message-content');
                if (userMessage) {
                    const title = userMessage.textContent.slice(0, 20);
                    if (title.trim()) {
                        this.currentConversation.title = title.trim() + (title.length > 20 ? '...' : '');
                        this.updateConversationTitle(this.currentConversation.title);
                    }
                }
            }
            
            // 更新对话列表显示
            this.renderConversations();
        }
    }
    
    // 完成消息的流式状态
    finalizeMessage(messageElement) {
        if (messageElement && messageElement.classList.contains('streaming')) {
            messageElement.classList.remove('streaming');
            // 移除流式输入光标
            const cursor = messageElement.querySelector('.streaming-cursor');
            if (cursor) {
                cursor.remove();
            }
        }
    }
    
    // 组件顺序管理
    insertComponentInOrder(streamState, componentKey, position) {
        // 按position排序插入组件
        const insertIndex = streamState.componentOrder.findIndex(key => {
            const keyPosition = this.extractPositionFromKey(key);
            return keyPosition > position;
        });
        
        if (insertIndex === -1) {
            // 在末尾插入
            streamState.componentOrder.push(componentKey);
        } else {
            // 在指定位置插入
            streamState.componentOrder.splice(insertIndex, 0, componentKey);
        }
        
        console.log(`插入组件 ${componentKey} (position: ${position})，顺序:`, streamState.componentOrder);
    }
    
    // 从key中提取position
    extractPositionFromKey(key) {
        if (key === 'answer') return 999; // 答案始终在最后
        
        const match = key.match(/(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
        
        if (key.startsWith('tool_')) return 998; // 工具调用在答案之前
        return 0;
    }
    
    advancedThinkingSeparation(text, streamState) {
        let answer = '';
        let thinking = '';
        let thinkingCompleted = false;
        
        streamState.thinkTagBuffer = streamState.thinkTagBuffer || '';
        streamState.answerBuffer = streamState.answerBuffer || '';
        
        const fullText = streamState.thinkTagBuffer + text;
        
        for (let i = 0; i < fullText.length; i++) {
            // 检查是否进入思考标签
            if (!streamState.isInThinkTag && fullText.substr(i, 7) === '<think>') {
                streamState.isInThinkTag = true;
                i += 6;
                continue;
            }
            
            // 检查是否退出思考标签
            if (streamState.isInThinkTag && fullText.substr(i, 8) === '</think>') {
                streamState.isInThinkTag = false;
                thinkingCompleted = true;
                i += 7;
                continue;
            }
            
            // 根据当前状态分配字符
            if (streamState.isInThinkTag) {
                thinking += fullText[i];
            } else {
                answer += fullText[i];
            }
        }
        
        // 清空缓冲区
        streamState.thinkTagBuffer = '';
        
        return { answer, thinking, thinkingCompleted };
    }
    
    separateThinking(text) {
        let answer = '';
        let thinking = '';
        let isInThinkTag = false;
        
        for (let i = 0; i < text.length; i++) {
            if (!isInThinkTag && text.substr(i, 7) === '<think>') {
                isInThinkTag = true;
                i += 6;
                continue;
            }
            
            if (isInThinkTag && text.substr(i, 8) === '</think>') {
                isInThinkTag = false;
                i += 7;
                continue;
            }
            
            if (isInThinkTag) {
                thinking += text[i];
            } else {
                answer += text[i];
            }
        }
        
        return { answer, thinking };
    }
    
    // UI渲染方法
    addMessage(message) {
        const container = document.getElementById('messagesContainer');

        // 检查是否包含 <think> 标签，如果有则分离处理
        let content = message.content || '';
        let thinkingContent = '';

        if (message.role === 'assistant') {
            // 如果消息包含 <think> 标签，进行分离
            if (content.includes('<think>')) {
                const separated = this.separateThinkingContent(content);
                content = separated.answer;
                thinkingContent = separated.thinking;
            }

            // 如果有思考内容，先添加思考部分
            if (thinkingContent) {
                this.addThinkingMessage(thinkingContent);
            }

            // 检查是否有工具调用信息 (从metadata解析或从消息内容中提取)
            this.extractAndRenderToolCalls(message, content);
        }

        // 创建消息元素
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        messageDiv.dataset.messageId = message.id;

        // 使用UserSettings获取用户头像HTML
        let avatar;
        if (message.role === 'user') {
            if (window.UserSettings && window.UserSettings.getUserAvatarHTML) {
                avatar = window.UserSettings.getUserAvatarHTML(this.currentUser);
            } else {
                avatar = this.currentUser?.username?.charAt(0).toUpperCase() || 'U';
            }
        } else {
            avatar = '<img src="logo.png" alt="AI" class="avatar-logo">';
        }

        const roleName = message.role === 'user' ? '您' : 'AI助手';

        // 先创建消息框架（不包含内容）
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatar}</div>
                <div class="message-info">
                    <div class="message-role">${roleName}</div>
                    <div class="message-time">${this.formatTime(message.created_at)}</div>
                </div>
            </div>
            <div class="message-content">
                ${message.role === 'assistant' ? '<div class="markdown-content"></div>' : ''}
                ${message.role === 'assistant' && message.id ? this.createMessageActions(message.id) : ''}
            </div>
        `;

        container.appendChild(messageDiv);

        // 添加消息内容
        const messageContent = messageDiv.querySelector('.message-content');
        if (message.role === 'assistant') {
            // 对于助手消息，直接在 DOM 上调用 renderMarkdownContent（保留事件监听器）
            const markdownContainer = messageContent.querySelector('.markdown-content');
            if (markdownContainer) {
                this.renderMarkdownContent(content, markdownContainer);
            }
        } else {
            // 对于用户消息，直接插入文本
            messageContent.textContent = message.content;
        }

        this.scrollToBottom();
        return messageDiv;
    }

    // 提取并渲染工具调用信息
    extractAndRenderToolCalls(message, content) {
        // 从Dify消息的agent_thoughts中提取工具调用
        if (message.agent_thoughts && message.agent_thoughts.length > 0) {
            message.agent_thoughts.forEach(thought => {
                // 检查是否有工具调用信息
                if (thought.tool && thought.tool_input) {
                    // 解析多个工具（用分号分隔）
                    const tools = thought.tool.split(';').filter(t => t.trim());

                    // 解析工具输入
                    let toolInputs = {};
                    try {
                        toolInputs = JSON.parse(thought.tool_input);
                    } catch (e) {
                        console.warn('解析工具输入失败:', e);
                        toolInputs = { [tools[0]]: thought.tool_input };
                    }

                    // 为每个工具创建UI
                    tools.forEach(toolName => {
                        if (toolName && toolInputs[toolName] !== undefined) {
                            this.renderHistoryToolCall({
                                name: toolName,
                                input: toolInputs[toolName],
                                result: thought.observation || null
                            });
                        }
                    });
                }
            });
        }

        // 兼容其他格式 - 从metadata中提取工具调用
        if (message.metadata) {
            try {
                const metadata = typeof message.metadata === 'string'
                    ? JSON.parse(message.metadata)
                    : message.metadata;

                if (metadata.tool_calls && metadata.tool_calls.length > 0) {
                    metadata.tool_calls.forEach(toolCall => {
                        this.renderHistoryToolCall(toolCall);
                    });
                }
            } catch (error) {
                console.warn('解析消息metadata失败:', error);
            }
        }

        // 兼容其他格式 - 从Dify消息的tools数组中提取工具调用
        if (message.tools && message.tools.length > 0) {
            message.tools.forEach(tool => {
                this.renderHistoryToolCall({
                    name: tool.tool_name,
                    input: tool.tool_input,
                    result: tool.tool_output || null
                });
            });
        }
    }

    // 渲染历史会话中的工具调用
    renderHistoryToolCall(toolCall) {
        const container = document.getElementById('messagesContainer');
        const toolDiv = document.createElement('div');
        toolDiv.className = 'tool-call-section';

        // 获取工具显示名称（优先使用中文标签）
        const toolDisplayName = this.getToolDisplayName(toolCall.name);

        let inputDisplay = '';
        try {
            if (typeof toolCall.input === 'string') {
                inputDisplay = toolCall.input;
            } else if (toolCall.input === null || toolCall.input === undefined) {
                inputDisplay = '无输入参数';
            } else {
                inputDisplay = JSON.stringify(toolCall.input, null, 2);
            }
        } catch (e) {
            inputDisplay = String(toolCall.input || '');
        }

        let resultDisplay = '';
        let hasResult = false;
        if (toolCall.result && toolCall.result.trim() !== '') {
            hasResult = true;
            try {
                if (typeof toolCall.result === 'string') {
                    resultDisplay = toolCall.result;
                } else {
                    resultDisplay = JSON.stringify(toolCall.result, null, 2);
                }
            } catch (e) {
                resultDisplay = String(toolCall.result);
            }
        }

        toolDiv.innerHTML = `
            <div class="tool-call-header">
                <span class="tool-icon">🔧</span>
                <span class="tool-name">${toolDisplayName}</span>
                <span class="tool-status completed">执行完成</span>
            </div>
            <div class="tool-input">
                <strong>输入参数:</strong>
                <pre>${this.escapeHtml(inputDisplay)}</pre>
            </div>
            ${hasResult ? `
            <div class="tool-result">
                <strong>执行结果:</strong>
                <div class="tool-result-content">
                    <pre>${this.escapeHtml(resultDisplay)}</pre>
                </div>
            </div>
            ` : ''}
        `;

        container.appendChild(toolDiv);
        this.scrollToBottom();
        return toolDiv;
    }

    // 获取工具显示名称
    getToolDisplayName(toolName) {
        const toolLabels = {
            'get_data': '📊 数据查询',
            'current_time': '⏰ 获取当前时间',
            'web_search': '🔍 网络搜索',
            'calculator': '🧮 计算器',
            'file_reader': '📄 文件读取',
            'image_analyzer': '🖼️ 图像分析'
        };

        return toolLabels[toolName] || `🔧 调用工具: ${toolName}`;
    }
    
    // 分离思考内容和回答内容（类似 difyService 的实现）
    separateThinkingContent(text) {
        if (!text) return { answer: '', thinking: '' };
        
        let answer = '';
        let thinking = '';
        let isInThinkTag = false;
        
        for (let i = 0; i < text.length; i++) {
            if (!isInThinkTag && text.substr(i, 7) === '<think>') {
                isInThinkTag = true;
                i += 6; // 跳过<think>标签
                continue;
            }
            
            if (isInThinkTag && text.substr(i, 8) === '</think>') {
                isInThinkTag = false;
                i += 7; // 跳过</think>标签
                continue;
            }
            
            if (isInThinkTag) {
                thinking += text[i];
            } else {
                answer += text[i];
            }
        }
        
        return { answer: answer.trim(), thinking: thinking.trim() };
    }
    
    // 创建消息操作按钮
    createMessageActions(messageId) {
        return `
            <div class="message-actions">
                <button class="action-btn like-btn" onclick="app.messageFeedback('${messageId}', 'like')" title="点赞">
                    <span class="action-icon">👍</span>
                </button>
                <button class="action-btn dislike-btn" onclick="app.messageFeedback('${messageId}', 'dislike')" title="点踩">
                    <span class="action-icon">👎</span>
                </button>
                <button class="action-btn suggest-btn" onclick="app.getSuggestedQuestions('${messageId}')" title="获取建议问题">
                    <span class="action-icon">💡</span>
                </button>
            </div>
        `;
    }
    
    // 消息反馈
    async messageFeedback(messageId, rating) {
        if (!this.currentUser) {
            this.showNotification('请先登录', 'error');
            return;
        }
        
        try {
            // 查找对应的消息元素
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            const actionBtns = messageElement?.querySelectorAll('.action-btn');
            
            const response = await fetch(`/api/messages/${messageId}/feedbacks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    rating: rating,
                    content: '' // 可以扩展为允许用户输入评论
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '反馈提交失败');
            }
            
            const result = await response.json();
            
            // 更新按钮状态
            if (actionBtns) {
                actionBtns.forEach(btn => {
                    btn.classList.remove('active');
                    if ((rating === 'like' && btn.classList.contains('like-btn')) ||
                        (rating === 'dislike' && btn.classList.contains('dislike-btn'))) {
                        btn.classList.add('active');
                    }
                });
            }
            
            // 显示成功提示
            this.showNotification(
                rating === 'like' ? '👍 感谢您的点赞！' : '👎 感谢您的反馈！', 
                'success'
            );
            
        } catch (error) {
            console.error('提交反馈失败:', error);
            this.showNotification(error.message || '反馈提交失败', 'error');
        }
    }
    
    // 获取建议问题
    async getSuggestedQuestions(messageId) {
        // TODO: 这个功能需要后端支持，暂时禁用
        console.log('获取建议问题功能暂时不可用');
        return;
        
        if (!this.currentUser) return;
        
        // 原代码已禁用 - 需要后端支持
    }
    
    // 显示建议问题
    showSuggestedQuestions(questions) {
        const container = document.getElementById('messagesContainer');
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggested-questions';
        
        const questionsHtml = questions.map(question => 
            `<button class="suggested-question" onclick="app.fillQuestion('${this.escapeHtml(question)}')">${this.escapeHtml(question)}</button>`
        ).join('');
        
        suggestionsDiv.innerHTML = `
            <div class="suggestions-header">💡 建议问题：</div>
            <div class="suggestions-list">${questionsHtml}</div>
        `;
        
        container.appendChild(suggestionsDiv);
        this.scrollToBottom();
    }
    
    // 填充建议问题到输入框
    fillQuestion(question) {
        const input = document.getElementById('messageInput');
        input.value = question;
        input.focus();
    }
    
    // 停止生成
    async stopGeneration() {
        // TODO: 这个功能需要后端支持，暂时禁用
        console.log('停止生成功能暂时不可用');
        this.isGenerating = false;
        this.updateSendButton();
        return;
        
        if (!this.currentTaskId) {
            console.log('没有进行中的任务可以停止');
            return;
        }
        
        // 原代码已禁用 - 需要后端支持
    }

    // 新的markdown渲染方法（与index.html保持一致）
    renderMarkdownContent(content, container) {
        if (!content || !content.trim()) {
            container.innerHTML = '';
            return;
        }

        // 彻底清理内容：移除所有多余空白
        const cleanedContent = this.aggressiveCleanContent(content);

        // 使用marked渲染
        container.innerHTML = marked.parse(cleanedContent);

        // 渲染后再次清理HTML中的空白
        this.cleanRenderedHTML(container);

        // 为代码块添加复制按钮
        this.addCopyButtonsToCodeBlocks(container);
    }

    // 为代码块添加复制按钮
    addCopyButtonsToCodeBlocks(container) {
        // 找到所有代码块 (pre > code)
        const codeBlocks = container.querySelectorAll('pre');

        codeBlocks.forEach((pre) => {
            // 检查是否已经添加过复制按钮
            if (pre.querySelector('.code-copy-btn')) {
                return;
            }

            // 为 pre 元素添加相对定位，以便按钮绝对定位
            pre.style.position = 'relative';

            // 创建复制按钮
            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-copy-btn';
            copyBtn.innerHTML = '<span class="copy-icon">📋</span><span class="copy-text">复制</span>';
            copyBtn.title = '复制代码';

            // 添加点击事件
            copyBtn.addEventListener('click', async () => {
                const code = pre.querySelector('code');
                const text = code ? code.textContent : pre.textContent;

                try {
                    // 使用 Clipboard API 复制文本
                    await navigator.clipboard.writeText(text);

                    // 更改按钮状态为已复制
                    copyBtn.innerHTML = '<span class="copy-icon">✓</span><span class="copy-text">已复制</span>';
                    copyBtn.classList.add('copied');

                    // 2秒后恢复按钮状态
                    setTimeout(() => {
                        copyBtn.innerHTML = '<span class="copy-icon">📋</span><span class="copy-text">复制</span>';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('复制失败:', err);
                    // 显示复制失败提示
                    copyBtn.innerHTML = '<span class="copy-icon">✗</span><span class="copy-text">失败</span>';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<span class="copy-icon">📋</span><span class="copy-text">复制</span>';
                    }, 2000);
                }
            });

            // 将按钮添加到 pre 元素中
            pre.appendChild(copyBtn);
        });
    }
    
    // 激进的内容清理方法
    aggressiveCleanContent(content) {
        if (!content) return '';
        
        // 1. 移除开头结尾空白
        let cleaned = content.trim();
        
        // 2. 将所有连续的空行压缩为单个换行
        cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
        
        // 3. 移除表格前的所有空行
        cleaned = cleaned.replace(/\n+(\|[^|\n]*\|)/g, '\n$1');
        
        // 4. 移除表格行之间的空行
        cleaned = cleaned.replace(/(\|[^|\n]*\|)\n+(\|[^|\n]*\|)/g, '$1\n$2');
        
        // 5. 移除标题前多余的空行（保留一个）
        cleaned = cleaned.replace(/\n{2,}(#{1,6}\s)/g, '\n\n$1');
        
        // 6. 移除代码块前多余的空行（保留一个）
        cleaned = cleaned.replace(/\n{2,}(```)/g, '\n\n$1');
        
        // 7. 最终清理：确保没有超过两个连续的换行
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        
        return cleaned;
    }
    
    // 清理渲染后的HTML
    cleanRenderedHTML(container) {
        // 1. 移除所有空的p标签
        const allPs = container.querySelectorAll('p');
        allPs.forEach(p => {
            const content = p.textContent || p.innerText || '';
            if (!content.trim()) {
                p.remove();
            }
        });
        
        // 2. 移除表格前的所有空白元素
        const tables = container.querySelectorAll('table');
        tables.forEach(table => {
            let prev = table.previousElementSibling;
            while (prev) {
                const isEmptyP = prev.tagName === 'P' && !prev.textContent.trim();
                const isEmptyDiv = prev.tagName === 'DIV' && !prev.textContent.trim();
                const isBr = prev.tagName === 'BR';
                
                if (isEmptyP || isEmptyDiv || isBr) {
                    const toRemove = prev;
                    prev = prev.previousElementSibling;
                    toRemove.remove();
                } else {
                    break;
                }
            }
            
            table.classList.add('cleaned-table');
        });
        
        // 3. 移除容器中的多余文本节点（纯空白）
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            node => {
                return node.nodeValue && node.nodeValue.trim() === '' && 
                       node.nodeValue.includes('\n') 
                       ? NodeFilter.FILTER_ACCEPT 
                       : NodeFilter.FILTER_REJECT;
            }
        );
        
        const emptyTextNodes = [];
        let node;
        while (node = walker.nextNode()) {
            emptyTextNodes.push(node);
        }
        emptyTextNodes.forEach(textNode => textNode.remove());
        
        // 4. 确保表格直接跟在内容后面
        tables.forEach(table => {
            if (table.previousSibling && table.previousSibling.nodeType === Node.TEXT_NODE) {
                const textContent = table.previousSibling.nodeValue;
                if (textContent && textContent.trim() === '') {
                    table.previousSibling.remove();
                }
            }
        });
    }

    // 优化Markdown内容，专门解决表格空白问题
    optimizeMarkdownContent(content) {
        if (!content) return '';
        
        // 首先移除开头结尾的空白和多余换行
        let cleaned = content.trim().replace(/\n{3,}/g, '\n\n');
        
        // 特别处理表格相关的空行问题
        cleaned = this.fixTableSpacing(cleaned);
        
        return cleaned;
    }
    
    // 修复表格间距问题 - 更强化版本
    fixTableSpacing(content) {
        const lines = content.split('\n');
        const result = [];
        let inCodeBlock = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // 代码块检测
            if (trimmedLine.startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                result.push(line);
                continue;
            }
            
            // 在代码块内，保持原样
            if (inCodeBlock) {
                result.push(line);
                continue;
            }
            
            // 空行处理 - 更严格的表格检测
            if (trimmedLine === '') {
                const nextLine = lines[i + 1]?.trim() || '';
                const prevLine = result[result.length - 1]?.trim() || '';
                
                // 如果下一行是表格行，完全跳过这个空行
                if (this.isTableLine(nextLine)) {
                    continue;
                }
                
                // 如果前一行是表格行，下一行不是，那么保留一个空行
                if (this.isTableLine(prevLine) && !this.isTableLine(nextLine) && nextLine !== '') {
                    if (result[result.length - 1]?.trim() !== '') {
                        result.push('');
                    }
                    continue;
                }
                
                // 其他情况，避免连续空行
                if (prevLine !== '') {
                    result.push('');
                }
                continue;
            }
            
            // 表格行处理 - 更严格
            if (this.isTableLine(trimmedLine)) {
                // 移除表格前的所有空行
                while (result.length > 0 && result[result.length - 1].trim() === '') {
                    result.pop();
                }
                result.push(line.trim());
                continue;
            }
            
            // 普通行
            result.push(line.trim());
        }
        
        // 最后清理：严格处理表格间距
        const finalLines = [];
        let tableStarted = false;
        
        for (let i = 0; i < result.length; i++) {
            const line = result[i];
            const isTable = this.isTableLine(line);
            const nextLine = result[i + 1];
            const isNextTable = nextLine ? this.isTableLine(nextLine) : false;
            
            finalLines.push(line);
            
            if (isTable) {
                tableStarted = true;
                // 表格行之间不加空行
                if (isNextTable) {
                    continue;
                }
                // 表格结束后，如果后面有内容且不是空行，添加一个空行
                if (nextLine && nextLine.trim() !== '') {
                    finalLines.push('');
                }
                tableStarted = false;
            } else if (line.trim() === '' && tableStarted) {
                // 表格中间的空行，移除
                finalLines.pop();
            }
        }
        
        return finalLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    
    // 判断是否为表格行
    isTableLine(line) {
        if (!line) return false;
        const trimmed = line.trim();
        
        // 表格行：以|开头和结尾，或者是分隔行（包含-和|）
        return trimmed.startsWith('|') && trimmed.endsWith('|') ||
               (trimmed.includes('|') && trimmed.includes('-') && trimmed.match(/^[\s\|\-:]+$/));
    }
    
    addThinkingMessage(content, index = 1) {
        const container = document.getElementById('messagesContainer');
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-section';
        
        // 如果内容包含markdown，进行渲染
        let processedContent;
        if (content.includes('|') || content.includes('#') || content.includes('```')) {
            // 创建临时容器进行markdown渲染
            const tempContainer = document.createElement('div');
            this.renderMarkdownContent(content, tempContainer);
            processedContent = tempContainer.innerHTML;
        } else {
            // 普通文本内容
            processedContent = this.escapeHtml(content);
        }
        
        thinkingDiv.innerHTML = `
            <div class="thinking-header">
                <span class="thinking-icon">🤔</span>
                <span class="thinking-title">AI思考过程 ${index > 1 ? index : ''}</span>
                <button class="thinking-toggle" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                    <span>收起</span>
                </button>
            </div>
            <div class="thinking-content">${processedContent}</div>
        `;
        container.appendChild(thinkingDiv);
        this.scrollToBottom();
        return thinkingDiv;
    }
    
    updateThinkingMessage(thinkingElement, content) {
        const contentDiv = thinkingElement.querySelector('.thinking-content');
        if (contentDiv) {
            contentDiv.textContent = content;
        }
        this.scrollToBottom();
    }
    
    addToolCallMessage(toolName, toolInput) {
        const container = document.getElementById('messagesContainer');
        const toolDiv = document.createElement('div');
        toolDiv.className = 'tool-call-section';
        
        let inputDisplay = '';
        try {
            if (typeof toolInput === 'string') {
                inputDisplay = toolInput;
            } else {
                inputDisplay = JSON.stringify(toolInput, null, 2);
            }
        } catch (e) {
            inputDisplay = String(toolInput);
        }
        
        toolDiv.innerHTML = `
            <div class="tool-call-header">
                <span class="tool-icon">🔧</span>
                <span class="tool-name">调用工具: ${this.escapeHtml(toolName)}</span>
                <span class="tool-status">执行中...</span>
            </div>
            <div class="tool-input">
                <strong>输入参数:</strong>
                <pre>${this.escapeHtml(inputDisplay)}</pre>
            </div>
            <div class="tool-result" style="display: none;">
                <strong>执行结果:</strong>
                <div class="tool-result-content"></div>
            </div>
        `;
        
        container.appendChild(toolDiv);
        this.scrollToBottom();
        return toolDiv;
    }
    
    updateToolCallResult(toolElement, result) {
        const statusSpan = toolElement.querySelector('.tool-status');
        const resultDiv = toolElement.querySelector('.tool-result');
        const resultContent = toolElement.querySelector('.tool-result-content');

        if (statusSpan) {
            statusSpan.textContent = '执行完成';
            statusSpan.className = 'tool-status completed';
        }

        if (resultDiv && resultContent) {
            resultContent.innerHTML = `<pre>${this.escapeHtml(result)}</pre>`;
            resultDiv.style.display = 'block';
        }

        this.scrollToBottom();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 解析Markdown内容
    parseMarkdown(text) {
        if (typeof marked !== 'undefined') {
            return marked.parse(text);
        }
        return this.escapeHtml(text);
    }
    
    // 隐藏欢迎屏幕
    hideWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
    }
    
    // 显示参数错误
    showParameterError() {
        const container = document.getElementById('messagesContainer');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'parameter-error';
        errorDiv.innerHTML = `
            <div class="error-icon">⚠️</div>
            <div class="error-text">无法加载应用参数，请检查网络连接或联系管理员</div>
        `;
        container.appendChild(errorDiv);
    }
    
    // 配置文件上传
    configureFileUpload(fileUploadConfig) {
        const attachBtn = document.getElementById('attachBtn');
        const fileInput = document.getElementById('fileInput');
        
        if (!fileUploadConfig.enabled) {
            if (attachBtn) attachBtn.style.display = 'none';
            return;
        }
        
        // 设置接受的文件类型
        if (fileUploadConfig.allowed_file_extensions?.length > 0) {
            const acceptTypes = fileUploadConfig.allowed_file_extensions
                .map(ext => ext.toLowerCase())
                .join(',');
            if (fileInput) {
                fileInput.accept = acceptTypes;
            }
        }
        
        // 设置文件数量限制
        if (fileUploadConfig.number_limits) {
            this.fileUploadLimit = fileUploadConfig.number_limits;
        }
        
        console.log('文件上传配置已更新:', fileUploadConfig);
    }
    
    // 启用语音转文字
    enableSpeechToText() {
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.style.display = 'block';
            this.speechToTextEnabled = true;
        }
        console.log('语音转文字功能已启用');
    }
    
    // 启用文字转语音
    enableTextToSpeech(config) {
        this.textToSpeechEnabled = true;
        this.textToSpeechConfig = config;
        console.log('文字转语音功能已启用:', config);
    }
    
    // 填充问题到输入框
    fillQuestion(question) {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = question;
            messageInput.focus();
            // 触发输入事件以更新UI状态
            this.handleInputChange();
        }
    }
    
    updateMessageContent(messageElement, content) {
        const contentDiv = messageElement.querySelector('.markdown-content');
        if (contentDiv) {
            contentDiv.innerHTML = DOMPurify.sanitize(marked.parse(content));
            // 为代码块添加复制按钮
            this.addCopyButtonsToCodeBlocks(contentDiv);
        }
        this.scrollToBottom();
    }
    
    addStatusMessage(message, type = 'loading') {
        const container = document.getElementById('messagesContainer');
        const statusDiv = document.createElement('div');
        statusDiv.className = `status-message ${type}`;
        statusDiv.textContent = message;
        container.appendChild(statusDiv);
        this.scrollToBottom();
        return statusDiv;
    }
    
    clearMessages() {
        document.getElementById('messagesContainer').innerHTML = '';
    }
    
    showWelcomeScreen() {
        const container = document.getElementById('messagesContainer');
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'flex';
            container.appendChild(welcomeScreen);
        }
    }
    
    hideWelcomeScreen() {
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
    }
    
    updateConversationTitle(title) {
        document.getElementById('conversationTitle').textContent = title;
    }
    
    // 工具方法
    handleInputChange() {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const charCount = document.getElementById('charCount');
        
        const length = input.value.length;
        charCount.textContent = length;
        
        // 更新字符计数样式
        charCount.className = '';
        if (length > 3500) {
            charCount.classList.add('danger');
        } else if (length > 3000) {
            charCount.classList.add('warning');
        }
        
        // 更新发送按钮状态
        sendBtn.disabled = length === 0 || this.isGenerating;
        
        // 自动调整输入框高度
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }
    
    updateSendButton() {
        const sendBtn = document.getElementById('sendBtn');
        const input = document.getElementById('messageInput');
        
        if (this.isGenerating) {
            // 显示停止按钮
            sendBtn.innerHTML = '<span class="stop-icon">⏹</span>';
            sendBtn.disabled = false;
            sendBtn.onclick = () => this.stopGeneration();
            sendBtn.title = '停止生成';
            sendBtn.classList.add('stop-mode');
        } else {
            // 显示发送按钮
            sendBtn.innerHTML = '<span class="send-icon">➤</span>';
            sendBtn.disabled = input.value.trim().length === 0;
            sendBtn.onclick = () => this.sendMessage();
            sendBtn.title = '发送消息';
            sendBtn.classList.remove('stop-mode');
        }
    }
    
    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('show');
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // 小于1分钟
            return '刚刚';
        } else if (diff < 3600000) { // 小于1小时
            return Math.floor(diff / 60000) + '分钟前';
        } else if (diff < 86400000) { // 小于1天
            return Math.floor(diff / 3600000) + '小时前';
        } else {
            return date.toLocaleDateString();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showNotification(message, type = 'info') {
        // 简单的通知显示，可以后续改为更好看的通知组件
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            backgroundColor: type === 'error' ? '#e74c3c' : '#2ecc71',
            zIndex: '1000',
            animation: 'slideInRight 0.3s ease-out'
        });
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    // 文件上传相关
    handleFileSelect(files) {
        // TODO: 实现文件处理逻辑
        console.log('选择的文件:', files);
    }
    
    getAttachedFiles() {
        // TODO: 返回当前附加的文件
        return [];
    }
    
    clearAttachedFiles() {
        // TODO: 清空附加文件
        document.getElementById('fileAttachments').innerHTML = '';
    }
    
    // 语音录制相关
    toggleVoiceRecording() {
        // TODO: 实现语音录制功能
        console.log('语音录制功能待实现');
    }
    
    // 上下文菜单
    showContextMenu(event, messageElement) {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
        
        // 绑定上下文菜单事件
        contextMenu.onclick = (e) => {
            const action = e.target.getAttribute('data-action');
            if (action) {
                this.handleContextAction(action, messageElement);
                this.hideContextMenu();
            }
        };
    }
    
    hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
    }
    
    handleContextAction(action, messageElement) {
        switch (action) {
            case 'copy':
                // 复制消息内容
                const content = messageElement.querySelector('.message-content').textContent;
                navigator.clipboard.writeText(content);
                this.showNotification('已复制到剪贴板');
                break;
            case 'edit':
                // 编辑消息（仅用户消息）
                console.log('编辑消息功能待实现');
                break;
            case 'delete':
                // 删除消息
                console.log('删除消息功能待实现');
                break;
            case 'regenerate':
                // 重新生成回答（仅AI消息）
                console.log('重新生成功能待实现');
                break;
        }
    }
    
    // 消息组管理函数
    createMessageGroup(groupId) {
        const container = document.getElementById('messagesContainer');
        const groupDiv = document.createElement('div');
        groupDiv.className = 'message-group';
        groupDiv.dataset.groupId = groupId;
        
        container.appendChild(groupDiv);
        this.scrollToBottom();
        return groupDiv;
    }
    
    addThinkingToGroup(groupElement, content, index = 1, autoCollapse = false) {
        // 查找是否已有思考区域
        let thinkingContainer = groupElement.querySelector('.thinking-container');
        if (!thinkingContainer) {
            thinkingContainer = document.createElement('div');
            thinkingContainer.className = 'thinking-container';
            groupElement.appendChild(thinkingContainer);
        }
        
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'thinking-section';
        thinkingDiv.innerHTML = `
            <div class="thinking-header">
                <span class="thinking-icon">🤔</span>
                <span class="thinking-title">AI思考过程 ${index > 1 ? index : ''}</span>
                <button class="thinking-toggle" onclick="this.closest('.thinking-section').classList.toggle('collapsed')">
                    <span class="toggle-text">收起</span>
                </button>
            </div>
            <div class="thinking-content">${this.escapeHtml(content)}</div>
        `;
        
        thinkingContainer.appendChild(thinkingDiv);
        
        // 只有明确要求才自动折叠
        if (autoCollapse) {
            setTimeout(() => {
                thinkingDiv.classList.add('collapsed');
            }, 3000);
        }
        
        this.scrollToBottom();
        return thinkingDiv;
    }
    
    addAssistantMessageToGroup(groupElement, content) {
        // 查找是否已有助手消息区域
        let messageContainer = groupElement.querySelector('.assistant-message-container');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.className = 'assistant-message-container';
            groupElement.appendChild(messageContainer);
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar"><img src="logo.png" alt="AI" class="avatar-logo"></div>
                <div class="message-info">
                    <div class="message-role">AI助手</div>
                    <div class="message-time">${this.formatTime(new Date().toISOString())}</div>
                </div>
            </div>
            <div class="message-content">
                <div class="markdown-content">${DOMPurify.sanitize(marked.parse(content || ''))}</div>
            </div>
        `;
        
        messageContainer.appendChild(messageDiv);
        this.scrollToBottom();
        return messageDiv;
    }
    
    addToolCallToGroup(groupElement, toolName, toolInput, insertAfterThinking = null) {
        // 查找或创建工具调用容器
        let toolContainer = groupElement.querySelector('.tool-container');
        
        // 如果不存在工具容器，创建一个新的
        if (!toolContainer) {
            toolContainer = document.createElement('div');
            toolContainer.className = 'tool-container';
            
            // 智能插入位置：根据insertAfterThinking参数决定位置
            if (insertAfterThinking) {
                // 查找指定的思考内容容器
                const thinkingContainers = groupElement.querySelectorAll('.thinking-container .thinking-section');
                let targetThinking = null;
                
                thinkingContainers.forEach(section => {
                    const title = section.querySelector('.thinking-title');
                    if (title && title.textContent.includes(insertAfterThinking.toString())) {
                        targetThinking = section.closest('.thinking-container');
                    }
                });
                
                if (targetThinking && targetThinking.nextSibling) {
                    // 插入在指定思考容器之后
                    groupElement.insertBefore(toolContainer, targetThinking.nextSibling);
                } else if (targetThinking) {
                    // 如果是最后一个元素，直接添加到后面
                    targetThinking.parentNode.insertBefore(toolContainer, targetThinking.nextSibling);
                } else {
                    // 找不到指定思考内容，插入在思考容器之后
                    const lastThinking = groupElement.querySelector('.thinking-container:last-of-type');
                    if (lastThinking) {
                        groupElement.insertBefore(toolContainer, lastThinking.nextSibling);
                    } else {
                        groupElement.appendChild(toolContainer);
                    }
                }
            } else {
                // 默认插入逻辑：在思考内容之后，答案内容之前
                const assistantContainer = groupElement.querySelector('.assistant-message-container');
                const thinkingContainers = groupElement.querySelectorAll('.thinking-container');
                
                if (assistantContainer) {
                    // 如果已有答案，插入在答案之前
                    groupElement.insertBefore(toolContainer, assistantContainer);
                } else if (thinkingContainers.length > 0) {
                    // 如果有思考内容，插入在最后一个思考内容之后
                    const lastThinking = thinkingContainers[thinkingContainers.length - 1];
                    if (lastThinking.nextSibling) {
                        groupElement.insertBefore(toolContainer, lastThinking.nextSibling);
                    } else {
                        groupElement.appendChild(toolContainer);
                    }
                } else {
                    // 默认插入在开头
                    groupElement.appendChild(toolContainer);
                }
            }
        }
        
        // 检查是否已经存在同名工具调用
        const existingTool = toolContainer.querySelector(`[data-tool-name="${toolName}"]`);
        if (existingTool) {
            console.log(`工具 ${toolName} 已存在，跳过创建`);
            return existingTool;
        }
        
        let inputDisplay = '';
        try {
            if (typeof toolInput === 'string') {
                inputDisplay = toolInput;
            } else {
                inputDisplay = JSON.stringify(toolInput, null, 2);
            }
        } catch (e) {
            inputDisplay = String(toolInput);
        }
        
        const toolDiv = document.createElement('div');
        toolDiv.className = 'tool-call-section';
        toolDiv.dataset.toolName = toolName; // 添加工具名称标识
        toolDiv.innerHTML = `
            <div class="tool-call-header">
                <span class="tool-icon">🔧</span>
                <span class="tool-name">调用工具: ${this.escapeHtml(toolName)}</span>
                <span class="tool-status">执行中...</span>
            </div>
        `;
        
        toolContainer.appendChild(toolDiv);
        this.scrollToBottom();
        
        console.log(`成功创建工具调用: ${toolName}，插入位置: ${insertAfterThinking ? '思考' + insertAfterThinking + '后' : '默认位置'}`);
        return toolDiv;
    }
    
    // API Key配置帮助
    showApiKeyError() {
        console.error(`
%c⚠️ Dify API Key未配置
%c请按照以下步骤配置您的Dify API Key：

%c1. 访问 Dify 控制台: https://cloud.dify.ai/
%c2. 登录并进入您的应用
%c3. 在"API访问"页面复制API Key
%c4. 在项目根目录的 .env 文件中设置 DIFY_API_KEY

%c示例（在.env文件中）：
%cDIFY_API_KEY=app-xxxxxxxxxxxxxxxxxxxxxx

%c配置完成后，重新启动服务器即可使用完整的Dify对话功能！
        `,
                'color: #e67e22; font-size: 16px; font-weight: bold;',
                'color: #2c3e50; font-size: 14px;',
                'color: #27ae60; font-weight: bold;',
                'color: #27ae60; font-weight: bold;',
                'color: #27ae60; font-weight: bold;',
                'color: #27ae60; font-weight: bold;',
                'color: #e74c3c; font-weight: bold;',
                'color: #34495e; font-family: monospace; background: #ecf0f1; padding: 2px 4px;',
                'color: #16a085; font-size: 14px; font-weight: bold;'
            );
    }
}

// 全局变量
let app;

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM已加载，开始初始化应用...');
    
    // 检查必要的DOM元素是否存在
    const requiredElements = [
        'loginBtn', 'logoutBtn', 'authModal', 'authForm', 
        'messageInput', 'sendBtn', 'messagesContainer'
    ];
    
    let missingElements = [];
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            missingElements.push(id);
        }
    });
    
    if (missingElements.length > 0) {
        console.error('缺少必要的DOM元素:', missingElements);
        alert('页面加载不完整，缺少必要元素: ' + missingElements.join(', '));
        return;
    }
    
    console.log('所有必要的DOM元素都存在，创建应用实例...');
    app = new ChatApp();
    console.log('应用初始化完成');
});