import React, { useEffect, useState, useMemo } from 'react';
import { Box, CircularProgress, Alert, Tabs, Tab } from '@mui/material';
import { useMetadata } from '../context/MetadataContext';
import DynamicGrid from './DynamicGrid';

const DynamicView = ({ idform }) => {
    const { getFormDefinition, runFormEvent, permissions } = useMetadata();
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sactivateData, setSactivateData] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

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
                // Si el script devolvió UI custom o mensajes
                if (activationResult) setSactivateData(activationResult);
            }

            setLoading(false);
        };
        if (idform) {
            loadMeta();
            setActiveTab(0); // Reset tab when changing form
        }
    }, [idform]);

    // 1. Separar las grillas maestras (Top-Level) de los detalles
    const masterGrids = useMemo(() => {
        if (!meta || !meta.grids) return [];
        return meta.grids
            .filter(g => !g.gparent)
            .sort((a, b) => (a.nroframe || 0) - (b.nroframe || 0));
    }, [meta]);

    if (loading) return <CircularProgress />;
    if (!meta) return <Alert severity="error">No se encontró definición para el módulo {idform}</Alert>;

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    return (
        <Box sx={{ height: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {masterGrids.length === 0 ? (
                <Alert severity="warning">No hay grillas configuradas para este módulo</Alert>
            ) : (
                <>
                    {/* Solo mostrar pestañas si hay más de una grilla maestra */}
                    {masterGrids.length > 1 && (
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#fff' }}>
                            <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
                                {masterGrids.map((grid, index) => (
                                    <Tab key={grid.idgrid} value={index} label={grid.titulo || grid.nombre} sx={{ textTransform: 'none', fontWeight: 'bold' }} />
                                ))}
                            </Tabs>
                        </Box>
                    )}

                    {/* Renderizado de la grilla activa */}
                    <Box sx={{ flexGrow: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', p: masterGrids.length > 1 ? 0 : 0 }}>
                        <DynamicGrid
                            gridMeta={masterGrids[activeTab]}
                            idform={idform}
                            allGrids={meta.grids}
                            sactivateData={sactivateData}
                            readonlyMode={isReadonly}
                        />
                    </Box>
                </>
            )}
        </Box>
    );
};

export default DynamicView;
