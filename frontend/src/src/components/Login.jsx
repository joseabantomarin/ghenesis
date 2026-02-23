import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, IconButton, InputAdornment, Container, CircularProgress, Fade } from '@mui/material';
import { Visibility, VisibilityOff, LockOutlined as LockIcon, Person as UserIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(username, password);
        if (!result.success) {
            setError(result.error);
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)',
                p: 3
            }}
        >
            <Fade in={true} timeout={800}>
                <Container maxWidth="xs">
                    <Paper
                        elevation={24}
                        sx={{
                            p: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            borderRadius: '24px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                        }}
                    >
                        <Box
                            sx={{
                                m: 1,
                                bgcolor: 'primary.main',
                                width: 60,
                                height: 60,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                mb: 2,
                                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                            }}
                        >
                            <LockIcon fontSize="large" />
                        </Box>

                        <Typography component="h1" variant="h4" sx={{ fontWeight: 800, mb: 1, color: '#1a237e' }}>
                            Ghenesis
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                            Framework Web Metadata-Driven
                        </Typography>

                        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                label="Usuario"
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <UserIcon color="primary" />
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: '12px' }
                                }}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                label="Contraseña"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockIcon color="primary" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: '12px' }
                                }}
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
                                disabled={loading}
                                sx={{
                                    mt: 4,
                                    mb: 2,
                                    borderRadius: '12px',
                                    py: 1.5,
                                    fontWeight: 'bold',
                                    fontSize: '1rem',
                                    textTransform: 'none',
                                    boxShadow: '0 10px 20px rgba(25, 118, 210, 0.3)',
                                    '&:hover': {
                                        boxShadow: '0 15px 30px rgba(25, 118, 210, 0.4)',
                                    }
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : 'Iniciar Sesión'}
                            </Button>

                            <Box sx={{ mt: 2, textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    &copy; {new Date().getFullYear()} Ghenesis Framework. Todos los derechos reservados.
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Container>
            </Fade>
        </Box>
    );
};

export default Login;
