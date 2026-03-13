import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, IconButton, InputAdornment, Container, CircularProgress, Fade, Link, Divider } from '@mui/material';
import { Visibility, VisibilityOff, LockOutlined as LockIcon, Person as UserIcon, Email as EmailIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSystem } from '../context/SystemContext';

const Login = () => {
    const { login } = useAuth();
    const { sistemaConfig } = useSystem();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isRecovering, setIsRecovering] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [regFullname, setRegFullname] = useState('');
    const [regEmail, setRegEmail] = useState('');

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

    const handleRecoverPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const res = await axios.post(`${apiBase}/api/auth/recover-password`, { email: recoveryEmail });
            if (res.data.success) {
                setMessage(res.data.message || 'Se han enviado las instrucciones al correo indicado.');
                setRecoveryEmail('');
            } else {
                setError(res.data.error || 'Error al procesar la solicitud.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const res = await axios.post(`${apiBase}/api/auth/register`, { 
                username, 
                password, 
                fullname: regFullname, 
                email: regEmail 
            });
            if (res.data.success) {
                setMessage(res.data.message || 'Usuario registrado exitosamente.');
                setIsRegistering(false);
                setUsername('');
                setPassword('');
                setRegFullname('');
                setRegEmail('');
            } else {
                setError(res.data.error || 'Error al registrar usuario.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Error de conexión. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    // Fondo dinámico del login
    const loginBackground = sistemaConfig?.login_bg || 'linear-gradient(135deg, #1976d2 0%, #1565c0 50%, #0d47a1 100%)';

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: loginBackground,
                p: 3
            }}
        >
            <Fade in={true} timeout={800}>
                <Container maxWidth="xs">
                    <Paper
                        elevation={24}
                        sx={{
                            p: 3, // Reducido de 4 a 3
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
                        {/* Logo / Imagen del Login */}
                        {sistemaConfig?.imagen_login ? (
                            <Box sx={{ m: 0.5, mb: 1, maxWidth: 100, maxHeight: 100 }}>
                                <img
                                    src={sistemaConfig.imagen_login}
                                    alt={sistemaConfig?.titulo || 'Logo'}
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                />
                            </Box>
                        ) : (
                            <Box
                                sx={{
                                    m: 0.5,
                                    bgcolor: 'primary.main',
                                    width: 50,
                                    height: 50,
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    mb: 1,
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                                }}
                            >
                                <LockIcon fontSize="medium" />
                            </Box>
                        )}

                        <Typography component="h1" variant="h5" sx={{ fontWeight: 800, mb: 0.5, color: '#1a237e' }}>
                            {sistemaConfig?.titulo || 'Ghenesis'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, textAlign: 'center' }}>
                            {isRecovering 
                                ? 'Ingresa tu correo para recuperar el acceso.' 
                                : isRegistering 
                                    ? 'Crea tu cuenta de acceso como INVITADO.' 
                                    : (sistemaConfig?.subtitulo || 'Framework Web Metadata-Driven')
                            }
                        </Typography>

                        {isRecovering ? (
                        <Box component="form" onSubmit={handleRecoverPassword} sx={{ mt: 0, width: '100%' }}>
                            <TextField
                                margin="dense"
                                required
                                fullWidth
                                label="Correo electrónico"
                                autoFocus
                                type="email"
                                value={recoveryEmail}
                                onChange={(e) => setRecoveryEmail(e.target.value)}
                                InputLabelProps={{ sx: { color: 'black !important', '&.Mui-focused': { color: 'primary.main !important' } } }}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><EmailIcon color="primary" /></InputAdornment>,
                                    sx: { borderRadius: '12px' }
                                }}
                                sx={{ mb: 1.5 }}
                            />

                            {error && (
                                <Typography color="error" variant="body2" sx={{ mt: 1, textAlign: 'center', fontWeight: 'bold' }}>{error}</Typography>
                            )}
                            {message && (
                                <Typography color="success.main" variant="body2" sx={{ mt: 1, textAlign: 'center', fontWeight: 'bold' }}>{message}</Typography>
                            )}

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="large"
                                disabled={loading}
                                sx={{ 
                                    mt: 2, 
                                    mb: 1.5, 
                                    borderRadius: '12px', 
                                    py: 1.2, 
                                    fontWeight: 'bold', 
                                    textTransform: 'none',
                                    boxShadow: '0 10px 20px rgba(25, 118, 210, 0.3)'
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : 'Recuperar Contraseña'}
                            </Button>
                            
                            <Button
                                fullWidth
                                variant="text"
                                onClick={() => { setIsRecovering(false); setError(''); setMessage(''); }}
                                startIcon={<ArrowBackIcon />}
                                disabled={loading}
                                sx={{ textTransform: 'none', fontWeight: 'bold' }}
                            >
                                Volver al login
                            </Button>
                        </Box>
                        ) : isRegistering ? (
                        <Box component="form" onSubmit={handleRegister} sx={{ mt: 0, width: '100%' }}>
                            <TextField margin="dense" required fullWidth label="Nombre de Usuario" autoFocus value={username} onChange={(e) => setUsername(e.target.value)}
                                InputLabelProps={{ sx: { color: 'black !important', '&.Mui-focused': { color: 'primary.main !important' } } }}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><UserIcon color="primary" /></InputAdornment>,
                                    sx: { borderRadius: '12px' }
                                }}
                                sx={{ mb: 1 }}
                            />
                            <TextField margin="dense" required fullWidth label="Nombre Completo" value={regFullname} onChange={(e) => setRegFullname(e.target.value)}
                                InputLabelProps={{ sx: { color: 'black !important', '&.Mui-focused': { color: 'primary.main !important' } } }}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><UserIcon color="primary" /></InputAdornment>,
                                    sx: { borderRadius: '12px' }
                                }}
                                sx={{ mb: 1 }}
                            />
                            <TextField margin="dense" required fullWidth label="Correo Electrónico" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                                InputLabelProps={{ sx: { color: 'black !important', '&.Mui-focused': { color: 'primary.main !important' } } }}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><EmailIcon color="primary" /></InputAdornment>,
                                    sx: { borderRadius: '12px' }
                                }}
                                sx={{ mb: 1 }}
                            />
                            <TextField margin="dense" required fullWidth label="Contraseña" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
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
                                sx={{ mb: 1 }}
                            />

                            {error && <Typography color="error" variant="body2" sx={{ mt: 1, textAlign: 'center', fontWeight: 'bold' }}>{error}</Typography>}
                            {message && <Typography color="success.main" variant="body2" sx={{ mt: 1, textAlign: 'center', fontWeight: 'bold' }}>{message}</Typography>}

                            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
                                sx={{ 
                                    mt: 2, mb: 1.5, borderRadius: '12px', py: 1.2, fontWeight: 'bold', 
                                    textTransform: 'none', boxShadow: '0 10px 20px rgba(25, 118, 210, 0.3)' 
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : 'Registrar Cuenta'}
                            </Button>

                            <Button fullWidth variant="text" onClick={() => { setIsRegistering(false); setError(''); setMessage(''); setUsername(''); setPassword(''); }} startIcon={<ArrowBackIcon />} disabled={loading} sx={{ textTransform: 'none', fontWeight: 'bold' }}>
                                Volver al login
                            </Button>
                        </Box>
                        ) : (
                        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 0, width: '100%' }}>
                            <TextField
                                margin="dense"
                                required
                                fullWidth
                                label="Usuario"
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                InputLabelProps={{
                                    sx: {
                                        color: 'black !important',
                                        '&.Mui-focused': { color: 'primary.main !important' }
                                    }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <UserIcon color="primary" />
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
                                label="Contraseña"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                InputLabelProps={{
                                    sx: {
                                        color: 'black !important',
                                        '&.Mui-focused': { color: 'primary.main !important' }
                                    }
                                }}
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
                                sx={{ mb: 1 }}
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
                                    mt: 2,
                                    mb: 1.5,
                                    borderRadius: '12px',
                                    py: 1.2,
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

                            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', px: 1 }}>
                                <Link 
                                    component="button" 
                                    variant="body2" 
                                    type="button" 
                                    disabled={loading}
                                    onClick={(e) => { e.preventDefault(); setError(''); setMessage(''); setIsRegistering(true); }}
                                    sx={{ fontWeight: 'bold', '&:hover': { color: 'primary.dark' } }}
                                >
                                    REGISTRARSE
                                </Link>
                                <Link 
                                    component="button" 
                                    variant="body2" 
                                    type="button" 
                                    disabled={loading}
                                    onClick={(e) => { e.preventDefault(); setError(''); setMessage(''); setIsRecovering(true); }}
                                    sx={{ fontWeight: 'bold', '&:hover': { color: 'primary.dark' } }}
                                >
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </Box>
                        </Box>
                        )}

                        <Box sx={{ mt: 3, width: '100%', textAlign: 'center' }}>
                            <Divider sx={{ mb: 2 }} />
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {sistemaConfig?.copyright || `© ${new Date().getFullYear()} Ghenesis Framework. Todos los derechos reservados.`}
                            </Typography>
                        </Box>
                    </Paper>
                </Container>
            </Fade>
        </Box>
    );
};

export default Login;
