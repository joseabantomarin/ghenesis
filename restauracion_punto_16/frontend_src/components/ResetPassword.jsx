import React, { useState, useEffect } from 'react';
import { Box, Paper, TextField, Button, Typography, IconButton, InputAdornment, Container, CircularProgress, Fade } from '@mui/material';
import { Visibility, VisibilityOff, LockOutlined as LockIcon, CheckCircleOutline as CheckIcon } from '@mui/icons-material';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSystem } from '../context/SystemContext';
import axios from 'axios';

const ResetPassword = () => {
    const { sistemaConfig } = useSystem();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    // El token viaja en la URL: /reset-password?token=XYZ
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setError('Enlace de recuperación inválido o ausente. Verifica que hayas copiado todo el enlace de tu correo.');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const res = await axios.post(`${apiBase}/api/auth/reset-password`, { token, newPassword: password });
            
            if (res.data.success) {
                setSuccess(true);
            } else {
                setError(res.data.error || 'Error al restablecer la contraseña.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error de conexión con el servidor. El token pudo haber expirado.');
        } finally {
            setLoading(false);
        }
    };

    // Fondo dinámico del login
    const loginBackground = sistemaConfig?.login_bg || 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)';

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: loginBackground, p: 3 }}>
            <Fade in={true} timeout={800}>
                <Container maxWidth="xs">
                    <Paper elevation={24} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.3)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
                        <Box sx={{ m: 0.5, bgcolor: 'primary.main', width: 50, height: 50, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', mb: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                            <LockIcon fontSize="medium" />
                        </Box>

                        <Typography component="h1" variant="h5" sx={{ fontWeight: 800, mb: 0.5, color: '#1a237e' }}>Restablecer Acceso</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, textAlign: 'center' }}>
                            {success ? '¡Hecho! Tu contraseña se ha actualizado exitosamente.' : 'Crea una nueva contraseña segura para tu cuenta de Ghenesis.'}
                        </Typography>

                        {success ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                <CheckIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                                <Button fullWidth variant="contained" size="large" onClick={() => navigate('/')} sx={{ borderRadius: '12px', py: 1.2, fontWeight: 'bold', textTransform: 'none' }}>
                                    Ir a Iniciar Sesión
                                </Button>
                            </Box>
                        ) : (
                            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 0, width: '100%' }}>
                                <TextField
                                    margin="dense"
                                    required
                                    fullWidth
                                    label="Nueva Contraseña"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={!token || loading}
                                    InputLabelProps={{ sx: { color: 'black !important', '&.Mui-focused': { color: 'primary.main !important' } } }}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><LockIcon color="primary" /></InputAdornment>,
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                        sx: { borderRadius: '12px' }
                                    }}
                                    sx={{ mb: 1.5 }}
                                />

                                <TextField
                                    margin="dense"
                                    required
                                    fullWidth
                                    label="Confirmar Contraseña"
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={!token || loading}
                                    InputLabelProps={{ sx: { color: 'black !important', '&.Mui-focused': { color: 'primary.main !important' } } }}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><LockIcon color="primary" /></InputAdornment>,
                                        sx: { borderRadius: '12px' }
                                    }}
                                    sx={{ mb: 1.5 }}
                                />

                                {error && (
                                    <Typography color="error" variant="body2" sx={{ mt: 1, textAlign: 'center', fontWeight: 'bold' }}>
                                        {error}
                                    </Typography>
                                )}

                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    disabled={!token || loading}
                                    sx={{ mt: 2, mb: 1.5, borderRadius: '12px', py: 1.2, fontWeight: 'bold', fontSize: '1rem', textTransform: 'none', boxShadow: '0 10px 20px rgba(25, 118, 210, 0.3)' }}
                                >
                                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Guardar Contraseña'}
                                </Button>

                                <Button fullWidth variant="text" onClick={() => navigate('/')} disabled={loading} sx={{ textTransform: 'none', fontWeight: 'bold' }}>
                                    Cancelar y Volver
                                </Button>
                            </Box>
                        )}
                    </Paper>
                </Container>
            </Fade>
        </Box>
    );
};

export default ResetPassword;
