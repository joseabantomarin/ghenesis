const db = require('../config/db');
const bcrypt = require('bcryptjs');

// --- Usuarios ---

exports.getUsers = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.iduser, u.username, u.fullname, u.email, u.active, u.idrole, r.rolename
            FROM XUSER u
            LEFT JOIN XROLES r ON u.idrole = r.idrole
            ORDER BY u.iduser ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.saveUser = async (req, res) => {
    try {
        const { iduser, username, password, fullname, email, active, idrole } = req.body;
        const isUpdate = !!iduser;

        if (isUpdate) {
            let sql = 'UPDATE XUSER SET username=$1, fullname=$2, email=$3, active=$4, idrole=$5';
            const params = [username, fullname, email, active, idrole];

            if (password && password.length > 0) {
                const hashedPassword = await bcrypt.hash(password, 10);
                sql += ', password=$6 WHERE iduser=$7';
                params.push(hashedPassword, iduser);
            } else {
                sql += ' WHERE iduser=$6';
                params.push(iduser);
            }
            await db.query(sql, params);
        } else {
            const hashedPassword = await bcrypt.hash(password || '123456', 10);
            await db.query(
                'INSERT INTO XUSER (username, password, fullname, email, active, idrole) VALUES ($1, $2, $3, $4, $5, $6)',
                [username, hashedPassword, fullname, email, active, idrole]
            );
        }

        res.json({ success: true, message: 'Usuario guardado correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM XUSER WHERE iduser = $1', [id]);
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// --- Roles y Permisos ---

exports.getRoles = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM XROLES ORDER BY idrole ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getRolePermissions = async (req, res) => {
    try {
        const { idrole } = req.params;
        // Obtenemos todos los formularios para armar la matriz completa
        const result = await db.query(`
            SELECT f.idform, f.descripcion as module_name,
                   COALESCE(p.can_view, false) as can_view,
                   COALESCE(p.can_create, false) as can_create,
                   COALESCE(p.can_update, false) as can_update,
                   COALESCE(p.can_delete, false) as can_delete
            FROM XFORMS f
            LEFT JOIN XPERMISSIONS p ON f.idform = p.idform AND p.idrole = $1
            WHERE f.idparent IS NOT NULL OR f.tipo IN (0,1,2,3)
            ORDER BY f.idform ASC
        `, [idrole]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.saveRolePermissions = async (req, res) => {
    const client = await db.connect();
    try {
        const { idrole, permissions } = req.body;
        await client.query('BEGIN');

        // Limpiar permisos previos para este rol
        await client.query('DELETE FROM XPERMISSIONS WHERE idrole = $1', [idrole]);

        // Insertar nuevos permisos
        for (const p of permissions) {
            await client.query(
                'INSERT INTO XPERMISSIONS (idrole, idform, can_view, can_create, can_update, can_delete) VALUES ($1, $2, $3, $4, $5, $6)',
                [idrole, p.idform, p.can_view, p.can_create, p.can_update, p.can_delete]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Permisos actualizados' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
};
