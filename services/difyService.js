const fetch = require('node-fetch');
const fs = require('fs');
const FormData = require('form-data');

class DifyService {
    constructor() {
        this.apiKey = process.env.DIFY_API_KEY;
        this.baseUrl = process.env.DIFY_BASE_URL;
        
        if (!this.apiKey || !this.baseUrl) {
            throw new Error('Dify API配置缺失，请检查环境变量');
        }
    }
    
    // 获取请求头
    getHeaders(contentType = 'application/json') {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': contentType
        };
    }
    
    // 发送消息（流式）
    async sendMessage(data, onChunk) {
        const requestData = {
            inputs: data.inputs || {},
            query: data.query,
            response_mode: 'streaming',
            user: data.user,
            conversation_id: data.conversation_id || '',
            files: data.files || [],
            auto_generate_name: data.auto_generate_name !== false
        };
        
        try {
            const response = await fetch(`${this.baseUrl}/chat-messages`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const reader = response.body;
            let buffer = '';
            
            return new Promise((resolve, reject) => {
                reader.on('data', (chunk) => {
                    buffer += chunk.toString();
                    
                    // 处理可能包含多个事件的数据块
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // 保留最后一个可能不完整的行
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const jsonStr = line.slice(6);
                                if (jsonStr.trim() === '') continue;
                                
                                const eventData = JSON.parse(jsonStr);
                                
                                // 处理不同类型的事件
                                this.processStreamEvent(eventData, onChunk);
                                
                                if (eventData.event === 'message_end') {
                                    resolve(eventData);
                                    return;
                                }
                                
                                if (eventData.event === 'error') {
                                    reject(new Error(eventData.message || '未知错误'));
                                    return;
                                }
                            } catch (parseError) {
                                console.warn('解析SSE数据失败:', parseError, 'Line:', line);
                            }
                        } else if (line.startsWith('event: ')) {
                            // 处理纯事件行（如ping）
                            const eventType = line.slice(7).trim();
                            if (eventType === 'ping') {
                                onChunk({ event: 'ping' });
                            }
                        }
                    }
                });
                
                reader.on('end', () => {
                    resolve();
                });
                
                reader.on('error', (error) => {
                    reject(error);
                });
            });
            
        } catch (error) {
            console.error('Dify API调用失败:', error);
            throw error;
        }
    }
    
    // 处理流式事件
    processStreamEvent(eventData, onChunk) {
        switch (eventData.event) {
            case 'message':
            case 'agent_message':
                // 处理消息内容
                onChunk({
                    ...eventData,
                    processedAnswer: this.processMessageContent(eventData.answer || '')
                });
                break;
                
            case 'agent_thought':
                // 处理Agent思考过程
                onChunk({
                    ...eventData,
                    processedThought: this.processThoughtContent(eventData.thought || '')
                });
                break;
                
            case 'tts_message':
                // 处理语音合成消息
                onChunk(eventData);
                break;
                
            case 'tts_message_end':
                // TTS结束事件
                onChunk(eventData);
                break;
                
            case 'message_file':
                // 处理文件消息
                onChunk(eventData);
                break;
                
            case 'message_replace':
                // 处理内容替换
                onChunk(eventData);
                break;
                
            case 'ping':
                // 保持连接
                onChunk(eventData);
                break;
                
            default:
                // 其他事件类型也传递给前端处理
                onChunk(eventData);
        }
    }
    
    // 处理消息内容
    processMessageContent(content) {
        if (!content) return { answer: '', thinking: '' };
        
        // 分离思考内容和回答内容
        return this.separateThinking(content);
    }
    
    // 处理思考内容
    processThoughtContent(thought) {
        if (!thought) return '';
        
        // 移除<think>标签（如果存在）
        return thought.replace(/<\/?think>/g, '').trim();
    }
    
    // 分离思考内容和回答内容（保留向后兼容）
    separateThinking(text) {
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
        
        // 清理答案内容：移除多余的空行
        const cleanedAnswer = this.cleanAnswerContent(answer.trim());
        
        return { answer: cleanedAnswer, thinking: thinking.trim() };
    }
    
    // 清理答案内容，移除思考内容分离后留下的多余空行
    cleanAnswerContent(content) {
        if (!content) return '';
        
        // 1. 移除开头和结尾的空白
        let cleaned = content.trim();
        
        // 2. 将连续的多个换行符减少为最多两个（保持段落间距）
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        
        // 3. 移除表格前的多余空行（表格通常以|开头）
        cleaned = cleaned.replace(/\n{2,}(\|)/g, '\n$1');
        
        // 4. 移除其他markdown元素前的多余空行
        cleaned = cleaned.replace(/\n{2,}(#{1,6}\s)/g, '\n\n$1'); // 标题前保留一个空行
        cleaned = cleaned.replace(/\n{2,}(```)/g, '\n\n$1'); // 代码块前保留一个空行
        
        return cleaned;
    }
    
    // 停止生成
    async stopGeneration(taskId, userId) {
        try {
            const response = await fetch(`${this.baseUrl}/chat-messages/${taskId}/stop`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ user: userId })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('停止生成失败:', error);
            throw error;
        }
    }
    
    // 消息反馈
    async messageFeedback(messageId, rating, userId, content = '') {
        try {
            const response = await fetch(`${this.baseUrl}/messages/${messageId}/feedbacks`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    rating,
                    user: userId,
                    content
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('反馈提交失败:', error);
            throw error;
        }
    }
    
    // 获取建议问题
    async getSuggestedQuestions(messageId, userId) {
        try {
            const response = await fetch(`${this.baseUrl}/messages/${messageId}/suggested?user=${userId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取建议问题失败:', error);
            throw error;
        }
    }
    
    
    // 文件上传
    async uploadFile(filePath, originalName, userId) {
        try {
            const form = new FormData();
            form.append('file', fs.createReadStream(filePath), originalName);
            form.append('user', userId);
            
            const response = await fetch(`${this.baseUrl}/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: form
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`文件上传失败: ${errorText}`);
            }
            
            const result = await response.json();
            return result.id;
        } catch (error) {
            console.error('Dify文件上传失败:', error);
            throw error;
        }
    }
    
    // 语音转文字
    async audioToText(audioFilePath, userId) {
        try {
            const form = new FormData();
            form.append('file', fs.createReadStream(audioFilePath));
            form.append('user', userId);
            
            const response = await fetch(`${this.baseUrl}/audio-to-text`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: form
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('语音转文字失败:', error);
            throw error;
        }
    }
    
    // 文字转语音
    async textToAudio(text, messageId, userId) {
        try {
            const requestBody = { user: userId };
            
            if (messageId) {
                requestBody.message_id = messageId;
            } else {
                requestBody.text = text;
            }
            
            const response = await fetch(`${this.baseUrl}/text-to-audio`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response.body;
        } catch (error) {
            console.error('文字转语音失败:', error);
            throw error;
        }
    }
    
    // 获取应用信息
    async getAppInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/info`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取应用信息失败:', error);
            throw error;
        }
    }
    
    // 获取应用参数
    async getAppParameters(userId) {
        try {
            const response = await fetch(`${this.baseUrl}/parameters?user=${userId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取应用参数失败:', error);
            throw error;
        }
    }
    
    // 获取应用参数（新版本，遵循application.md API规范）
    async getApplicationParameters() {
        try {
            const response = await fetch(`${this.baseUrl}/parameters`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取应用参数失败:', error);
            throw error;
        }
    }
    
    // 获取工具元数据
    async getToolMeta() {
        try {
            const response = await fetch(`${this.baseUrl}/meta`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取工具元数据失败:', error);
            throw error;
        }
    }
    
    // 获取历史消息
    async getMessages(conversationId, user, limit = 20) {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                conversation_id: conversationId,
                user: user
            });
            
            const response = await fetch(`${this.baseUrl}/messages?${params}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取Dify历史消息失败:', error);
            throw error;
        }
    }
    
    // 获取对话列表
    async getConversations(user, limit = 20, lastId = null, sortBy = '-updated_at') {
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                user: user,
                sort_by: sortBy
            });
            
            if (lastId) {
                params.append('last_id', lastId);
            }
            
            const response = await fetch(`${this.baseUrl}/conversations?${params}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取Dify对话列表失败:', error);
            throw error;
        }
    }
    
    // 删除对话
    async deleteConversation(conversationId, user) {
        try {
            const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
                method: 'DELETE',
                headers: this.getHeaders(),
                body: JSON.stringify({ user })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return response.status === 204;
        } catch (error) {
            console.error('删除Dify对话失败:', error);
            throw error;
        }
    }
    
    // 重命名对话
    async renameConversation(conversationId, name, user, autoGenerate = false) {
        try {
            const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/name`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    name,
                    auto_generate: autoGenerate,
                    user
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('重命名Dify对话失败:', error);
            throw error;
        }
    }
    
    // 获取对话变量
    async getConversationVariables(conversationId, user, limit = 20, lastId = null, variableName = null) {
        try {
            const params = new URLSearchParams({
                user,
                limit: limit.toString()
            });
            
            if (lastId) {
                params.append('last_id', lastId);
            }
            
            if (variableName) {
                params.append('variable_name', variableName);
            }
            
            const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/variables?${params}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('获取Dify对话变量失败:', error);
            throw error;
        }
    }
    
    // 提交消息反馈
    async submitMessageFeedback(messageId, feedbackData) {
        try {
            const response = await fetch(`${this.baseUrl}/messages/${messageId}/feedbacks`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    rating: feedbackData.rating,
                    user: feedbackData.user,
                    content: feedbackData.content || ''
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('提交Dify消息反馈失败:', error);
            throw error;
        }
    }
}

module.exports = new DifyService();