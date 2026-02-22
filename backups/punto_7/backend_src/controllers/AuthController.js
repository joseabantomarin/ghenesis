const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

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
                SELECT u.*, r.rolename 
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

            // Generar Token
            const token = jwt.sign(
                {
                    iduser: user.iduser,
                    username: user.username,
                    role: user.rolename
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
     * Verificar sesión actual
     */
    async me(req, res) {
        // El usuario ya viene inyectado por el middleware de auth
        res.json({
            success: true,
            user: req.user
        });
    }
}

module.exports = new AuthController();
