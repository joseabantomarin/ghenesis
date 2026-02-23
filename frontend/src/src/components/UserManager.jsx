import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Paper, Box, Typography, Button, IconButton, CircularProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
    InputAdornment
} from '@mui/material';
import {
    Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
    Refresh as RefreshIcon, Visibility, VisibilityOff
} from '@mui/icons-material';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import ConfirmDialog from './ConfirmDialog';

ModuleRegistry.registerModules([AllCommunityModule]);

// Mismo tema visual que DynamicGrid
const gridTheme = themeQuartz.withParams({
    headerBackgroundColor: 'var(--grid-header-bg)',
    headerTextColor: 'var(--grid-header-color)',
    selectedRowBackgroundColor: 'var(--grid-selected-row-bg)',
    rowHoverColor: 'transparent',
    headerColumnBorder: true,
    columnBorder: true,
    borderColor: '#dde2eb',
    accentColor: 'var(--primary-color)',
    checkboxBorderWidth: 2,
    checkboxCheckedShape: 'tick',
    iconButtonHoverBackgroundColor: 'transparent'
});

const UserManager = () => {
    const gridRef = useRef();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({
        iduser: null, username: '', password: '', fullname: '', email: '', active: true, idrole: ''
    });

    const columnDefs = useMemo(() => [
        { field: 'iduser', headerName: 'ID', width: 70 },
        { field: 'username', headerName: 'Usuario', width: 130 },
        { field: 'fullname', headerName: 'Nombre Completo', flex: 1, minWidth: 180 },
        { field: 'email', headerName: 'Email', width: 200 },
        { field: 'rolename', headerName: 'Rol', width: 140 },
        { field: 'active', headerName: 'Activo', width: 90, cellRenderer: 'agCheckboxCellRenderer' }
    ], []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, rolesRes] = await Promise.all([
                axios.get('/api/auth/users'),
                axios.get('/api/auth/roles')
            ]);
            if (usersRes.data.success) setUsers(usersRes.data.data);
            if (rolesRes.data.success) setRoles(rolesRes.data.data);
        } catch (e) {
            console.error('Error loading users', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSelectionChanged = () => {
        const selected = gridRef.current?.api?.getSelectedRows();
        setSelectedUser(selected?.length > 0 ? selected[0] : null);
    };

    const openNew = () => {
        setForm({ iduser: null, username: '', password: '', fullname: '', email: '', active: true, idrole: '' });
        setShowPassword(false);
        setDialogOpen(true);
    };

    const openEdit = () => {
        if (!selectedUser) return;
        setForm({
            iduser: selectedUser.iduser,
            username: selectedUser.username,
            password: '',
            fullname: selectedUser.fullname || '',
            email: selectedUser.email || '',
            active: selectedUser.active,
            idrole: selectedUser.idrole || ''
        });
        setShowPassword(false);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        try {
            const res = await axios.post('/api/auth/users', form);
            if (res.data.success) {
                setDialogOpen(false);
                setSelectedUser(null);
                fetchData();
            } else {
                alert('Error: ' + res.data.error);
            }
        } catch (e) {
            alert('Error: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleDelete = () => {
        if (!selectedUser) return;
        setConfirmOpen(true);
    };

    const executeDelete = async () => {
        setConfirmOpen(false);
        try {
            const res = await axios.delete(`/api/auth/users/${selectedUser.iduser}`);
            if (res.data.success) {
                setSelectedUser(null);
                fetchData();
            } else {
                alert('Error: ' + res.data.error);
            }
        } catch (e) {
            alert('Error: ' + (e.response?.data?.error || e.message));
        }
    };

    return (
        <Paper elevation={3} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{
                px: 2, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: 1, borderColor: 'divider'
            }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--active-tab-color)' }}>
                    Gestión de Usuarios
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" color="success" onClick={openNew} startIcon={<AddIcon />}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}>Nuevo</Button>
                    <Button variant="outlined" color="primary" onClick={openEdit} disabled={!selectedUser} startIcon={<EditIcon />}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}>Editar</Button>
                    <Button variant="outlined" color="error" onClick={handleDelete} disabled={!selectedUser} startIcon={<DeleteIcon />}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}>Borrar</Button>
                    <IconButton onClick={fetchData} sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38 }}>
                        <RefreshIcon />
                    </IconButton>
                </Box>
            </Box>

            {/* Grid */}
            <Box sx={{ flexGrow: 1, position: 'relative' }}>
                {loading && (
                    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.5)' }}>
                        <CircularProgress />
                    </Box>
                )}
                <AgGridReact
                    ref={gridRef}
                    theme={gridTheme}
                    rowData={users}
                    columnDefs={columnDefs}
                    rowSelection={{ mode: 'singleRow', checkboxes: false }}
                    onSelectionChanged={handleSelectionChanged}
                    onCellFocused={(e) => {
                        if (e.rowIndex !== null && e.api) {
                            const rowNode = e.api.getDisplayedRowAtIndex(e.rowIndex);
                            if (rowNode && !rowNode.isSelected()) {
                                rowNode.setSelected(true, true);
                            }
                        }
                    }}
                    headerHeight={45}
                    rowHeight={40}
                    animateRows={false}
                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                />
            </Box>

            {/* Dialog Crear/Editar */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
                PaperProps={{ sx: { borderRadius: '16px' } }}>
                <DialogTitle sx={{ fontWeight: 'bold', pb: 1 }}>
                    {form.iduser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
                    <TextField label="Usuario" value={form.username} required size="small"
                        onChange={e => setForm({ ...form, username: e.target.value })}
                        InputProps={{ sx: { borderRadius: '10px' } }} />
                    <TextField
                        label={form.iduser ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                        value={form.password}
                        type={showPassword ? 'text' : 'password'}
                        required={!form.iduser}
                        size="small"
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        InputProps={{
                            sx: { borderRadius: '10px' },
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                    <TextField label="Nombre Completo" value={form.fullname} size="small"
                        onChange={e => setForm({ ...form, fullname: e.target.value })}
                        InputProps={{ sx: { borderRadius: '10px' } }} />
                    <TextField label="Email" value={form.email} size="small" type="email"
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        InputProps={{ sx: { borderRadius: '10px' } }} />
                    <FormControl size="small" required>
                        <InputLabel>Rol</InputLabel>
                        <Select value={form.idrole} label="Rol"
                            onChange={e => setForm({ ...form, idrole: e.target.value })}
                            sx={{ borderRadius: '10px' }}>
                            {roles.map(r => (
                                <MenuItem key={r.idrole} value={r.idrole}>{r.rolename}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControlLabel
                        control={<Switch checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} color="primary" />}
                        label="Activo"
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', borderRadius: '10px' }}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSave} sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={confirmOpen}
                title="Eliminar usuario"
                message={`¿Estás seguro de que deseas eliminar al usuario "${selectedUser?.username}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                onConfirm={executeDelete}
                onCancel={() => setConfirmOpen(false)}
            />
        </Paper>
    );
};

export default UserManager;
