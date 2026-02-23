import React, { useState } from 'react';
import { List, ListItemButton, ListItemIcon, ListItemText, Collapse } from '@mui/material';
import {
    ExpandLess, ExpandMore, Article,
    Terminal as ProgramadorIcon,
    Storage as GeneralIcon, PlayCircle as OperacionesIcon,
    BarChart as ReportesIcon,
    SystemUpdateAlt as SistemaIcon,
    Settings as ConfiguracionIcon,
    People as UsersIcon,
    Shield as RolesIcon,
    VpnKey as PasswordIcon, Logout as LogoutIcon,
    Search as ConsultasIcon
} from '@mui/icons-material';
import { useMetadata } from '../context/MetadataContext';
import { useAuth } from '../context/AuthContext';

const DynamicMenu = ({ onItemClick }) => {
    const { menu, permissions } = useMetadata();
    const { user, logout } = useAuth();
    const [openItems, setOpenItems] = useState({
        'programador': true,
        'general': true,
        'operaciones': true,
        'consultas': true,
        'configuracion': true,
        'sistema': true
    });

    const handleClick = (id) => {
        setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const itemClick = (id, title, type) => {
        if (onItemClick) {
            onItemClick(id, title, type);
        }
    };

    // Determinar el rol del usuario (normalizado a mayúsculas)
    const userRole = (user?.role || user?.rolename || '').toUpperCase();
    const isDeveloper = userRole === 'DEVELOPER';
    const isAdmin = userRole === 'ADMINISTRADOR' || isDeveloper;

    // Filtrar items ocultos según permisos del rol
    const filterHidden = (items) => {
        return items.filter(item => {
            const perm = permissions[item.idform];
            if (perm && perm.hidden) return false;
            return true;
        });
    };

    // Renderizar items de menú. Soporta idparent para sub-árboles.
    const renderMenuItems = (items, allItems, depth = 0) => {
        return items.map(item => {
            // Buscar hijos directos — ya filtrados por permisos
            const children = filterHidden(allItems.filter(m => m.idparent === item.idform));

            if (children.length > 0) {
                // Es un nodo padre → renderizar como sub-acordeón
                const nodeId = `node_${item.idform}`;
                return (
                    <React.Fragment key={item.idform}>
                        <ListItemButton
                            onClick={() => setOpenItems(prev => ({ ...prev, [nodeId]: !prev[nodeId] }))}
                            sx={{ py: 0.3, pl: 4 + depth * 2 }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                <Article fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={item.descripcion || item.cform}
                                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                            />
                            {openItems[nodeId] ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                        </ListItemButton>
                        <Collapse in={openItems[nodeId] !== false} timeout="auto" unmountOnExit>
                            <List component="div" disablePadding>
                                {renderMenuItems(children, allItems, depth + 1)}
                            </List>
                        </Collapse>
                    </React.Fragment>
                );
            }

            // Es una hoja → renderizar como item clickeable
            return (
                <ListItemButton
                    key={item.idform}
                    onClick={() => itemClick(item.idform, item.descripcion || item.cform)}
                    sx={{ py: 0.3, pl: 4 + depth * 2 }}
                >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                        <Article fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        primary={item.descripcion || item.cform}
                        primaryTypographyProps={{ fontSize: '0.875rem' }}
                    />
                </ListItemButton>
            );
        });
    };

    // Clasificar items dinámicos por tipo — solo raíces (sin idparent)
    const rootsByTipo = (tipo) => filterHidden(menu.filter(m => m.tipo === tipo && !m.idparent));

    const MenuCategory = ({ id, label, icon: Icon, children }) => {
        const hasContent = React.Children.toArray(children).length > 0;
        if (!hasContent) return null;

        return (
            <>
                <ListItemButton onClick={() => handleClick(id)} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                        <Icon color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 'bold', fontSize: '0.9rem' }} />
                    {openItems[id] ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={openItems[id]} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                        {children}
                    </List>
                </Collapse>
            </>
        );
    };

    return (
        <List sx={{ pt: 1 }}>
            {/* 0. Programador — Solo visible para DEVELOPER */}
            {isDeveloper && (
                <MenuCategory id="programador" label="Programador" icon={ProgramadorIcon}>
                    {renderMenuItems(rootsByTipo(0), menu)}
                </MenuCategory>
            )}

            {/* 1. General */}
            <MenuCategory id="general" label="General" icon={GeneralIcon}>
                {renderMenuItems(rootsByTipo(1), menu)}
            </MenuCategory>

            {/* 2. Operaciones */}
            <MenuCategory id="operaciones" label="Operaciones" icon={OperacionesIcon}>
                {renderMenuItems(rootsByTipo(2), menu)}
            </MenuCategory>

            {/* 3. Consultas */}
            <MenuCategory id="consultas" label="Consultas" icon={ConsultasIcon}>
                {renderMenuItems(rootsByTipo(3), menu)}
            </MenuCategory>

            {/* 4. Configuración — Solo visible para DEVELOPER y ADMINISTRADOR */}
            {isAdmin && (
                <MenuCategory id="configuracion" label="Configuración" icon={ConfiguracionIcon}>
                    <ListItemButton sx={{ py: 0.3, pl: 4 }} onClick={() => itemClick('users', 'Usuarios', 'users')}>
                        <ListItemIcon sx={{ minWidth: 32 }}><UsersIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Usuarios" primaryTypographyProps={{ fontSize: '0.875rem' }} />
                    </ListItemButton>
                    <ListItemButton sx={{ py: 0.3, pl: 4 }} onClick={() => itemClick('roles', 'Roles', 'roles')}>
                        <ListItemIcon sx={{ minWidth: 32 }}><RolesIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary="Roles" primaryTypographyProps={{ fontSize: '0.875rem' }} />
                    </ListItemButton>
                    {renderMenuItems(rootsByTipo(4), menu)}
                </MenuCategory>
            )}

            {/* 5. Sistema */}
            <MenuCategory id="sistema" label="Sistema" icon={SistemaIcon}>
                {renderMenuItems(rootsByTipo(5), menu)}
                <ListItemButton sx={{ py: 0.3, pl: 4 }} onClick={() => alert('Próximamente: Cambiar Password')}>
                    <ListItemIcon sx={{ minWidth: 32 }}><PasswordIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Cambiar password" primaryTypographyProps={{ fontSize: '0.875rem' }} />
                </ListItemButton>
                <ListItemButton sx={{ py: 0.3, pl: 4 }} onClick={() => logout()}>
                    <ListItemIcon sx={{ minWidth: 32 }}><LogoutIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Cerrar sesión" primaryTypographyProps={{ fontSize: '0.875rem' }} />
                </ListItemButton>
            </MenuCategory>
        </List>
    );
};

export default DynamicMenu;
