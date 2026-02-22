import React, { useState, useEffect } from 'react';
import {
    Box, Paper, Typography, Grid, List, ListItemButton, ListItemText,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Checkbox, Button, CircularProgress, Divider
} from '@mui/material';
import { Save as SaveIcon, Shield as RoleIcon } from '@mui/icons-material';
import axios from 'axios';

const RoleManager = () => {
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await axios.get('/api/auth/roles');
            if (res.data.success) {
                setRoles(res.data.data);
                if (res.data.data.length > 0 && !selectedRole) {
                    handleSelectRole(res.data.data[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const handleSelectRole = async (role) => {
        setSelectedRole(role);
        setLoading(true);
        try {
            const res = await axios.get(`/api/auth/roles/${role.idrole}/permissions`);
            if (res.data.success) {
                setPermissions(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (formId, field) => {
        setPermissions(prev => prev.map(p =>
            p.idform === formId ? { ...p, [field]: !p[field] } : p
        ));
    };

    const handleSave = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            const res = await axios.post('/api/auth/roles/permissions', {
                idrole: selectedRole.idrole,
                permissions
            });
            if (res.data.success) {
                alert('Permisos guardados correctamente');
            }
        } catch (error) {
            alert('Error al guardar permisos: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: 'var(--primary-color)' }}>
                Gestión de Roles y Matriz de Permisos
            </Typography>

            <Grid container spacing={3} sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {/* Lista de Roles */}
                <Grid item xs={12} md={3} sx={{ height: '100%' }}>
                    <Paper elevation={2} sx={{ height: '100%', overflowY: 'auto', borderRadius: '12px' }}>
                        <List>
                            <Box sx={{ px: 2, py: 1 }}>
                                <Typography variant="overline" sx={{ fontWeight: 'bold' }}>Roles Disponibles</Typography>
                            </Box>
                            <Divider />
                            {roles.map(role => (
                                <ListItemButton
                                    key={role.idrole}
                                    selected={selectedRole?.idrole === role.idrole}
                                    onClick={() => handleSelectRole(role)}
                                    sx={{
                                        '&.Mui-selected': {
                                            bgcolor: 'rgba(var(--primary-color-rgb, 25,118,210), 0.12)',
                                            borderRight: '4px solid var(--primary-color)'
                                        }
                                    }}
                                >
                                    <RoleIcon sx={{ mr: 2, color: selectedRole?.idrole === role.idrole ? 'var(--primary-color)' : 'action.active' }} />
                                    <ListItemText primary={role.rolename} secondary={role.descripcion} />
                                </ListItemButton>
                            ))}
                        </List>
                    </Paper>
                </Grid>

                {/* Matriz de Permisos */}
                <Grid item xs={12} md={9} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Paper elevation={2} sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '12px', overflow: 'hidden' }}>
                        <Box sx={{ p: 2, bgcolor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                            <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
                                Permisos para: <strong>{selectedRole?.rolename}</strong>
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                onClick={handleSave}
                                disabled={saving || !selectedRole}
                                sx={{ borderRadius: '8px', textTransform: 'none' }}
                            >
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                        </Box>

                        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                            {loading ? (
                                <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <TableContainer>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Módulo / Formulario</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Ver</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Crear</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Editar</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Borrar</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {permissions.map((row) => (
                                                <TableRow key={row.idform} hover>
                                                    <TableCell>{row.module_name || `Form ${row.idform}`}</TableCell>
                                                    <TableCell align="center">
                                                        <Checkbox
                                                            checked={row.can_view}
                                                            onChange={() => handleToggle(row.idform, 'can_view')}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Checkbox
                                                            checked={row.can_create}
                                                            onChange={() => handleToggle(row.idform, 'can_create')}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Checkbox
                                                            checked={row.can_update}
                                                            onChange={() => handleToggle(row.idform, 'can_update')}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Checkbox
                                                            checked={row.can_delete}
                                                            onChange={() => handleToggle(row.idform, 'can_delete')}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default RoleManager;
