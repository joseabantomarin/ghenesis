import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Grid, MenuItem, Checkbox, FormControlLabel, Paper, Divider } from '@mui/material';
import axios from 'axios';
import DynamicGrid from './DynamicGrid';

const DynamicForm = ({ gridMeta, idform, record, onClose, allGrids }) => {
    const [formData, setFormData] = useState(record || {});

    // Extraer campos configurados para edición (eoculto = false)
    const editFields = (gridMeta.fields || [])
        .filter(f => !f.eoculto)
        .sort((a, b) => a.posicion - b.posicion);

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
                const pkHierarchy = ['idf', 'idgrid', 'idcontrol', 'idreport', 'idtable', 'idconsult', 'idfunction', 'idfile', 'idsistema', 'idform', 'id'];
                const bestPk = pkHierarchy.find(key => record[key] !== undefined);
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
        <Paper elevation={0} sx={{ pb: 3 }}>
            {/* Header Stickyyy */}
            <Box
                sx={{
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    // Solo el maestro principal será sticky. Los detalles tendrán header relativo para no superponerse.
                    position: gridMeta.gparent ? 'relative' : 'sticky',
                    top: 0,
                    zIndex: gridMeta.gparent ? 1 : 10,
                    backgroundColor: gridMeta.gparent ? '#f9f9f9' : 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    mb: 3
                }}
            >
                <Typography variant="h6" sx={{ m: 0 }}>
                    Edición de Registro - {gridMeta.titulo}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        variant="outlined"
                        color="inherit"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={(e) => { e.stopPropagation(); handleSave(); }}
                        variant="contained"
                        color="primary"
                    >
                        Guardar Registro
                    </Button>
                </Box>
            </Box>

            {/* Contenedor del Formulario Real con Grid */}
            <Box sx={{ px: 3 }}>
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
                                    InputLabelProps={{ shrink: true }}
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
        </Paper>
    );
};

export default DynamicForm;
