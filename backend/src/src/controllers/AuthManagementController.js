const db = require('../config/db');
const bcrypt = require('bcryptjs');

// ===== USUARIOS =====

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
            const params = [username, fullname, email, active !== false, idrole];

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
                [username, hashedPassword, fullname, email, active !== false, idrole]
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
        // No permitir eliminar al usuario ID 1 (admin principal)
        if (parseInt(id) === 1) {
            return res.status(400).json({ success: false, error: 'No se puede eliminar al usuario principal del sistema' });
        }
        await db.query('DELETE FROM XUSER WHERE iduser = $1', [id]);
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ===== ROLES =====

exports.getRoles = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM XROLES ORDER BY idrole ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.saveRole = async (req, res) => {
    try {
        const { idrole, rolename, descripcion } = req.body;

        if (idrole) {
            // No permitir renombrar roles protegidos
            const protectedRoles = [1, 2, 3]; // ADMINISTRADOR, USUARIO, DEVELOPER
            if (protectedRoles.includes(parseInt(idrole))) {
                // Solo actualizar descripción, no el nombre
                await db.query(
                    'UPDATE XROLES SET descripcion=$1 WHERE idrole=$2',
                    [descripcion, idrole]
                );
            } else {
                await db.query(
                    'UPDATE XROLES SET rolename=$1, descripcion=$2 WHERE idrole=$3',
                    [rolename.toUpperCase(), descripcion, idrole]
                );
            }
        } else {
            await db.query(
                'INSERT INTO XROLES (rolename, descripcion) VALUES ($1, $2)',
                [rolename.toUpperCase(), descripcion]
            );
        }

        res.json({ success: true, message: 'Rol guardado correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const protectedRoles = [1, 2, 3]; // ADMINISTRADOR, USUARIO, DEVELOPER
        if (protectedRoles.includes(parseInt(id))) {
            return res.status(400).json({ success: false, error: 'No se puede eliminar un rol del sistema' });
        }

        // Verificar que no haya usuarios con este rol
        const check = await db.query('SELECT COUNT(*) as cnt FROM XUSER WHERE idrole=$1', [id]);
        if (parseInt(check.rows[0].cnt) > 0) {
            return res.status(400).json({ success: false, error: 'No se puede eliminar un rol que tiene usuarios asignados' });
        }

        await db.query('DELETE FROM XPERMISSIONS WHERE idrole=$1', [id]);
        await db.query('DELETE FROM XROLES WHERE idrole=$1', [id]);
        res.json({ success: true, message: 'Rol eliminado' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ===== PERMISOS =====

exports.getPermissions = async (req, res) => {
    try {
        const { idrole } = req.params;

        // Todos los xforms que son hojas (no son contenedores vacíos)
        const result = await db.query(`
            SELECT f.idform, f.descripcion as module_name, f.tipo,
                   COALESCE(p.readonly, false) as readonly,
                   COALESCE(p.hidden, false) as hidden
            FROM XFORMS f
            LEFT JOIN XPERMISSIONS p ON f.idform = p.idform AND p.idrole = $1
            ORDER BY f.tipo ASC, f.nroform ASC, f.idform ASC
        `, [idrole]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.savePermissions = async (req, res) => {
    const client = await db.getPool().connect();
    try {
        const { idrole, permissions } = req.body;
        await client.query('BEGIN');

        // Limpiar permisos previos
        await client.query('DELETE FROM XPERMISSIONS WHERE idrole = $1', [idrole]);

        // Insertar solo los que tienen algún permiso activo
        for (const p of permissions) {
            if (p.readonly || p.hidden) {
                await client.query(
                    'INSERT INTO XPERMISSIONS (idrole, idform, readonly, hidden) VALUES ($1, $2, $3, $4)',
                    [idrole, p.idform, p.readonly || false, p.hidden || false]
                );
            }
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
