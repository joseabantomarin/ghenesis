const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const EmailService = require('../services/EmailService');

const JWT_SECRET = process.env.JWT_SECRET || 'ghenesis_ultra_secret_key_2026';

class AuthController {
    /**
     * Login de usuario
     */
    async login(req, res) {
        const { username, password } = req.body;

        try {
            if (!username || !password) {
                return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
            }

            // Buscar usuario y su rol
            const query = `
                SELECT u.*, r.rolename, r.tipo
                FROM XUSER u
                LEFT JOIN XROLES r ON u.idrole = r.idrole
                WHERE u.username = $1 AND u.active = TRUE
            `;
            const result = await db.query(query, [username]);

            if (result.rows.length === 0) {
                return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
            }

            const user = result.rows[0];

            // Verificar password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
            }

            // Generar Token (incluye idrole y rolename para filtros de menú)
            const token = jwt.sign(
                {
                    iduser: user.iduser,
                    username: user.username,
                    fullname: user.fullname,
                    email: user.email,
                    idrole: user.idrole,
                    role: user.rolename,
                    tipo: user.tipo
                },
                JWT_SECRET,
                { expiresIn: '8h' }
            );

            // No enviar el password de vuelta
            delete user.password;

            res.json({
                success: true,
                token,
                user
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ success: false, error: 'Error en el servidor durante el login' });
        }
    }

    /**
     * Registro de nuevo usuario (INVITADO)
     */
    async register(req, res) {
        const { username, password, fullname, email } = req.body;

        try {
            if (!username || !password || !fullname || !email) {
                return res.status(400).json({ success: false, error: 'Todos los campos son requeridos' });
            }

            // Verificar si el usuario ya existe
            const userExists = await db.query('SELECT 1 FROM XUSER WHERE username = $1 OR email = $2', [username, email]);
            if (userExists.rows.length > 0) {
                return res.status(400).json({ success: false, error: 'El nombre de usuario o correo ya está en uso' });
            }

            // Obtener el ID del rol INVITADO
            const roleResult = await db.query('SELECT idrole FROM XROLES WHERE rolename = $1', ['INVITADO']);
            if (roleResult.rows.length === 0) {
                return res.status(500).json({ success: false, error: 'Error del sistema: El rol INVITADO no está configurado.' });
            }
            const idrole = roleResult.rows[0].idrole;

            // Hashear password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Insertar usuario
            await db.query(
                `INSERT INTO XUSER (username, password, fullname, email, idrole, active) 
                 VALUES ($1, $2, $3, $4, $5, TRUE)`,
                [username, hashedPassword, fullname, email, idrole]
            );

            res.json({ success: true, message: 'Usuario registrado exitosamente. Ya puedes iniciar sesión.' });

        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ success: false, error: 'Error en el servidor durante el registro.' });
        }
    }

    /**
     * Simulación recuperar password (ahora con envío real vía EmailService)
     */
    async recoverPassword(req, res) {
        const { email } = req.body;
        try {
            if (!email) {
                return res.status(400).json({ success: false, error: 'Correo electrónico requerido' });
            }

            // Validar si el correo existe
            const result = await db.query('SELECT iduser, username FROM XUSER WHERE email = $1 AND active = TRUE', [email]);
            
            if (result.rows.length === 0) {
                // Mensaje genérico por seguridad (anti-enumeration)
                return res.json({ success: false, error: 'Si el correo existe, se han enviado las instrucciones.' });
            }

            const user = result.rows[0];

            // Generar un token temporal (válido por 15 minutos)
            const resetToken = jwt.sign(
                { iduser: user.iduser, isResetToken: true },
                JWT_SECRET,
                { expiresIn: '15m' }
            );

            // Link de recuperación hacia el frontend 
            // (La página de frontend '/reset-password' la tendremos que crear si el usuario hace clic)
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8077';
            const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

            // Enviar correo electrónico
            const emailResult = await EmailService.sendPasswordRecoveryEmail(email, user.username, resetUrl);

            // Si el EmailService está bloqueado por falta de entorno, respondemos con error de setup
            if (!emailResult || !emailResult.success) {
                return res.json({
                    success: false,
                    error: 'Falla al procesar correo. Verifica que los datos SMTP estén configurados en el servidor (.env / docker-compose)'
                });
            }

            res.json({ 
                success: true, 
                message: 'Se han enviado las instrucciones de recuperación a tu correo.' 
            });

        } catch (error) {
            console.error('Recover password error:', error);
            res.status(500).json({ success: false, error: 'Error en el servidor al intentar recuperar la contraseña.' });
        }
    }

    /**
     * Procesar nueva contraseña (Reset Password)
     */
    async resetPassword(req, res) {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ success: false, error: 'Token y nueva contraseña son requeridos.' });
        }

        try {
            // Decodificar el JWT (fallará si expiró o es inválido)
            const decoded = jwt.verify(token, JWT_SECRET);

            if (!decoded.isResetToken || !decoded.iduser) {
                return res.status(400).json({ success: false, error: 'Token inválido para esta operación.' });
            }

            // Hashear nueva contraseña
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Actualizar en base de datos
            await db.query(
                `UPDATE XUSER 
                 SET password = $1, upddate = CURRENT_TIMESTAMP 
                 WHERE iduser = $2`, 
                [hashedPassword, decoded.iduser]
            );

            res.json({ success: true, message: 'Contraseña actualizada exitosamente.' });

        } catch (error) {
            console.error('Reset password error:', error);
            if (error.name === 'TokenExpiredError') {
                return res.status(400).json({ success: false, error: 'El enlace ha expirado. Por favor solicita uno nuevo.' });
            }
            res.status(500).json({ success: false, error: 'Token inválido o error en el servidor.' });
        }
    }

    /**
     * Cambiar contraseña local (Usuario ya con sesión activa)
     */
    async changePassword(req, res) {
        const { newPassword } = req.body;
        const iduser = req.user?.iduser;
        
        if (!newPassword || !iduser) {
            return res.status(400).json({ success: false, error: 'Datos incompletos o sesión inválida.' });
        }

        try {
            // Hashear nueva contraseña
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Actualizar en base de datos
            await db.query(
                `UPDATE XUSER 
                 SET password = $1, upddate = CURRENT_TIMESTAMP 
                 WHERE iduser = $2`, 
                [hashedPassword, iduser]
            );

            res.json({ success: true, message: 'Su contraseña ha sido actualizada exitosamente.' });

        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ success: false, error: 'Error en el servidor al cambiar contraseña.' });
        }
    }

    /**
     * Verificar sesión actual
     */
    async me(req, res) {
        res.json({
            success: true,
            user: req.user
        });
    }

    /**
     * Obtener permisos del usuario actual (mapa por idform)
     */
    async getMyPermissions(req, res) {
        try {
            const idrole = req.user.idrole;
            if (!idrole) {
                return res.json({ success: true, data: {} });
            }

            const result = await db.query(
                'SELECT idform, readonly, hidden, invitado FROM XPERMISSIONS WHERE idrole = $1',
                [idrole]
            );

            // Convertir a mapa { idform: { readonly, hidden, invitado } }
            const permMap = {};
            for (const row of result.rows) {
                permMap[row.idform] = {
                    readonly: row.readonly,
                    hidden: row.hidden,
                    invitado: row.invitado
                };
            }

            res.json({ success: true, data: permMap });
        } catch (error) {
            console.error('Permissions error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new AuthController();
