import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Grid as MuiGrid, MenuItem, Checkbox, FormControlLabel, Paper } from '@mui/material';
import { Save as SaveIcon, Close as CancelIcon } from '@mui/icons-material';
import axios from 'axios';
import DynamicGrid from './DynamicGrid';

const DynamicForm = ({ gridMeta, idform, record, onClose, allGrids, readonlyMode }) => {
    const [formData, setFormData] = useState(record || {});

    // Extraer campos configurados para edición (eoculto = false)
    const editFields = (() => {
        const allFields = (gridMeta.fields || []).filter(f => !f.eoculto);

        let savedState = {};
        try {
            const stored = localStorage.getItem(`grid-col-state-${gridMeta.idgrid}`);
            if (stored) savedState = JSON.parse(stored);
        } catch (e) { }

        if (Object.keys(savedState).length > 0) {
            const visible = allFields
                .filter(f => savedState[f.campo] !== undefined)
                .sort((a, b) => (savedState[a.campo]?.index ?? 999) - (savedState[b.campo]?.index ?? 999));
            const hidden = allFields
                .filter(f => savedState[f.campo] === undefined)
                .sort((a, b) => a.posicion - b.posicion);
            return [...visible, ...hidden];
        }

        return allFields.sort((a, b) => a.posicion - b.posicion);
    })();

    useEffect(() => {
        if (Object.keys(record || {}).length === 0 && gridMeta.snewrecord) {
            try {
                const scriptFunc = new Function('formData', 'setFormData', gridMeta.snewrecord);
                scriptFunc(formData, setFormData);
            } catch (e) {
                console.error("Error evaluando SNewRecord", e);
            }
        }
    }, []);

    const handleChange = (campo, valor) => {
        setFormData(prev => ({ ...prev, [campo]: valor }));

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
        if (gridMeta.ssave) {
            try {
                const beforePost = new Function('formData', gridMeta.ssave);
                const allow = beforePost(formData);
                if (allow === false) return;
            } catch (e) {
                console.error("Error ssave", e);
            }
        }

        try {
            const isUpdate = record && Object.keys(record).length > 0;
            let finalRecordId = null;
            let pkFieldName = null;

            if (isUpdate) {
                const metaPkField = gridMeta.fields?.find(f => f.pk === true);
                if (metaPkField && record[metaPkField.campo] !== undefined) {
                    pkFieldName = metaPkField.campo;
                }
                if (!pkFieldName) {
                    const tableName = (gridMeta.vquery || '').replace(/^x/, '').replace(/s$/, '');
                    const candidates = [`id${gridMeta.vquery}`, `id${tableName}`];
                    pkFieldName = candidates.find(c => record[c] !== undefined);
                }
                if (!pkFieldName) {
                    pkFieldName = Object.keys(record).find(k => k.startsWith('id'));
                }
                finalRecordId = pkFieldName ? record[pkFieldName] : null;
            }

            const res = await axios.post(`/api/dynamic/data/${idform}/${gridMeta.idgrid}`, {
                data: formData,
                isUpdate: isUpdate,
                recordId: finalRecordId,
                pkField: pkFieldName
            });

            if (res.data.success) {
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
            <Box sx={{ flexGrow: 1, overflowY: 'auto', pb: 3 }}>
                <Box sx={{
                    px: { xs: 1, sm: 2 },
                    py: 2,
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    mb: 3
                }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'var(--active-tab-color)', fontSize: '1.1rem' }}>
                        {gridMeta.titulo}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button onClick={onClose} variant="outlined" color="inherit" startIcon={<CancelIcon />} sx={{ textTransform: 'none' }}>
                            {readonlyMode ? 'Cerrar' : 'Cancelar'}
                        </Button>
                        {!readonlyMode && (
                            <Button onClick={handleSave} variant="contained" color="primary" startIcon={<SaveIcon />} sx={{ textTransform: 'none' }}>
                                Guardar
                            </Button>
                        )}
                    </Box>
                </Box>

                <Box sx={{ px: { xs: 1, sm: 3 } }}>
                    <MuiGrid container spacing={2}>
                        {editFields.map(field => {
                            const value = formData[field.campo] ?? field.valxdefecto ?? '';
                            let InputElement = null;

                            if (field.valcombo || field.sqlcombo) {
                                let opciones = field.valcombo ? field.valcombo.split(',').map(v => v.trim()) : [];
                                InputElement = (
                                    <TextField select fullWidth size="small" label={field.titlefield || field.campo} value={value} onChange={(e) => handleChange(field.campo, e.target.value)} disabled={field.readonly || field.locked || readonlyMode}>
                                        {opciones.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                                    </TextField>
                                );
                            } else if (field.tipod === 'B') {
                                InputElement = (
                                    <FormControlLabel control={<Checkbox checked={Boolean(value)} onChange={(e) => handleChange(field.campo, e.target.checked)} disabled={field.readonly || field.locked || readonlyMode} />} label={field.titlefield || field.campo} />
                                );
                            } else if (field.tipod === 'W') {
                                InputElement = (
                                    <TextField fullWidth multiline rows={field.altomemo || 3} label={field.titlefield || field.campo} value={value} onChange={(e) => handleChange(field.campo, e.target.value)} disabled={field.readonly || field.locked || readonlyMode} />
                                );
                            } else if (field.tipod === 'D') {
                                InputElement = (
                                    <TextField fullWidth size="small" type="date" label={field.titlefield || field.campo} value={value} onChange={(e) => handleChange(field.campo, e.target.value)} disabled={field.readonly || field.locked || readonlyMode} InputLabelProps={{ shrink: true }} />
                                );
                            } else {
                                InputElement = (
                                    <TextField fullWidth size="small" type={field.tipod === 'I' || field.tipod === 'F' ? 'number' : 'text'} label={field.titlefield || field.campo} value={value} onChange={(e) => handleChange(field.campo, e.target.value)} disabled={field.readonly || field.locked || readonlyMode} />
                                );
                            }

                            return <MuiGrid item xs={12} md={6} key={field.campo}>{InputElement}</MuiGrid>;
                        })}
                    </MuiGrid>

                    {/* Grillas Hijas */}
                    {allGrids && allGrids
                        .filter(g => g.gparent === gridMeta.idgrid)
                        .sort((a, b) => (a.nroframe || 0) - (b.nroframe || 0))
                        .map(child => (
                            <Box key={child.idgrid} sx={{ mt: 4, pt: 2, borderTop: '1px solid #eee' }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}>
                                    {child.titulo}
                                </Typography>
                                <DynamicGrid
                                    gridMeta={child}
                                    idform={idform}
                                    masterRecord={formData}
                                    allGrids={allGrids}
                                    readonlyMode={readonlyMode}
                                />
                            </Box>
                        ))}
                </Box>
            </Box>
        </Paper>
    );
};

export default DynamicForm;
