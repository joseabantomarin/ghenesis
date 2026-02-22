const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ghenesis_ultra_secret_key_2026';

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Acceso denegado. Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Adjuntar info del usuario al request
        next();
    } catch (error) {
        console.error('JWT Verify error:', error.message);
        return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
    }
};

module.exports = authMiddleware;
