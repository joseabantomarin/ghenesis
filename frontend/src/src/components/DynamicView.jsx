import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useMetadata } from '../context/MetadataContext';
import DynamicGrid from './DynamicGrid';

const DynamicView = ({ idform }) => {
    const { getFormDefinition, runFormEvent, permissions } = useMetadata();
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sactivateData, setSactivateData] = useState(null);

    // Almacena qué registro seleccionó el usuario en cada grilla maestra
    // Estructura: { 'idgrid_maestra': { ...datos_de_fila } }
    const [masterSelections, setMasterSelections] = useState({});

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
            setMasterSelections({}); // Resetear selecciones al recargar
        };
        if (idform) {
            loadMeta();
        }
    }, [idform]);

    const handleRowSelect = (gridId, record) => {
        setMasterSelections(prev => ({
            ...prev,
            [gridId]: record
        }));
    };

    if (loading) return <CircularProgress />;
    if (!meta) return <Alert severity="error">No se encontró definición para el módulo {idform}</Alert>;

    // 1. Separar las grillas maestras (Top-Level) de los detalles
    const masterGrids = meta.grids.filter(g => !g.gparent);

    return (
        <Box sx={{ height: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 2 }}>
            {masterGrids.length === 0 ? (
                <Alert severity="warning">No hay grillas configuradas para este módulo</Alert>
            ) : (
                masterGrids.map(gridMeta => (
                    <Box key={gridMeta.idgrid} sx={{ flexGrow: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <DynamicGrid
                            gridMeta={gridMeta}
                            idform={idform}
                            allGrids={meta.grids}
                            sactivateData={sactivateData}
                            readonlyMode={isReadonly}
                        />
                    </Box>
                ))
            )}
        </Box>
    );
};

export default DynamicView;

