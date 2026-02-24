import React, { useEffect, useState, useMemo } from 'react';
import { Box, CircularProgress, Alert, Tabs, Tab, useTheme, useMediaQuery } from '@mui/material';
import { useMetadata } from '../context/MetadataContext';
import DynamicGrid from './DynamicGrid';

const DynamicView = ({ idform }) => {
    const { getFormDefinition, runFormEvent, permissions } = useMetadata();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sactivateData, setSactivateData] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    // Master-Detail States
    const [selectedMasterRecord, setSelectedMasterRecord] = useState(null);
    const [splitHeight, setSplitHeight] = useState(70); // % para el maestro en desktop
    const [isDragging, setIsDragging] = useState(false);

    // Verificar si el formulario es readonly según permisos del rol
    const isReadonly = permissions[idform]?.readonly || false;

    useEffect(() => {
        const loadMeta = async () => {
            setLoading(true);
            const definition = await getFormDefinition(idform);
            setMeta(definition);

            // Disparar Evento Sactivate en el servidor
            if (definition && definition.form.sactivate) {
                const activationResult = await runFormEvent(idform, 'sactivate', { userId: 'admin' });
                if (activationResult) setSactivateData(activationResult);
            }

            setLoading(false);
        };
        if (idform) {
            loadMeta();
            setActiveTab(0);
            setSelectedMasterRecord(null);
        }
    }, [idform]);

    // 1. Separar las grillas maestras (Top-Level) de los detalles
    const masterGrids = useMemo(() => {
        if (!meta || !meta.grids) return [];
        return meta.grids
            .filter(g => !g.gparent)
            .sort((a, b) => (a.nroframe || 0) - (b.nroframe || 0));
    }, [meta]);

    // 2. Obtener el primer hijo de la grilla maestra activa
    const activeMasterGrid = masterGrids[activeTab];
    const childGrid = useMemo(() => {
        if (!meta || !meta.grids || !activeMasterGrid) return null;
        return meta.grids.find(g => g.gparent === activeMasterGrid.idgrid);
    }, [meta, activeMasterGrid]);

    if (loading) return <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>;
    if (!meta) return <Alert severity="error">No se encontró definición para el módulo {idform}</Alert>;

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
        setSelectedMasterRecord(null);
    };

    const handleRowSelect = (idgrid, row) => {
        if (activeMasterGrid?.idgrid === idgrid) {
            setSelectedMasterRecord(row);
        }
    };

    // Lógica del Splitter
    const handleMouseDown = () => setIsDragging(true);
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const container = document.getElementById('split-container');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const newHeight = (offsetY / rect.height) * 100;
        if (newHeight > 20 && newHeight < 80) {
            setSplitHeight(newHeight);
        }
    };

    return (
        <Box
            id="split-container"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            sx={{
                height: '100%',
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                userSelect: isDragging ? 'none' : 'auto'
            }}
        >
            {masterGrids.length === 0 ? (
                <Alert severity="warning">No hay grillas configuradas para este módulo</Alert>
            ) : (
                <>
                    {masterGrids.length > 1 && (
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#fff' }}>
                            <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
                                {masterGrids.map((grid, index) => (
                                    <Tab key={grid.idgrid} value={index} label={grid.titulo || grid.nombre} sx={{ textTransform: 'none', fontWeight: 'bold' }} />
                                ))}
                            </Tabs>
                        </Box>
                    )}

                    <Box sx={{
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: isMobile ? 'auto' : 'hidden',
                        height: '100%'
                    }}>
                        {/* Grilla Maestra */}
                        <Box sx={{
                            height: childGrid
                                ? (isMobile ? '90%' : `${splitHeight}%`)
                                : '100%',
                            width: '100%',
                            flexShrink: 0,
                            minHeight: isMobile ? '400px' : '200px'
                        }}>
                            <DynamicGrid
                                gridMeta={activeMasterGrid}
                                idform={idform}
                                allGrids={meta.grids}
                                sactivateData={sactivateData}
                                readonlyMode={isReadonly}
                                onRowSelect={handleRowSelect}
                            />
                        </Box>

                        {/* Splitter (Solo en escritorio y si hay hijo) */}
                        {!isMobile && childGrid && (
                            <Box
                                onMouseDown={handleMouseDown}
                                sx={{
                                    height: '6px',
                                    bgcolor: '#e0e0e0',
                                    cursor: 'ns-resize',
                                    '&:hover': { bgcolor: 'var(--primary-color)' },
                                    transition: 'background-color 0.2s',
                                    flexShrink: 0,
                                    zIndex: 10
                                }}
                            />
                        )}

                        {/* Grilla Detalle */}
                        {childGrid && (
                            <Box sx={{
                                height: isMobile ? 'auto' : `${100 - splitHeight}%`,
                                width: '100%',
                                flexGrow: isMobile ? 0 : 1,
                                minHeight: '150px'
                            }}>
                                <DynamicGrid
                                    gridMeta={childGrid}
                                    idform={idform}
                                    masterRecord={selectedMasterRecord}
                                    allGrids={meta.grids}
                                    readonlyMode={true}
                                    simplified={true}
                                />
                            </Box>
                        )}
                    </Box>
                </>
            )}
        </Box>
    );
};

export default DynamicView;
