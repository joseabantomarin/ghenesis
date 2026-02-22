import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Grid, MenuItem, Checkbox, FormControlLabel, Paper, Divider } from '@mui/material';
import { Save as SaveIcon, Close as CancelIcon } from '@mui/icons-material';
import axios from 'axios';
import DynamicGrid from './DynamicGrid';

const DynamicForm = ({ gridMeta, idform, record, onClose, allGrids }) => {
    const [formData, setFormData] = useState(record || {});

    // Extraer campos configurados para edición (eoculto = false)
    // Respetar el orden de columnas guardado por el usuario en la grilla
    const editFields = (() => {
        const allFields = (gridMeta.fields || []).filter(f => !f.eoculto);

        let savedState = {};
        try {
            const stored = localStorage.getItem(`grid-col-state-${gridMeta.idgrid}`);
            if (stored) savedState = JSON.parse(stored);
        } catch (e) { }

        if (Object.keys(savedState).length > 0) {
            // Campos visibles en la grilla: orden del usuario
            const visible = allFields
                .filter(f => savedState[f.campo] !== undefined)
                .sort((a, b) => (savedState[a.campo]?.index ?? 999) - (savedState[b.campo]?.index ?? 999));
            // Campos no visibles en la grilla: al final, por posición original
            const hidden = allFields
                .filter(f => savedState[f.campo] === undefined)
                .sort((a, b) => a.posicion - b.posicion);
            return [...visible, ...hidden];
        }

        return allFields.sort((a, b) => a.posicion - b.posicion);
    })();

    // Típico SActivate / SNewRecord inyectado
    useEffect(() => {
        // Si isNewRecord (record está vacío) ejecutamos SNewRecord
        if (Object.keys(record).length === 0 && gridMeta.snewrecord) {
            try {
                // En un entorno seguro (Sandbox/Function) evaluamos el JS de SNewRecord
                // Por simplicidad en MVP armamos una función segura usando constructor
                const scriptFunc = new Function('formData', 'setFormData', gridMeta.snewrecord);
                scriptFunc(formData, setFormData);
            } catch (e) {
                console.error("Error evaluando SNewRecord", e);
            }
        }
    }, []);

    const handleChange = (campo, valor) => {
        setFormData(prev => ({ ...prev, [campo]: valor }));

        // Aquí evaluaríamos SValida al cambiar valor
        const fieldMeta = editFields.find(f => f.campo === campo);
        if (fieldMeta && fieldMeta.svalida) {
            try {
                const validateFunc = new Function('formData', 'setFormData', 'valor', fieldMeta.svalida);
                validateFunc(formData, setFormData, valor);
            } catch (e) {
                console.error(`Error script svalida en ${campo}`, e);
            }
        }
    };

    const handleSave = async () => {
        // JS Before Post
        if (gridMeta.ssave) {
            try {
                const beforePost = new Function('formData', gridMeta.ssave);
                const allow = beforePost(formData);
                if (allow === false) return; // Validación falló
            } catch (e) {
                console.error("Error ssave", e);
            }
        }

        try {
            // Mapeo exhaustivo para determinar la Llave Primaria real según la arquitectura de Ghenesis (Prioridad de hijos a padres)
            const isUpdate = record && Object.keys(record).length > 0;
            let finalRecordId = null;

            if (isUpdate) {
                const metaPkField = gridMeta.fields?.find(f => f.pk === true || f.campo === `id${gridMeta.vquery}`);
                let bestPk = metaPkField ? metaPkField.campo : null;

                if (!bestPk || record[bestPk] === undefined) {
                    const pkHierarchy = ['idf', 'idgrid', 'idcontrol', 'idreport', 'idtable', 'idconsult', 'idfunction', 'idfile', 'idsistema', 'idform', 'id'];
                    bestPk = pkHierarchy.find(key => record[key] !== undefined) || Object.keys(record)[0];
                }
                finalRecordId = bestPk ? record[bestPk] : null;
            }

            const res = await axios.post(`/api/dynamic/data/${idform}/${gridMeta.idgrid}`, {
                data: formData,
                isUpdate: isUpdate,
                recordId: finalRecordId
            });

            if (res.data.success) {
                // JS After Post
                if (gridMeta.ssavepost) {
                    try {
                        const afterPost = new Function('formData', gridMeta.ssavepost);
                        afterPost(formData);
                    } catch (e) {
                        console.error("Error ssavepost", e);
                    }
                }
                onClose();
            } else {
                alert('No se pudo guardar: ' + res.data.error);
            }
        } catch (error) {
            alert('Error conectando al servidor: ' + error.message);
        }
    };

    return (
        <Paper elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Contenedor del Formulario Real con Grid (Todo con Scroll) */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', pb: 3 }}>

                {/* Header ahora escroleable */}
                <Box
                    sx={{
                        px: { xs: '5px', sm: 2 },
                        py: { xs: '5px', sm: 2 },
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: { xs: 1.5, sm: 0 },
                        backgroundColor: gridMeta.gparent ? '#f9f9f9' : 'background.paper',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        mb: 3
                    }}
                >
                    <Typography variant="h6" sx={{ m: 0, fontSize: { xs: '0.95rem', sm: '1.25rem' }, fontWeight: 'bold', color: 'var(--active-tab-color)', whiteSpace: 'normal', lineHeight: 1.2, mb: { xs: 1, sm: 0 } }}>
                        Edición - {gridMeta.titulo}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, boxSizing: 'border-box', justifyContent: { xs: 'space-between', sm: 'flex-start' } }}>
                        <Button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            variant="outlined"
                            color="inherit"
                            startIcon={<CancelIcon />}
                            sx={{ borderRadius: '8px', textTransform: 'none', px: { xs: 1.5, sm: 2 }, py: 0.75, fontWeight: 600, flex: { xs: 1, sm: 'none' } }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={(e) => { e.stopPropagation(); handleSave(); }}
                            variant="contained"
                            color="primary"
                            startIcon={<SaveIcon />}
                            sx={{ borderRadius: '8px', textTransform: 'none', px: { xs: 1.5, sm: 2 }, py: 0.75, fontWeight: 600, flex: { xs: 1, sm: 'none' } }}
                        >
                            Guardar
                        </Button>
                    </Box>
                </Box>

                <Box sx={{ px: { xs: '5px', sm: 3 }, pt: 1 }}>
                    <Grid container spacing={3}>
                        {editFields.map(field => {
                            const value = formData[field.campo] ?? field.valxdefecto ?? '';

                            // Lógica de renders según tipoD (C, D, F, I, B, W) y valcombo
                            let InputElement = null;

                            if (field.valcombo || field.sqlcombo) {
                                // Combobox
                                let opciones = [];
                                if (field.valcombo) {
                                    opciones = field.valcombo.split(',').map(v => v.trim());
                                }
                                InputElement = (
                                    <TextField
                                        select
                                        fullWidth
                                        size="small"
                                        label={field.titlefield || field.campo}
                                        value={value}
                                        onChange={(e) => handleChange(field.campo, e.target.value)}
                                        disabled={field.readonly || field.locked}
                                        required={field.obligatorio}
                                        error={field.obligatorio && !value}
                                        InputLabelProps={{ sx: { color: 'var(--primary-color)', fontWeight: 500 } }}
                                    >
                                        {opciones.map(opt => (
                                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                        ))}
                                    </TextField>
                                );
                            } else if (field.tipod === 'B') {
                                // Boolean UI
                                InputElement = (
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={Boolean(value)}
                                                onChange={(e) => handleChange(field.campo, e.target.checked)}
                                                disabled={field.readonly || field.locked}
                                            />
                                        }
                                        label={field.titlefield || field.campo}
                                        sx={{ '& .MuiFormControlLabel-label': { color: 'var(--primary-color)', fontWeight: 500 } }}
                                    />
                                );
                            } else if (field.tipod === 'W') {
                                // Memo / Texto Largo
                                InputElement = (
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={field.altomemo || 3}
                                        label={field.titlefield || field.campo}
                                        value={value}
                                        onChange={(e) => handleChange(field.campo, e.target.value)}
                                        disabled={field.readonly || field.locked}
                                        required={field.obligatorio}
                                        InputLabelProps={{ sx: { color: 'var(--primary-color)', fontWeight: 500 } }}
                                    />
                                );
                            } else if (field.tipod === 'D') {
                                // Date
                                InputElement = (
                                    <TextField
                                        fullWidth
                                        size="small"
                                        type="date"
                                        label={field.titlefield || field.campo}
                                        value={value}
                                        onChange={(e) => handleChange(field.campo, e.target.value)}
                                        disabled={field.readonly || field.locked}
                                        InputLabelProps={{ shrink: true, sx: { color: 'var(--primary-color)', fontWeight: 500 } }}
                                    />
                                )
                            } else {
                                // Caracteres, Enteros, Float estándar
                                InputElement = (
                                    <TextField
                                        fullWidth
                                        size="small"
                                        type={field.tipod === 'I' || field.tipod === 'F' ? 'number' : 'text'}
                                        label={field.titlefield || field.campo}
                                        value={value}
                                        onChange={(e) => {
                                            let val = e.target.value;
                                            if (gridMeta.mayusculas && typeof val === 'string') val = val.toUpperCase();
                                            handleChange(field.campo, val);
                                        }}
                                        disabled={field.readonly || field.locked}
                                        required={field.obligatorio}
                                        InputLabelProps={{ sx: { color: 'var(--primary-color)', fontWeight: 500 } }}
                                    />
                                );
                            }

                            // Por solicitud del usuario, forzamos 2 columnas Desktop (md=6) por defecto, 1 en Mobile (xs=12)
                            const cols = 6;

                            return (
                                <Grid item xs={12} md={cols} key={field.idfield || field.campo}>
                                    {InputElement}
                                </Grid>
                            );
                        })}
                    </Grid>

                    {/* Sub-Grillas / Detalles */}
                    {allGrids && allGrids.filter(g => g.gparent === gridMeta.idgrid).length > 0 && (
                        <Box sx={{ mt: 2, pt: 1, borderTop: '2px solid', borderColor: 'divider' }}>
                            {allGrids.filter(g => g.gparent === gridMeta.idgrid).map(child => (
                                <Box key={child.idgrid} sx={{ mb: 3 }}>
                                    <DynamicGrid
                                        gridMeta={child}
                                        idform={idform}
                                        masterRecord={record} // Carga la metadata usando el registro oficial 
                                        allGrids={allGrids}
                                    />
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>
        </Paper>
    );
};

export default DynamicForm;
