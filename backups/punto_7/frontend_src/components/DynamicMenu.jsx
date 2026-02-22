import React, { useState } from 'react';
import { List, ListItemButton, ListItemIcon, ListItemText, Collapse } from '@mui/material';
import {
    ExpandLess, ExpandMore, Folder, Article,
    Settings as ConfigIcon, Terminal as ProgramadorIcon,
    Storage as GeneralIcon, PlayCircle as OperacionesIcon,
    BarChart as ReportesIcon, Person as UsersIcon,
    Shield as RolesIcon, SystemUpdateAlt as SistemaIcon,
    VpnKey as PasswordIcon, Logout as LogoutIcon
} from '@mui/icons-material';
import { useMetadata } from '../context/MetadataContext';

const DynamicMenu = ({ onItemClick }) => {
    const { menu } = useMetadata();
    const [openItems, setOpenItems] = useState({
        'programador': true,
        'general': true,
        'operaciones': true,
        'reportes': true,
        'configuracion': true,
        'sistema': true
    });

    const handleClick = (id) => {
        setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const itemClick = (id, title, type = 'dynamic') => {
        if (onItemClick) {
            onItemClick(id, title, type);
        }
    };

    const renderDynamicItems = (items) => {
        return items.map(item => (
            <ListItemButton key={item.idform} onClick={() => itemClick(item.idform, item.descripcion || item.cform)} sx={{ py: 0.3, pl: 4 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                    <Article fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item.descripcion || item.cform} primaryTypographyProps={{ fontSize: '0.875rem' }} />
            </ListItemButton>
        ));
    };

    // Clasificar items dinámicos por tipo (según arquitectura Ghenesis)
    const programadorItems = menu.filter(m => m.tipo === 0 && !m.idparent);
    const generalItems = menu.filter(m => m.tipo === 1 && !m.idparent);
    const operacionesItems = menu.filter(m => m.tipo === 2 && !m.idparent);
    const reportesItems = menu.filter(m => m.tipo === 3 && !m.idparent);

    const MenuCategory = ({ id, label, icon: Icon, children }) => (
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

    return (
        <List sx={{ pt: 1 }}>
            {/* 1. Programador */}
            <MenuCategory id="programador" label="Programador" icon={ProgramadorIcon}>
                {renderDynamicItems(programadorItems)}
            </MenuCategory>

            {/* 2. General */}
            <MenuCategory id="general" label="General" icon={GeneralIcon}>
                {renderDynamicItems(generalItems)}
            </MenuCategory>

            {/* 3. Operaciones */}
            <MenuCategory id="operaciones" label="Operaciones" icon={OperacionesIcon}>
                {renderDynamicItems(operacionesItems)}
            </MenuCategory>

            {/* 4. Reportes */}
            <MenuCategory id="reportes" label="Reportes" icon={ReportesIcon}>
                {renderDynamicItems(reportesItems)}
            </MenuCategory>

            {/* 5. Configuración */}
            <MenuCategory id="configuracion" label="Configuración" icon={ConfigIcon}>
                <ListItemButton sx={{ py: 0.3, pl: 4 }} onClick={() => itemClick('users', 'Gestión de Usuarios', 'users')}>
                    <ListItemIcon sx={{ minWidth: 32 }}><UsersIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Users" primaryTypographyProps={{ fontSize: '0.875rem' }} />
                </ListItemButton>
                <ListItemButton sx={{ py: 0.3, pl: 4 }} onClick={() => itemClick('roles', 'Matriz de Permisos', 'roles')}>
                    <ListItemIcon sx={{ minWidth: 32 }}><RolesIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Roles" primaryTypographyProps={{ fontSize: '0.875rem' }} />
                </ListItemButton>
            </MenuCategory>

            {/* 6. Sistema */}
            <MenuCategory id="sistema" label="Sistema" icon={SistemaIcon}>
                <ListItemButton sx={{ py: 0.3, pl: 4 }} onClick={() => alert('Próximamente: Cambiar Password')}>
                    <ListItemIcon sx={{ minWidth: 32 }}><PasswordIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Cambiar password" primaryTypographyProps={{ fontSize: '0.875rem' }} />
                </ListItemButton>
                <ListItemButton sx={{ py: 0.3, pl: 4 }} onClick={() => window.confirm('¿Cerrar sesión?') && alert('Logout')}>
                    <ListItemIcon sx={{ minWidth: 32 }}><LogoutIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary="Cerrar sesión" primaryTypographyProps={{ fontSize: '0.875rem' }} />
                </ListItemButton>
            </MenuCategory>
        </List>
    );
};

export default DynamicMenu;
