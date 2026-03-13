const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        // Inicializamos el transporter solo si tenemos las credenciales en .env
        this.transporter = null;
        this.initialize();
    }

    initialize() {
        const { GMAIL_USER, GMAIL_APP_PASSWORD, SMTP_FROM_NAME } = process.env;

        // Validamos variables necesarias para Gmail
        if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
            console.warn('⚠️  Nodemailer (Gmail) no configurado: Faltan variables obligatorias (GMAIL_USER, GMAIL_APP_PASSWORD) en el archivo .env o docker-compose.yml.');
            return;
        }

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: GMAIL_USER,
                pass: GMAIL_APP_PASSWORD,
            },
        });
        
        this.fromName = SMTP_FROM_NAME || 'Ghenesis';
        this.fromEmail = GMAIL_USER;
    }

    /**
     * Envia un correo electrónico genérico.
     * @param {string} to - Destinatario (ej. email del usuario)
     * @param {string} subject - Asunto del correo
     * @param {string} html - Contenido HTML del correo
     */
    async sendEmail(to, subject, html) {
        if (!this.transporter) {
            console.error(`Error: No se puede enviar correo a ${to} porque Nodemailer (Gmail) no está inicializado.`);
            return { success: false, error: 'Servicio de correos (Gmail) no configurado en el servidor.' };
        }

        try {
            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to,
                subject,
                html,
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✉️ Correo enviado a ${to} [Message ID: ${info.messageId}]`);
            return { success: true, info };
        } catch (error) {
            console.error('Error enviando correo con Nodemailer:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Envía un correo de recuperación de contraseña (con un Token seguro)
     */
    async sendPasswordRecoveryEmail(to, username, resetUrl) {
        const subject = 'Recuperación de Contraseña - Ghenesis';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                <h2 style="color: #234e66; text-align: center;">Recuperación de Acceso</h2>
                <p>Hola <strong>${username}</strong>,</p>
                <p>Hemos recibido una solicitud para restablecer tu contraseña en el sistema <strong>Ghenesis</strong>.</p>
                <p>Si fuiste tú, por favor haz clic en el botón de abajo para asignar una nueva contraseña. Este enlace expira en 15 minutos por tu seguridad.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #3c7a7d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
                </div>
                <p>Si no puedes hacer clic en el botón, copia y pega el siguiente enlace en tu navegador:</p>
                <p style="word-break: break-all; font-size: 0.9em; color: #666;"><a href="${resetUrl}">${resetUrl}</a></p>
                <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
                <p style="font-size: 0.8em; color: #999; text-align: center;">Si no solicitaste este cambio, simplemente ignora este correo. Tus credenciales siguen seguras.</p>
            </div>
        `;

        return this.sendEmail(to, subject, html);
    }
}

module.exports = new EmailService();
