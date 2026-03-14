import React, { useState, useEffect } from 'react';
import { Box, CssBaseline, AppBar, Toolbar, Typography, Drawer, CircularProgress, IconButton, Tabs, Tab, useMediaQuery, Menu, MenuItem, Divider, Avatar, ListItemIcon as MuiListItemIcon } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import LogoutIcon from '@mui/icons-material/Logout';
import InfoIcon from '@mui/icons-material/Info';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import ArticleIcon from '@mui/icons-material/Article';
import * as Icons from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useMetadata } from './context/MetadataContext';
import { useAuth } from './context/AuthContext';
import { useSystem } from './context/SystemContext';
import DynamicMenu from './components/DynamicMenu';
import DynamicView from './components/DynamicView';
import UserManager from './components/UserManager';
import RoleManager from './components/RoleManager';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import ChangePassword from './components/ChangePassword';
import './theme.css'; // Importando Tema Global

const drawerWidth = 310;

function TabPanel(props) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
            style={{ flex: 1, display: value === index ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden', height: '100%' }}
        >
            {value === index && children}
        </div>
    );
}

// Helper para obtener icono por nombre en pestañas
const getIcon = (iconName, DefaultIcon = ArticleIcon) => {
    if (!iconName) return <DefaultIcon fontSize="small" sx={{ mr: 0.8, fontSize: 18 }} />;
    const normalized = iconName.charAt(0).toUpperCase() + iconName.slice(1);
    const IconComponent = Icons[normalized] || Icons[iconName];
    return IconComponent ? <IconComponent fontSize="small" sx={{ mr: 0.8, fontSize: 18 }} /> : <DefaultIcon fontSize="small" sx={{ mr: 0.8, fontSize: 18 }} />;
};

function App() {
    const { loading: authLoading, token, user, logout } = useAuth();
    const { loadingMenu } = useMetadata();
    const { sistemaConfig, loading: systemLoading } = useSystem();
    const isMobile = useMediaQuery('(max-width:690px)'); // Detectar pantalla móvil
    const location = useLocation(); // Hook para saber en qué URL estamos
    // Por defecto ocultar menú en móviles, mostrar en PC
    const [drawerOpen, setDrawerOpen] = useState(!isMobile);

    // Sistema de Pestañas
    const [tabs, setTabs] = useState([{ id: 'home', title: 'Home', type: 'home', icon: 'Home' }]);
    const [activeTab, setActiveTab] = useState('home');

    // Resetear pestañas al cerrar sesión o actualizar icono de Home
    useEffect(() => {
        if (!token) {
            setTabs([{ id: 'home', title: 'Home', type: 'home', icon: sistemaConfig?.icono || 'Home' }]);
            setActiveTab('home');
        } else {
            // Actualizar solo el icono del Home si cambia en la BD
            setTabs(prev => prev.map(t => t.id === 'home' ? { ...t, icon: sistemaConfig?.icono || 'Home' } : t));
        }
    }, [token, sistemaConfig?.icono]);

    // Menú de usuario (dropdown)
    const [userMenuAnchor, setUserMenuAnchor] = useState(null);
    const userMenuOpen = Boolean(userMenuAnchor);

    const toggleDrawer = () => {
        setDrawerOpen(!drawerOpen);
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const closeTab = (e, tabId) => {
        e.stopPropagation(); // Evitar que seleccione la pestaña al cerrarla
        let newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);
        if (activeTab === tabId) {
            setActiveTab(newTabs[newTabs.length - 1].id); // Mover a la última pestaña abierta
        }
    };

    const openTab = (idform, title, type, icon) => {
        const tabType = type || 'view';
        // El tabId debe ser el tipo si es especial (users/roles), pero si es 'view' debe ser el idform
        const tabId = (type && type !== 'view') ? type : idform;

        if (!tabs.find(t => t.id === tabId)) {
            setTabs([...tabs, { id: tabId, title, type: tabType, idform, icon }]);
        }
        setActiveTab(tabId);
        if (isMobile) {
            setDrawerOpen(false);
        }
    };

    const handleUserMenuOpen = (event) => {
        setUserMenuAnchor(event.currentTarget);
    };

    const handleUserMenuClose = () => {
        setUserMenuAnchor(null);
    };

    const handleLogout = () => {
        handleUserMenuClose();
        logout();
    };

    // --- Auth gates ---
    if (authLoading || systemLoading) {
        return (
            <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (location.pathname === '/reset-password') {
        return <ResetPassword />;
    }

    if (!token || !user) {
        return <Login />;
    }

    if (loadingMenu) {
        return (
            <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    // Helper: obtener iniciales del usuario
    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <Box sx={{ display: 'flex', height: '100dvh' }}>
            <CssBaseline />

            {/* Barra de Navegación Superior */}
            <AppBar
                position="fixed"
                sx={{
                    zIndex: (theme) => theme.zIndex.drawer + 1,
                    backgroundColor: 'var(--primary-color)',
                    color: 'var(--primary-text-color)'
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={toggleDrawer}
                        sx={{ mr: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        {sistemaConfig?.titulo || 'Ghenesis - Framework Web'}
                    </Typography>

                    {/* --- User Info (arriba a la derecha) --- */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={handleUserMenuOpen}>
                        <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, mr: 0.5, opacity: 0.9 }}>
                            {user?.fullname || user?.username}
                        </Typography>
                        <Avatar
                            sx={{
                                width: 34,
                                height: 34,
                                bgcolor: 'rgba(255,255,255,0.25)',
                                fontSize: '0.85rem',
                                fontWeight: 'bold',
                                border: '2px solid rgba(255,255,255,0.4)',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.35)',
                                    transform: 'scale(1.05)'
                                }
                            }}
                        >
                            {getInitials(user?.fullname || user?.username)}
                        </Avatar>
                    </Box>

                    {/* Dropdown del usuario */}
                    <Menu
                        anchorEl={userMenuAnchor}
                        open={userMenuOpen}
                        onClose={handleUserMenuClose}
                        onClick={handleUserMenuClose}
                        PaperProps={{
                            elevation: 8,
                            sx: {
                                mt: 1,
                                minWidth: 240,
                                borderRadius: '12px',
                                overflow: 'visible',
                                '&:before': {
                                    content: '""',
                                    display: 'block',
                                    position: 'absolute',
                                    top: 0,
                                    right: 20,
                                    width: 10,
                                    height: 10,
                                    bgcolor: 'background.paper',
                                    transform: 'translateY(-50%) rotate(45deg)',
                                    zIndex: 0,
                                },
                            },
                        }}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                        {/* Nombre completo */}
                        <MenuItem disabled sx={{ opacity: '1 !important' }}>
                            <MuiListItemIcon><PersonIcon fontSize="small" color="primary" /></MuiListItemIcon>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                    {user?.fullname || user?.username}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {user?.role || 'Usuario'}
                                </Typography>
                            </Box>
                        </MenuItem>

                        {/* Email */}
                        <MenuItem disabled sx={{ opacity: '1 !important' }}>
                            <MuiListItemIcon><EmailIcon fontSize="small" color="primary" /></MuiListItemIcon>
                            <Typography variant="body2">{user?.email || 'Sin email'}</Typography>
                        </MenuItem>

                        <Divider />

                        {/* About */}
                        <MenuItem onClick={handleUserMenuClose}>
                            <MuiListItemIcon><InfoIcon fontSize="small" /></MuiListItemIcon>
                            <Box>
                                <Typography variant="body2">About</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {sistemaConfig?.titulo || 'Ghenesis Framework'} v1.0
                                </Typography>
                            </Box>
                        </MenuItem>

                        <Divider />

                        {/* Cerrar sesión */}
                        <MenuItem onClick={handleLogout}>
                            <MuiListItemIcon><LogoutIcon fontSize="small" color="error" /></MuiListItemIcon>
                            <Typography variant="body2" color="error">Cerrar sesión</Typography>
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            {/* Menú Lateral (Acordeón Dinámico) */}
            <Drawer
                variant="persistent"
                open={drawerOpen}
                sx={{
                    width: drawerOpen ? drawerWidth : 0,
                    flexShrink: 0,
                    transition: (theme) => theme.transitions.create('width', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                    [`& .MuiDrawer-paper`]: {
                        width: drawerWidth,
                        boxSizing: 'border-box'
                    },
                }}
            >
                <Toolbar />
                <Box sx={{ overflow: 'auto' }}>
                    <DynamicMenu onItemClick={openTab} />
                </Box>
            </Drawer>

            {/* Contenido Principal (Pestañas Dinámicas) */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: (theme) => theme.transitions.create('margin', {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                    marginLeft: 0,
                    height: '100%',
                    overflow: 'hidden'
                }}
            >
                <Toolbar /> {/* Espaciador del AppBar superior */}

                {/* Cabecera de Pestañas */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#e0e4e7', pt: 0.5 }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            minHeight: 38,
                            '& .MuiTabs-indicator': {
                                display: 'none',
                            },
                        }}
                    >
                        {tabs.map((tab) => (
                            <Tab
                                key={tab.id}
                                value={tab.id}
                                sx={{
                                    minHeight: 32,
                                    height: 32,
                                    py: 0,
                                    px: 1.2,
                                    fontSize: '0.78rem',
                                    letterSpacing: '-0.01em',
                                    color: 'text.secondary',
                                    transition: 'all 0.15s ease',
                                    borderRadius: '6px 6px 0 0',
                                    mr: 0.2,
                                    border: '1px solid transparent',
                                    borderBottom: 'none',
                                    '&.Mui-selected': {
                                        minHeight: 38,
                                        height: 38,
                                        color: 'var(--active-tab-color)',
                                        fontWeight: 'bold',
                                        backgroundColor: '#ffffff',
                                        borderColor: 'divider',
                                        borderTop: '2.5px solid var(--active-tab-color)',
                                        boxShadow: '0 -1px 4px rgba(0,0,0,0.06)',
                                        zIndex: 1,
                                    },
                                    '&:hover': {
                                        backgroundColor: 'rgba(255,255,255,0.4)',
                                    }
                                }}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', textTransform: 'none', gap: 0.5 }}>
                                        {getIcon(tab.icon)}
                                        <Typography sx={{ fontSize: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit' }}>
                                            {tab.title}
                                        </Typography>
                                        {tab.id !== 'home' && (
                                            <IconButton size="small" component="span" onClick={(e) => closeTab(e, tab.id)} sx={{ ml: 0.5, p: 0.1, '&:hover': { color: 'error.main' } }}>
                                                <CloseIcon sx={{ fontSize: '0.9rem' }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                }
                            />
                        ))}
                    </Tabs>
                </Box>

                {/* Contenido de cada pestaña */}
                <Box sx={{ flexGrow: 1, overflow: 'hidden', bgcolor: '#eaeff1', display: 'flex', flexDirection: 'column' }}>
                    {tabs.map((tab) => (
                        <TabPanel key={tab.id} value={activeTab} index={tab.id}>
                            {tab.type === 'home' ? (
                                <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                    <img
                                        src={(isMobile && sistemaConfig?.imagen_movil) ? sistemaConfig.imagen_movil : (sistemaConfig?.imagen || 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80')}
                                        alt={sistemaConfig?.titulo || 'Fondo de Sistema'}
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                    />
                                </Box>
                            ) : tab.type === 'users' ? (
                                <UserManager />
                            ) : tab.type === 'roles' ? (
                                <RoleManager />
                            ) : tab.type === 'change-password' ? (
                                <ChangePassword />
                            ) : (
                                <DynamicView idform={tab.idform || tab.id} />
                            )}
                        </TabPanel>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

export default App;
