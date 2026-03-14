import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Paper, Box, Typography, Button, IconButton, CircularProgress,
    List, ListItemButton, ListItemText, ListItemIcon, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Checkbox
} from '@mui/material';
import {
    Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon,
    Shield as ShieldIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import ConfirmDialog from './ConfirmDialog';

ModuleRegistry.registerModules([AllCommunityModule]);

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

// Roles protegidos que no se pueden eliminar
const PROTECTED_ROLE_IDS = [1, 2, 3];

const RoleManager = () => {
    const gridRef = useRef();
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [permLoading, setPermLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [roleForm, setRoleForm] = useState({ rolename: '', descripcion: '' });
    const [dirty, setDirty] = useState(false);

    // Tipos de categoría para mostrar en la grilla
    const tipoLabels = { 0: 'Programador', 1: 'General', 2: 'Operaciones', 3: 'Reportes', 4: 'Sistema' };

    const columnDefs = useMemo(() => [
        { field: 'idform', headerName: 'ID', width: 70 },
        { field: 'module_name', headerName: 'Módulo', flex: 1, minWidth: 200 },
        {
            field: 'tipo', headerName: 'Categoría', width: 130,
            valueFormatter: (params) => tipoLabels[params.value] || 'Otro'
        },
        {
            field: 'invitado', headerName: 'Invitado', width: 110,
            cellRenderer: (params) => (
                <Checkbox
                    checked={params.value || false}
                    size="small"
                    onChange={(e) => updatePermission(params.data.idform, 'invitado', e.target.checked)}
                    sx={{ p: 0 }}
                />
            ),
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
        },
        {
            field: 'readonly', headerName: 'Solo Leer', width: 110,
            cellRenderer: (params) => (
                <Checkbox
                    checked={params.value || false}
                    size="small"
                    onChange={(e) => updatePermission(params.data.idform, 'readonly', e.target.checked)}
                    sx={{ p: 0 }}
                />
            ),
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
        },
        {
            field: 'hidden', headerName: 'Ocultar', width: 100,
            cellRenderer: (params) => (
                <Checkbox
                    checked={params.value || false}
                    size="small"
                    onChange={(e) => updatePermission(params.data.idform, 'hidden', e.target.checked)}
                    sx={{ p: 0 }}
                />
            ),
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
        }
    ], [permissions]);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/auth/roles');
            if (res.data.success) setRoles(res.data.data);
        } catch (e) {
            console.error('Error loading roles', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchPermissions = async (idrole) => {
        setPermLoading(true);
        try {
            const res = await axios.get(`/api/auth/roles/${idrole}/permissions`);
            if (res.data.success) {
                setPermissions(res.data.data);
                setDirty(false);
            }
        } catch (e) {
            console.error('Error loading permissions', e);
        } finally {
            setPermLoading(false);
        }
    };

    useEffect(() => { fetchRoles(); }, []);

    const handleSelectRole = (role) => {
        if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartar?')) return;
        setSelectedRole(role);
        fetchPermissions(role.idrole);
    };

    const updatePermission = (idform, field, value) => {
        setPermissions(prev => prev.map(p =>
            p.idform === idform ? { ...p, [field]: value } : p
        ));
        setDirty(true);
        // Refrescar la grilla
        gridRef.current?.api?.refreshCells({ force: true });
    };

    const handleSavePermissions = async () => {
        if (!selectedRole) return;
        try {
            const res = await axios.post('/api/auth/roles/permissions', {
                idrole: selectedRole.idrole,
                permissions: permissions.map(p => ({
                    idform: p.idform,
                    readonly: p.readonly || false,
                    hidden: p.hidden || false,
                    invitado: p.invitado || false
                }))
            });
            if (res.data.success) {
                setDirty(false);
                alert('Permisos guardados correctamente');
            } else {
                alert('Error: ' + res.data.error);
            }
        } catch (e) {
            alert('Error: ' + (e.response?.data?.error || e.message));
        }
    };

    const openNewRole = () => {
        setRoleForm({ rolename: '', descripcion: '' });
        setDialogOpen(true);
    };

    const handleSaveRole = async () => {
        try {
            const res = await axios.post('/api/auth/roles', roleForm);
            if (res.data.success) {
                setDialogOpen(false);
                fetchRoles();
            } else {
                alert('Error: ' + res.data.error);
            }
        } catch (e) {
            alert('Error: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleDeleteRole = () => {
        if (!selectedRole || PROTECTED_ROLE_IDS.includes(selectedRole.idrole)) return;
        setConfirmOpen(true);
    };

    const executeDelete = async () => {
        setConfirmOpen(false);
        try {
            const res = await axios.delete(`/api/auth/roles/${selectedRole.idrole}`);
            if (res.data.success) {
                setSelectedRole(null);
                setPermissions([]);
                fetchRoles();
            } else {
                alert('Error: ' + res.data.error);
            }
        } catch (e) {
            alert('Error: ' + (e.response?.data?.error || e.message));
        }
    };

    return (
        <Paper elevation={3} sx={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden' }}>
            {/* Panel Izquierdo: Lista de Roles */}
            <Box sx={{
                width: 260, minWidth: 260, borderRight: '1px solid', borderColor: 'divider',
                display: 'flex', flexDirection: 'column', bgcolor: '#fafbfc'
            }}>
                <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--active-tab-color)' }}>
                        Roles
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" color="success" onClick={openNewRole}
                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                            <AddIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={handleDeleteRole}
                            disabled={!selectedRole || PROTECTED_ROLE_IDS.includes(selectedRole?.idrole)}
                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={fetchRoles}
                            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
                    ) : (
                        roles.map(role => (
                            <ListItemButton
                                key={role.idrole}
                                selected={selectedRole?.idrole === role.idrole}
                                onClick={() => handleSelectRole(role)}
                                sx={{ py: 1 }}
                            >
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    <ShieldIcon fontSize="small" color={selectedRole?.idrole === role.idrole ? 'primary' : 'action'} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={role.rolename}
                                    secondary={role.descripcion}
                                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: selectedRole?.idrole === role.idrole ? 'bold' : 'normal' }}
                                    secondaryTypographyProps={{ fontSize: '0.75rem', noWrap: true }}
                                />
                                {PROTECTED_ROLE_IDS.includes(role.idrole) && (
                                    <Chip label="Sistema" size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                                )}
                            </ListItemButton>
                        ))
                    )}
                </List>
            </Box>

            {/* Panel Derecho: Matriz de Permisos */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Header del panel */}
                <Box sx={{
                    px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: 1, borderColor: 'divider'
                }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--active-tab-color)' }}>
                        {selectedRole ? `Permisos: ${selectedRole.rolename}` : 'Seleccione un rol'}
                    </Typography>
                    {selectedRole && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<SaveIcon />}
                            disabled={!dirty}
                            onClick={handleSavePermissions}
                            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
                        >
                            Guardar
                        </Button>
                    )}
                </Box>

                {/* Grid de permisos */}
                <Box sx={{ flexGrow: 1, position: 'relative' }}>
                    {permLoading && (
                        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.5)' }}>
                            <CircularProgress />
                        </Box>
                    )}
                    {selectedRole ? (
                        <AgGridReact
                            ref={gridRef}
                            theme={gridTheme}
                            rowData={permissions}
                            columnDefs={columnDefs}
                            headerHeight={45}
                            rowHeight={40}
                            animateRows={false}
                            defaultColDef={{ sortable: true, resizable: true }}
                        />
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                            <Typography variant="body1">← Seleccione un rol para ver sus permisos</Typography>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Dialog Nuevo Rol */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { borderRadius: '16px' } }}>
                <DialogTitle sx={{ fontWeight: 'bold', pb: 1 }}>Nuevo Rol</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
                    <TextField label="Nombre del Rol" value={roleForm.rolename} required size="small"
                        onChange={e => setRoleForm({ ...roleForm, rolename: e.target.value })}
                        InputProps={{ sx: { borderRadius: '10px' } }}
                        helperText="Se guardará en mayúsculas"
                    />
                    <TextField label="Descripción" value={roleForm.descripcion} size="small"
                        onChange={e => setRoleForm({ ...roleForm, descripcion: e.target.value })}
                        InputProps={{ sx: { borderRadius: '10px' } }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', borderRadius: '10px' }}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSaveRole} sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
                        Guardar
                    </Button>
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={confirmOpen}
                title="Eliminar rol"
                message={`¿Estás seguro de que deseas eliminar el rol "${selectedRole?.rolename}"?`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                onConfirm={executeDelete}
                onCancel={() => setConfirmOpen(false)}
            />
        </Paper>
    );
};

export default RoleManager;
