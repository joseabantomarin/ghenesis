import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Stack, IconButton, CircularProgress } from '@mui/material';
import { PictureAsPdf, Close, Description, Refresh } from '@mui/icons-material';
import axios from 'axios';

/**
 * DynamicReport
 * Visor de reportes enfocado en FastReport (Próximamente API externa).
 * Por defecto muestra el PDF generado dinámicamente o permite descarga.
 */
const DynamicReport = ({ meta, ui, idreport, onClose }) => {
    const [loading, setLoading] = useState(false);

    // El ID del reporte puede venir de la prop 'idreport' (modal via ui.reporte) 
    // o indirectamente de 'meta.form.idform' (menú del sistema)
    const currentReportId = idreport || (meta?.form?.idform) || 'default_report';
    const reportTitle = meta?.form?.nombre || meta?.form?.cform || `Reporte ${currentReportId}`;

    const handleGenerate = () => {
        // En un futuro, aquí se llamará a la API de FastReport.
        // Por ahora simulamos la petición o descargamos el PDF
        window.open(`/api/dynamic/report/${currentReportId}`, '_blank');
        if (ui && ui.notify) ui.notify("Abriendo PDF del reporte...");
    };

    const handleReload = () => {
        setLoading(true);
        setTimeout(() => setLoading(false), 800);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2, bgcolor: '#fff' }}>
                <CircularProgress thickness={5} size={60} color="secondary" />
                <Typography variant="h6" color="secondary">Procesando Reporte...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#e8ecef', overflow: 'hidden' }}>

            {/* Toolbar Principal */}
            <Paper elevation={4} sx={{ zIndex: 10, borderRadius: 0, borderBottom: '1px solid #c1c1c1' }}>
                <Stack direction="row" spacing={2} sx={{ px: 2, py: 1 }} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ bgcolor: 'secondary.main', p: 0.5, borderRadius: 1, mr: 1 }}>
                            <Description sx={{ color: 'white' }} />
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1 }}>{reportTitle}</Typography>
                            <Typography variant="caption" color="textSecondary">ID: {currentReportId} / Módulo FastReport (Próximamente)</Typography>
                        </Box>
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center">
                        <Button startIcon={<Refresh />} variant="outlined" size="small" onClick={handleReload}>
                            Recargar
                        </Button>
                        <Button startIcon={<PictureAsPdf />} variant="contained" size="small" color="error" onClick={handleGenerate}>
                            Imprimir / Descargar PDF
                        </Button>
                        {onClose && (
                            <IconButton onClick={onClose} size="small" sx={{ ml: 1 }} color="default">
                                <Close />
                            </IconButton>
                        )}
                    </Stack>
                </Stack>
            </Paper>

            {/* Area Principal - Visor PDF */}
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', overflow: 'auto', p: 2 }}>
                <Paper elevation={12} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#525659' }}>
                    <iframe
                        title="PDF Viewer"
                        src={`/api/dynamic/report/${currentReportId}`}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                </Paper>
            </Box>
        </Box>
    );
};

export default DynamicReport;
