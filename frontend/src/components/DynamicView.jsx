import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useMetadata } from '../context/MetadataContext';
import DynamicGrid from './DynamicGrid';

const DynamicView = ({ idform }) => {
    const { getFormDefinition, runFormEvent } = useMetadata();
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sactivateData, setSactivateData] = useState(null);

    // Almacena qué registro seleccionó el usuario en cada grilla maestra
    // Estructura: { 'idgrid_maestra': { ...datos_de_fila } }
    const [masterSelections, setMasterSelections] = useState({});

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
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', pt: 0, pl: 0.5, pr: 2, pb: 2, overflow: 'auto', gap: 2 }}>

            {masterGrids.length === 0 ? (
                <Alert severity="warning">No hay grillas configuradas para este módulo</Alert>
            ) : (
                masterGrids.map(gridMeta => (
                    <Box key={gridMeta.idgrid} sx={{ flexGrow: 1, width: '100%', mb: 2 }}>
                        <DynamicGrid
                            gridMeta={gridMeta}
                            idform={idform}
                            allGrids={meta.grids} // Se pasan todas las grillas para que DynamicForm rutee las hijas
                            sactivateData={sactivateData} // Pasar data opcional inyectada por el Form
                        />
                    </Box>
                ))
            )}
        </Box>
    );
};

export default DynamicView;
