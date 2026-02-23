const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const AuthManagementController = require('../controllers/AuthManagementController');
const authMiddleware = require('../middlewares/authMiddleware');

// Auth básico
router.post('/login', AuthController.login);
router.get('/me', authMiddleware, AuthController.me);
router.get('/permissions', authMiddleware, AuthController.getMyPermissions);

// Gestión de Usuarios (Protegido)
router.get('/users', authMiddleware, AuthManagementController.getUsers);
router.post('/users', authMiddleware, AuthManagementController.saveUser);
router.delete('/users/:id', authMiddleware, AuthManagementController.deleteUser);

// Gestión de Roles (Protegido)
router.get('/roles', authMiddleware, AuthManagementController.getRoles);
router.post('/roles', authMiddleware, AuthManagementController.saveRole);
router.delete('/roles/:id', authMiddleware, AuthManagementController.deleteRole);

// Permisos de Roles (Protegido)
router.get('/roles/:idrole/permissions', authMiddleware, AuthManagementController.getPermissions);
router.post('/roles/permissions', authMiddleware, AuthManagementController.savePermissions);

module.exports = router;
