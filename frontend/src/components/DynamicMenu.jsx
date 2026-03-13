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
import * as Icons from '@mui/icons-material';
import { useMetadata } from '../context/MetadataContext';
import { useAuth } from '../context/AuthContext';

// Helper para obtener icono por nombre (corregido por si vienen en minúsculas)
const getIcon = (iconName, DefaultIcon = Article) => {
    if (!iconName) return <DefaultIcon fontSize="small" />;
    // Normalizar a Capitalizado (ej: user -> User)
    const normalized = iconName.charAt(0).toUpperCase() + iconName.slice(1);
    const IconComponent = Icons[normalized] || Icons[iconName];
    return IconComponent ? <IconComponent fontSize="small" /> : <DefaultIcon fontSize="small" />;
};

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

    const itemClick = (id, title, type, icon) => {
        if (onItemClick) {
            onItemClick(id, title, type, icon);
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
            
            // Si el rol es INVITADO, solo mostrar módulos con check de invitado
            if (userRole === 'INVITADO') {
                if (!perm || !perm.invitado) return false;
            }

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
                                {getIcon(item.iconname)}
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
                    onClick={() => {
                        let type = 'view';
                        let targetId = item.idform;
                        if (item.idform === 101) { type = 'users'; targetId = 'users'; }
                        else if (item.idform === 102) { type = 'roles'; targetId = 'roles'; }
                        itemClick(targetId, item.descripcion || item.cform, type, item.iconname);
                    }}
                    sx={{ py: 0.3, pl: 4 + depth * 2 }}
                >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                        {getIcon(item.iconname)}
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
                    {renderMenuItems(rootsByTipo(4), menu)}
                </MenuCategory>
            )}

            {/* 5. Sistema */}
            <MenuCategory id="sistema" label="Sistema" icon={SistemaIcon}>
                {renderMenuItems(rootsByTipo(5), menu)}
                <ListItemButton sx={{ py: 0.3, pl: 4 }} onClick={() => itemClick('change-password', 'Cambiar password', 'change-password', 'VpnKey')}>
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
