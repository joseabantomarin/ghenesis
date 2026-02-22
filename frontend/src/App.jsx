import React, { useState } from 'react';
import { Box, CssBaseline, AppBar, Toolbar, Typography, Drawer, CircularProgress, IconButton, Tabs, Tab, useMediaQuery } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { useMetadata } from './context/MetadataContext';
import DynamicMenu from './components/DynamicMenu';
import DynamicView from './components/DynamicView';
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
            style={{ height: '100%', display: value === index ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}
        >
            {value === index && (
                <Box sx={{ p: 0, height: '100%', pt: 1, pb: 1 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function App() {
    const { loadingMenu } = useMetadata();
    const isMobile = useMediaQuery('(max-width:690px)'); // Detectar pantalla móvil
    // Por defecto ocultar menú en móviles, mostrar en PC
    const [drawerOpen, setDrawerOpen] = useState(!isMobile);

    // Sistema de Pestañas
    const [tabs, setTabs] = useState([{ id: 'home', title: 'Home', type: 'home' }]);
    const [activeTab, setActiveTab] = useState('home');

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

    const openTab = (idform, title) => {
        if (!tabs.find(t => t.id === idform)) {
            setTabs([...tabs, { id: idform, title, type: 'view' }]);
        }
        setActiveTab(idform);
        if (isMobile) {
            setDrawerOpen(false); // Cierra automáticamente en móviles
        }
    };

    if (loadingMenu) {
        return (
            <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', height: { xs: 'calc(100vh - 90px)', sm: '100vh' } }}>
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
                    <Typography variant="h6" noWrap component="div">
                        Ghenesis - Framework Web
                    </Typography>
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
                <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f5f5f5' }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            '& .MuiTabs-indicator': {
                                backgroundColor: 'var(--active-tab-color)',
                            },
                        }}
                    >
                        {tabs.map((tab) => (
                            <Tab
                                key={tab.id}
                                value={tab.id}
                                sx={{
                                    '&.Mui-selected': {
                                        color: 'var(--active-tab-color)',
                                        fontWeight: 'bold',
                                    },
                                }}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', textTransform: 'none' }}>
                                        {tab.title}
                                        {tab.id !== 'home' && (
                                            <IconButton size="small" component="span" onClick={(e) => closeTab(e, tab.id)} sx={{ ml: 1, p: 0.2 }}>
                                                <CloseIcon fontSize="small" />
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
                                        src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                                        alt="Fondo de Sistema"
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                                    />
                                </Box>
                            ) : (
                                <DynamicView idform={tab.id} />
                            )}
                        </TabPanel>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

export default App;
