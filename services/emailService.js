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

            const subject = type === 'register' ? '注册验证码 - AI智能助手' : '密码重置验证码 - AI智能助手';
            const content = type === 'register'
                ? `您的注册验证码是：<strong>${code}</strong><br><br>验证码有效期为10分钟，请尽快使用。<br><br>如果这不是您的操作，请忽略此邮件。`
                : `您的密码重置验证码是：<strong>${code}</strong><br><br>验证码有效期为10分钟，请尽快使用。<br><br>如果这不是您的操作，请立即修改密码以保护账户安全。`;

            const mailOptions = {
                from: `"${settings.from_name || 'AI智能助手'}" <${settings.from_email || settings.smtp_user}>`,
                to: email,
                subject: subject,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <h2 style="color: #333; margin-top: 0;">${subject}</h2>
                            <p style="color: #666; font-size: 16px; line-height: 1.6;">
                                ${content}
                            </p>
                            <div style="margin: 30px 0; padding: 20px; background-color: #f0f8ff; border-left: 4px solid #2196F3; border-radius: 5px;">
                                <p style="margin: 0; font-size: 24px; color: #2196F3; font-weight: bold; letter-spacing: 3px; text-align: center;">
                                    ${code}
                                </p>
                            </div>
                            <p style="color: #999; font-size: 14px; margin-top: 20px;">
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
