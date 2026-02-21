import React, { useState } from 'react';
import { List, ListItemButton, ListItemIcon, ListItemText, Collapse } from '@mui/material';
import { ExpandLess, ExpandMore, Folder, Article } from '@mui/icons-material';
import { useMetadata } from '../context/MetadataContext';

const DynamicMenu = ({ onItemClick }) => {
    const { menu } = useMetadata();
    const [openItems, setOpenItems] = useState({});

    const handleClick = (id) => {
        setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const itemClick = (item) => {
        if (onItemClick) {
            onItemClick(item.idform, item.descripcion || item.cform);
        }
    };

    // Algoritmo para organizar el menú en un árbol basado en IDPARENT e IDFORM
    const buildMenuTree = (items, parentId = null) => {
        return items
            .filter(item => item.idparent === parentId)
            .map(item => {
                const children = buildMenuTree(items, item.idform);
                const hasChildren = children.length > 0;
                const isOpen = openItems[item.idform];

                if (hasChildren) {
                    return (
                        <React.Fragment key={item.idform}>
                            <ListItemButton onClick={() => handleClick(item.idform)} sx={{ py: 0.2 }}>
                                <ListItemIcon>
                                    <Folder />
                                </ListItemIcon>
                                <ListItemText primary={item.descripcion || item.cform} />
                                {isOpen ? <ExpandLess /> : <ExpandMore />}
                            </ListItemButton>
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                <List component="div" disablePadding sx={{ pl: 2 }}>
                                    {children}
                                </List>
                            </Collapse>
                        </React.Fragment>
                    );
                } else {
                    return (
                        <ListItemButton key={item.idform} onClick={() => itemClick(item)} sx={{ py: 0.2 }}>
                            <ListItemIcon>
                                <Article />
                            </ListItemIcon>
                            <ListItemText primary={item.descripcion || item.cform} />
                        </ListItemButton>
                    );
                }
            });
    };

    // Solo forms de tipo contenedor y opciones de UI
    return (
        <List sx={{ pt: 0 }}>
            {buildMenuTree(menu, null)}
        </List>
    );
};

export default DynamicMenu;
