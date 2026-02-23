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

            // Generar Token (incluye idrole y rolename para filtros de menú)
            const token = jwt.sign(
                {
                    iduser: user.iduser,
                    username: user.username,
                    fullname: user.fullname,
                    email: user.email,
                    idrole: user.idrole,
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
                'SELECT idform, readonly, hidden FROM XPERMISSIONS WHERE idrole = $1',
                [idrole]
            );

            // Convertir a mapa { idform: { readonly, hidden } }
            const permMap = {};
            for (const row of result.rows) {
                permMap[row.idform] = {
                    readonly: row.readonly,
                    hidden: row.hidden
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
