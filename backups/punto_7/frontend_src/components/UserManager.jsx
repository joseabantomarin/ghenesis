import React, { useState, useEffect } from 'react';
import {
    Box, Paper, Typography, Button, TextField, MenuItem, Checkbox,
    FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions,
    IconButton, Chip
} from '@mui/material';
import {
    Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
    Person as UserIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import axios from 'axios';

ModuleRegistry.registerModules([AllCommunityModule]);

const myTheme = themeQuartz.withParams({
    headerBackgroundColor: 'var(--grid-header-bg)',
    headerTextColor: 'var(--grid-header-color)',
    selectedRowBackgroundColor: 'var(--grid-selected-row-bg)',
    rowHoverColor: 'transparent',
    headerColumnBorder: true,
    columnBorder: true,
    borderColor: '#dde2eb',
});

const UserManager = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '', password: '', fullname: '', email: '', active: true, idrole: ''
    });

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/auth/users');
            if (res.data.success) {
                setUsers(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await axios.get('/api/auth/roles');
            if (res.data.success) {
                setRoles(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const handleOpen = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                iduser: user.iduser,
                username: user.username,
                password: '',
                fullname: user.fullname || '',
                email: user.email || '',
                active: user.active,
                idrole: user.idrole || ''
            });
        } else {
            setEditingUser(null);
            setFormData({
                username: '', password: '', fullname: '', email: '', active: true, idrole: ''
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const handleSave = async () => {
        try {
            const res = await axios.post('/api/auth/users', formData);
            if (res.data.success) {
                fetchUsers();
                handleClose();
            }
        } catch (error) {
            alert('Error al guardar usuario: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este usuario?')) return;
        try {
            const res = await axios.delete(`/api/auth/users/${id}`);
            if (res.data.success) {
                fetchUsers();
            }
        } catch (error) {
            alert('Error al eliminar usuario');
        }
    };

    const columnDefs = [
        { field: 'iduser', headerName: 'ID', width: 80 },
        {
            field: 'username',
            headerName: 'Usuario',
            flex: 1,
            cellRenderer: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                    <UserIcon sx={{ mr: 1, fontSize: '1rem', color: 'primary.main' }} />
                    {params.value}
                </Box>
            )
        },
        { field: 'fullname', headerName: 'Nombre Completo', flex: 1.5 },
        { field: 'email', headerName: 'Email', flex: 1.5 },
        {
            field: 'rolename',
            headerName: 'Rol',
            width: 140,
            cellRenderer: (params) => (
                <Chip label={params.value || 'Sin Rol'} size="small" variant="outlined" color="primary" />
            )
        },
        {
            field: 'active',
            headerName: 'Estado',
            width: 110,
            cellRenderer: (params) => (
                <Chip
                    label={params.value ? 'Activo' : 'Inactivo'}
                    size="small"
                    color={params.value ? 'success' : 'default'}
                />
            )
        },
        {
            headerName: 'Acciones',
            width: 120,
            pinned: 'right',
            cellRenderer: (params) => (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => handleOpen(params.data)} color="primary">
                        <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => handleDelete(params.data.iduser)}
                        color="error"
                        disabled={params.data.username === 'admin'}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
            )
        }
    ];

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    Gestión de Usuarios del Sistema
                </Typography>
                <Box sx={{ gap: 1, display: 'flex' }}>
                    <IconButton onClick={fetchUsers} disabled={loading}><RefreshIcon /></IconButton>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpen()}
                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                    >
                        Nuevo Usuario
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ flexGrow: 1, mb: 1, borderRadius: '12px', overflow: 'hidden' }}>
                <AgGridReact
                    theme={myTheme}
                    rowData={users}
                    columnDefs={columnDefs}
                    loading={loading}
                    animateRows={true}
                    rowSelection="single"
                    headerHeight={45}
                    rowHeight={45}
                />
            </Paper>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>
                    {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                        <TextField
                            label="Nombre de Usuario"
                            fullWidth size="small"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                        <TextField
                            label={editingUser ? "Nueva Contraseña (dejar en blanco para no cambiar)" : "Contraseña"}
                            type="password"
                            fullWidth size="small"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                        <TextField
                            label="Nombre Completo"
                            fullWidth size="small"
                            value={formData.fullname}
                            onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                        />
                        <TextField
                            label="Email"
                            fullWidth size="small"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                        <TextField
                            select
                            label="Rol"
                            fullWidth size="small"
                            value={formData.idrole}
                            onChange={(e) => setFormData({ ...formData, idrole: e.target.value })}
                        >
                            {roles.map((role) => (
                                <MenuItem key={role.idrole} value={role.idrole}>
                                    {role.rolename}
                                </MenuItem>
                            ))}
                        </TextField>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData.active}
                                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                />
                            }
                            label="Usuario Activo"
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handleClose}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!formData.username}
                    >
                        Guardar Usuario
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserManager;
