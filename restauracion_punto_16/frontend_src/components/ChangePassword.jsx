import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, IconButton, InputAdornment, CircularProgress, Alert } from '@mui/material';
import { Visibility, VisibilityOff, LockOutlined as LockIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const ChangePassword = () => {
    const { token } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password.length < 6) {
            setError('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const res = await axios.post(`${apiBase}/api/auth/change-password`, { newPassword: password }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            if (res.data.success) {
                setSuccess(true);
                setPassword('');
                setConfirmPassword('');
            } else {
                setError(res.data.error || 'Error al cambiar la contraseña.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', height: '100%', alignItems: 'flex-start', pt: 10 }}>
            <Paper elevation={4} sx={{ p: 4, maxWidth: 500, width: '100%', borderRadius: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <LockIcon color="primary" sx={{ fontSize: 32, mr: 1.5 }} />
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1a237e' }}>Cambiar mi Contraseña</Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Escribe tu nueva contraseña. Usa una combinación de letras y números por seguridad.
                </Typography>

                {success && (
                    <Alert severity="success" sx={{ mb: 3, fontWeight: 'bold' }}>
                        ¡Tu contraseña ha sido actualizada exitosamente!
                    </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Nueva Contraseña"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                    
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Confirmar Nueva Contraseña"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading}
                    />

                    {error && (
                        <Typography color="error" variant="body2" sx={{ mt: 2, fontWeight: 'bold', textAlign: 'center' }}>
                            {error}
                        </Typography>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading}
                        sx={{ mt: 4, mb: 1, py: 1.2, fontWeight: 'bold', textTransform: 'none', borderRadius: '8px' }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Actualizar Contraseña'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default ChangePassword;
