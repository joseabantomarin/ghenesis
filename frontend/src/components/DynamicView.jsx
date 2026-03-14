import React, { useEffect, useState, useMemo } from 'react';
import { Box, CircularProgress, Alert, Tabs, Tab, useTheme, useMediaQuery, Dialog, DialogContent } from '@mui/material';
import { useMetadata } from '../context/MetadataContext';
import DynamicGrid from './DynamicGrid';
import DynamicReport from './DynamicReport'; // Importar el componente de reportes
import AlertDialog from './AlertDialog';
import { runGridScript } from '../utils/ScriptingEngine';
import axios from 'axios';

import { useAuth } from '../context/AuthContext';

const DynamicView = ({ idform, isActive }) => {
    const { getFormDefinition, runFormEvent, permissions } = useMetadata();
    const { user } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sactivateData, setSactivateData] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const [activeChildTab, setActiveChildTab] = useState(0);

    // Master-Detail States
    const [selectedMasterRecord, setSelectedMasterRecord] = useState(null);
    const [isMasterEditing, setIsMasterEditing] = useState(false);
    const [splitHeight, setSplitHeight] = useState(70);
    const [isDragging, setIsDragging] = useState(false);

    // Context Config for Alerts
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', severity: 'info' });

    // Global Report Dialog State
    const [reportDialogConfig, setReportDialogConfig] = useState({ open: false, idreport: null });

    // Verificar si el formulario es readonly según permisos del rol
    const isReadonly = permissions[idform]?.readonly || false;

    useEffect(() => {
        const loadMeta = async () => {
            setLoading(true);
            const definition = await getFormDefinition(idform);
            setMeta(definition);

            // Disparar Evento Sactivate en el servidor
            // Lo disparamos al cargar Y cada vez que la pestaña se vuelve activa si ya estaba cargada
            if (definition && definition.form.sactivate && isActive) {
                const activationResult = await runFormEvent(idform, 'sactivate', { userId: user?.username || 'admin' });
                if (activationResult) {
                    setSactivateData(activationResult);
                    
                    // Si el script retorna comandos de UI (alertas, notificaciones), los procesamos
                    if (activationResult.alert) {
                        setAlertConfig({
                            open: true,
                            title: activationResult.alert.title || 'Aviso del Sistema',
                            message: activationResult.alert.message || '',
                            severity: activationResult.alert.severity || 'info'
                        });
                    }
                    if (activationResult.notify) {
                        console.log("[Ghenesis Sactivate]", activationResult.notify);
                    }
                }
            }

            // Si es modo VENTANA, ejecutar el script "ejecuta" de la primera grilla
            if (definition?.form?.ventana && definition.grids && definition.grids.length > 0 && isActive) {
                const firstGrid = definition.grids[0];
                if (firstGrid.ejecuta) {
                    // Esperar un micro-tick para asegurar que el DOM de cabecera esté listo si el script lo manipula
                    setTimeout(() => {
                        runGridScript(firstGrid.ejecuta, {
                            action: 'EJECUTA',
                            grid: { api: null, columnApi: null },
                            data: [],
                            selected: {},
                            record: {},
                            api: axios,
                            ui: {
                                alert: (title, message, severity = 'info') =>
                                    setAlertConfig({ open: true, title, message, severity }),
                                notify: (msg) => console.log(`[Ghenesis Ejecuta]`, msg),
                                refresh: () => window.location.reload(),
                                reporte: (idreport) => window.dispatchEvent(new CustomEvent('open-report', { detail: idreport }))
                            }
                        });
                    }, 100);
                }
            }

            setLoading(false);
        };
        
        if (idform) {
            loadMeta();
            if (isActive) {
                setActiveTab(0);
                setSelectedMasterRecord(null);
            }
        }

        const handleOpenReport = (e) => {
            if (e.detail) {
                setReportDialogConfig({ open: true, idreport: e.detail });
            }
        };
        window.addEventListener('open-report', handleOpenReport);
        return () => window.removeEventListener('open-report', handleOpenReport);
    }, [idform, isActive]);

    // 1. Separar las grillas maestras (Top-Level) de los detalles
    const masterGrids = useMemo(() => {
        if (!meta || !meta.grids) return [];
        return meta.grids
            .filter(g => !g.gparent)
            .sort((a, b) => (a.nroframe || 0) - (b.nroframe || 0));
    }, [meta]);

    // 2. Obtener las grillas hijas de la grilla maestra activa
    const activeMasterGrid = masterGrids[activeTab];
    const childGrids = useMemo(() => {
        if (!meta || !meta.grids || !activeMasterGrid) return [];
        return meta.grids
            .filter(g => g.gparent === activeMasterGrid.idgrid)
            .sort((a, b) => (a.nroframe || 0) - (b.nroframe || 0));
    }, [meta, activeMasterGrid]);

    if (loading) return <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>;
    if (!meta) return <Alert severity="error">No se encontró definición para el módulo {idform}</Alert>;


    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
        setActiveChildTab(0);
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

    // --- RENDERIZADO ---
    let mainContent = null;

    if (meta.form.reporte) {
        mainContent = (
            <DynamicReport
                meta={meta}
                ui={{
                    alert: (title, message, severity = 'info') => setAlertConfig({ open: true, title, message, severity }),
                    notify: (msg) => console.log(`[Ghenesis Reporte]`, msg),
                    refresh: () => window.location.reload()
                }}
            />
        );
    } else if (meta.form.enlace && meta.form.enlace.trim() !== '') {
        mainContent = (
            <Box sx={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                <iframe src={meta.form.enlace} title={meta.form.nombre} width="100%" height="100%" style={{ border: 'none' }} />
            </Box>
        );
    } else if (meta.form.ventana) {
        const firstGrid = meta.grids && meta.grids.length > 0 ? meta.grids[0] : null;
        mainContent = (
            <Box sx={{ width: '100%', height: '100%', p: 2, overflow: 'auto', bgcolor: '#f8fafc' }}>
                {firstGrid?.cabecera ? (
                    <div dangerouslySetInnerHTML={{ __html: firstGrid.cabecera }} />
                ) : (
                    <Alert severity="info">La vista personalizada no tiene contenido HTML definido en la cabecera.</Alert>
                )}
            </Box>
        );
    } else {
        mainContent = (
            <Box id="split-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                sx={{ height: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: isDragging ? 'none' : 'auto' }}>
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
                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: isMobile ? 'auto' : 'hidden', height: '100%' }}>
                            <Box sx={{ height: (childGrids.length > 0 && !isMasterEditing) ? (isMobile ? '90%' : `${splitHeight}%`) : '100%', width: '100%', flexShrink: 0, minHeight: isMobile ? '400px' : '200px' }}>
                                <DynamicGrid gridMeta={activeMasterGrid} idform={idform} allGrids={meta.grids} sactivateData={sactivateData} readonlyMode={isReadonly} onRowSelect={handleRowSelect} onEditingStateChange={(editing) => setIsMasterEditing(editing)} />
                            </Box>
                            {!isMobile && childGrids.length > 0 && !isMasterEditing && (
                                <Box onMouseDown={handleMouseDown} sx={{ height: '6px', bgcolor: '#e0e0e0', cursor: 'ns-resize', '&:hover': { bgcolor: 'var(--primary-color)' }, transition: 'background-color 0.2s', flexShrink: 0, zIndex: 10 }} />
                            )}
                            {childGrids.length > 0 && !isMasterEditing && (
                                <Box sx={{ height: isMobile ? 'auto' : `${100 - splitHeight}%`, width: '100%', flexGrow: isMobile ? 0 : 1, minHeight: '150px', display: 'flex', flexDirection: 'column' }}>
                                    {childGrids.length > 1 && (
                                        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f1f5f9' }}>
                                            <Tabs 
                                                value={activeChildTab} 
                                                onChange={(e, v) => setActiveChildTab(v)} 
                                                size="small" 
                                                sx={{ minHeight: 36 }}
                                            >
                                                {childGrids.map((g, i) => (
                                                    <Tab 
                                                        key={g.idgrid} 
                                                        label={g.titulo || g.nombre} 
                                                        sx={{ textTransform: 'none', minHeight: 36, fontSize: '0.8rem', fontWeight: 600 }} 
                                                    />
                                                ))}
                                            </Tabs>
                                        </Box>
                                    )}
                                    <Box sx={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
                                        <DynamicGrid 
                                            gridMeta={childGrids[activeChildTab] || childGrids[0]} 
                                            idform={idform} 
                                            masterRecord={selectedMasterRecord} 
                                            allGrids={meta.grids} 
                                            readonlyMode={true} 
                                            simplified={true} 
                                        />
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </>
                )}
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc' }}>
            {mainContent}
            <AlertDialog
                open={alertConfig.open}
                title={alertConfig.title}
                message={alertConfig.message}
                severity={alertConfig.severity}
                onClose={() => setAlertConfig({ ...alertConfig, open: false })}
            />
            {reportDialogConfig.open && (
                <Dialog
                    open={reportDialogConfig.open}
                    onClose={() => setReportDialogConfig({ ...reportDialogConfig, open: false })}
                    fullScreen
                    sx={{ zIndex: 99999 }}
                >
                    <DynamicReport
                        idreport={reportDialogConfig.idreport}
                        onClose={() => setReportDialogConfig({ ...reportDialogConfig, open: false })}
                    />
                </Dialog>
            )}
        </Box>
    );
};

export default DynamicView;
