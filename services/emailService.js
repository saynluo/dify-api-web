const nodemailer = require('nodemailer');

class EmailService {
    constructor(db) {
        this.db = db;
        this.transporter = null;
    }

    // 从数据库加载SMTP配置
    async loadSmtpConfig() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM email_verification_settings WHERE id = ?',
                ['default'],
                (err, settings) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(settings);
                    }
                }
            );
        });
    }

    // 初始化邮件传输器
    async initializeTransporter() {
        try {
            const settings = await this.loadSmtpConfig();

            if (!settings || !settings.enabled) {
                console.log('邮箱验证功能未启用');
                return false;
            }

            if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_password) {
                console.log('SMTP配置不完整');
                return false;
            }

            this.transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: settings.smtp_port || 587,
                secure: settings.smtp_secure === 1, // true for 465, false for other ports
                auth: {
                    user: settings.smtp_user,
                    pass: settings.smtp_password
                }
            });

            // 验证配置
            await this.transporter.verify();
            console.log('SMTP配置验证成功');
            return true;
        } catch (error) {
            console.error('SMTP配置验证失败:', error);
            this.transporter = null;
            return false;
        }
    }

    // 发送验证码邮件
    async sendVerificationCode(email, code, type = 'register') {
        try {
            // 重新加载配置以确保使用最新设置
            const initialized = await this.initializeTransporter();

            if (!initialized || !this.transporter) {
                throw new Error('邮件服务未启用或配置不正确，请联系管理员检查SMTP设置');
            }

            const settings = await this.loadSmtpConfig();

            console.log('📧 发送验证码邮件 - 配置信息:');
            console.log('  - 邮件主题:', settings.email_subject);
            console.log('  - 模板预览:', settings.email_template?.substring(0, 50) + '...');
            console.log('  - 发件人:', settings.from_name);

            // 使用自定义的邮件主题和模板
            const subject = settings.email_subject || '【AI智能助手】邮箱验证码';
            const template = settings.email_template || '您好！\n\n您的邮箱验证码是：{code}\n\n验证码将在5分钟后过期，请尽快完成验证。\n\n如果这不是您的操作，请忽略此邮件。\n\n祝您使用愉快！\nAI智能助手团队';

            console.log('  - 实际使用主题:', subject);
            console.log('  - 实际使用模板:', template.substring(0, 50) + '...');

            // 替换模板中的 {code} 占位符
            const emailContent = template.replace(/{code}/g, code);

            // 将换行符转换为 HTML 的 <br> 标签
            const htmlContent = emailContent.replace(/\n/g, '<br>');

            const mailOptions = {
                from: `"${settings.from_name || 'AI智能助手'}" <${settings.from_email || settings.smtp_user}>`,
                to: email,
                subject: subject,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <p style="color: #333; font-size: 16px; line-height: 1.8; white-space: pre-wrap;">
                                ${htmlContent}
                            </p>
                            <p style="color: #999; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                                此邮件由系统自动发送，请勿直接回复。
                            </p>
                        </div>
                        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
                            © 2025 AI智能助手. All rights reserved.
                        </p>
                    </div>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('验证码邮件发送成功:', info.messageId);
            return true;
        } catch (error) {
            console.error('发送验证码邮件失败:', error);
            // 提供更详细的错误信息
            if (error.code === 'ESOCKET' || error.code === 'ECONNREFUSED') {
                throw new Error('无法连接到SMTP服务器，请检查服务器地址和端口是否正确');
            } else if (error.code === 'EAUTH') {
                throw new Error('SMTP认证失败，请检查用户名和授权码是否正确');
            } else if (error.responseCode === 550) {
                throw new Error('邮件被拒绝，可能是收件地址无效或被服务器拒收');
            } else {
                throw new Error(error.message || '发送邮件失败，请稍后重试');
            }
        }
    }

    // 生成6位随机验证码
    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // 保存验证码到数据库
    async saveVerificationCode(email, code, type = 'register') {
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO email_verification_codes (id, email, code, type, expires_at) VALUES (?, ?, ?, ?, ?)`,
                [id, email, code, type, expiresAt.toISOString()],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(id);
                    }
                }
            );
        });
    }

    // 验证验证码
    async verifyCode(email, code, type = 'register') {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();

            this.db.get(
                `SELECT * FROM email_verification_codes
                 WHERE email = ? AND code = ? AND type = ?
                 AND verified = 0 AND expires_at > ?
                 ORDER BY created_at DESC LIMIT 1`,
                [email, code, type, now],
                async (err, record) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!record) {
                        resolve({ valid: false, message: '验证码无效或已过期' });
                        return;
                    }

                    // 标记验证码为已使用
                    this.db.run(
                        `UPDATE email_verification_codes SET verified = 1, verified_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [record.id],
                        (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({ valid: true, message: '验证成功' });
                            }
                        }
                    );
                }
            );
        });
    }

    // 清理过期的验证码
    async cleanupExpiredCodes() {
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM email_verification_codes WHERE expires_at < ?`,
                [now],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`清理了 ${this.changes} 条过期验证码`);
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    // 检查邮箱验证功能是否启用
    async isEnabled() {
        try {
            const settings = await this.loadSmtpConfig();
            return settings && settings.enabled === 1;
        } catch (error) {
            console.error('检查邮箱验证启用状态失败:', error);
            return false;
        }
    }
}

module.exports = EmailService;
