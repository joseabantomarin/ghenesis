import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Grid as MuiGrid, MenuItem, Checkbox, FormControlLabel, Paper } from '@mui/material';
import { Save as SaveIcon, Close as CancelIcon } from '@mui/icons-material';
import * as Icons from '@mui/icons-material';
import axios from 'axios';
import DynamicGrid from './DynamicGrid';
import AlertDialog from './AlertDialog';

const DynamicForm = ({ gridMeta, idform, record, onClose, allGrids, readonlyMode, uiStyles = {} }) => {
    const [formData, setFormData] = useState(record || {});
    const [alert, setAlert] = useState({ open: false, title: '', message: '', severity: 'error' });
    const [showValidationEffect, setShowValidationEffect] = useState(false);

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

        // Foco inicial en el primer campo visible y no readonly
        const firstField = editFields.find(f => !f.readonly && !f.locked);
        if (firstField) {
            setTimeout(() => {
                const input = document.getElementById(`form-field-${firstField.campo}`);
                if (input) input.focus();
            }, 100);
        }
    }, []);

    // Manejar atajos de teclado del formulario
    useEffect(() => {
        const handleKeys = (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [formData]);

    const handleKeyDown = (e, index) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            const nextField = editFields.slice(index + 1).find(f => !f.readonly && !f.locked);
            if (nextField) {
                const input = document.getElementById(`form-field-${nextField.campo}`);
                if (input) input.focus();
            } else {
                handleSave();
            }
        }
    };

    const handleChange = (campo, valor) => {
        let finalValue = valor;
        if (gridMeta.mayusculas && typeof valor === 'string') {
            finalValue = valor.toUpperCase();
        }
        setFormData(prev => ({ ...prev, [campo]: finalValue }));

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
        // Validar Campos Obligatorios
        const mandatoryMissing = editFields.filter(f => f.obligatorio && (!formData[f.campo] || formData[f.campo].toString().trim() === ''));
        if (mandatoryMissing.length > 0) {
            const fieldNames = mandatoryMissing.map(f => f.titlefield || f.campo).join(', ');

            setAlert({
                open: true,
                title: 'Campos Requeridos',
                message: `Por favor, completa los siguientes campos obligatorios: ${fieldNames}`,
                severity: 'warning'
            });
            return;
        }

        if (gridMeta.ssave) {
            try {
                const beforePost = new Function('formData', gridMeta.ssave);
                const allow = beforePost(formData);
                if (allow === false) return;
            } catch (error) {
                // Silencioso o log mínimo en producción
            } finally { }
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
                setAlert({
                    open: true,
                    title: 'Error de Validación',
                    message: res.data.error || 'No se pudo guardar el registro.',
                    severity: 'error'
                });
            }
        } catch (error) {
            setAlert({
                open: true,
                title: 'Error del Sistema',
                message: error.response?.data?.error || error.message,
                severity: 'error'
            });
        }
    };

    return (
        <Paper elevation={0} className={gridMeta.mayusculas ? 'force-uppercase' : ''} sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                    <Typography variant="h6" sx={{
                        fontWeight: 'bold',
                        color: uiStyles.formTitle?.color || 'var(--active-tab-color)',
                        fontSize: '1.1rem',
                        display: uiStyles.formTitle?.visible === false ? 'none' : 'block'
                    }}>
                        {uiStyles.formTitle?.label || gridMeta.titulo}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            onClick={onClose} variant="outlined" color="inherit"
                            startIcon={<CancelIcon />}
                            disabled={uiStyles.cancel?.disabled || uiStyles.close?.disabled}
                            sx={{
                                textTransform: 'none',
                                display: (readonlyMode ? uiStyles.close?.visible : uiStyles.cancel?.visible) === false ? 'none' : 'inline-flex',
                                backgroundColor: readonlyMode ? uiStyles.close?.backgroundColor : uiStyles.cancel?.backgroundColor,
                                color: readonlyMode ? uiStyles.close?.color : uiStyles.cancel?.color
                            }}
                        >
                            {readonlyMode ? (uiStyles.close?.label || 'Cerrar') : (uiStyles.cancel?.label || 'Cancelar')}
                        </Button>
                        {!readonlyMode && (
                            <Button
                                onClick={handleSave} variant="contained" color="primary"
                                startIcon={<SaveIcon />}
                                disabled={uiStyles.save?.disabled}
                                sx={{
                                    textTransform: 'none',
                                    display: uiStyles.save?.visible === false ? 'none' : 'inline-flex',
                                    backgroundColor: uiStyles.save?.backgroundColor,
                                    color: uiStyles.save?.color
                                }}
                            >
                                {uiStyles.save?.label || 'Guardar'}
                            </Button>
                        )}
                    </Box>
                </Box>

                <Box sx={{ px: { xs: 1, sm: 3 } }}>
                    <MuiGrid container spacing={2}>
                        {editFields.map(field => {
                            let value = formData[field.campo] ?? field.valxdefecto ?? '';

                            // Si el valor es un objeto (ej: jsonb de la base de datos), lo convertimos a string para el input
                            if (value !== null && typeof value === 'object') {
                                try {
                                    value = JSON.stringify(value, null, 2);
                                } catch (e) {
                                    value = '[Error: Object]';
                                }
                            }

                            let InputElement = null;

                            if (field.valcombo || field.sqlcombo) {
                                let opciones = field.valcombo ? field.valcombo.split(',').map(v => v.trim()) : [];
                                InputElement = (
                                    <TextField
                                        select fullWidth size="small"
                                        id={`form-field-${field.campo}`}
                                        label={field.titlefield || field.campo}
                                        value={value}
                                        onChange={(e) => handleChange(field.campo, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, editFields.indexOf(field))}
                                        disabled={field.readonly || field.locked || readonlyMode}
                                        InputProps={{ style: { textTransform: gridMeta.mayusculas ? 'uppercase' : 'none' } }}
                                        InputLabelProps={{ sx: field.obligatorio ? { color: 'maroon', '&.Mui-focused': { color: 'maroon' } } : {} }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: (field.obligatorio && (!value || value.toString().trim() === '')) ? 'maroon' : undefined,
                                                    borderWidth: (field.obligatorio && (!value || value.toString().trim() === '')) ? '1.5px' : undefined,
                                                },
                                                animation: (showValidationEffect && field.obligatorio && (!value || value.toString().trim() === ''))
                                                    ? 'validation-pulse 1s ease-in-out infinite' : 'none',
                                                '@keyframes validation-pulse': {
                                                    '0%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)', backgroundColor: 'transparent' },
                                                    '50%': { boxShadow: '0 0 20px maroon', filter: 'blur(1.5px)', backgroundColor: 'rgba(128, 0, 0, 0.08)' },
                                                    '100%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)', backgroundColor: 'transparent' }
                                                }
                                            }
                                        }}
                                    >
                                        {opciones.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                                    </TextField>
                                );
                            } else if (field.tipod === 'B') {
                                InputElement = (
                                    <FormControlLabel
                                        control={<Checkbox checked={Boolean(value)} onChange={(e) => handleChange(field.campo, e.target.checked)} disabled={field.readonly || field.locked || readonlyMode} />}
                                        label={field.titlefield || field.campo}
                                        sx={field.obligatorio ? {
                                            '& .MuiFormControlLabel-label': {
                                                color: 'maroon',
                                                fontWeight: (field.obligatorio && (!value)) ? 600 : undefined
                                            },
                                            px: 1,
                                            borderRadius: '8px',
                                            animation: (showValidationEffect && field.obligatorio && (!value))
                                                ? 'validation-pulse-bg 1s ease-in-out infinite' : 'none',
                                            '@keyframes validation-pulse-bg': {
                                                '0%': { backgroundColor: 'transparent', filter: 'blur(0px)' },
                                                '50%': { backgroundColor: 'rgba(128, 0, 0, 0.12)', filter: 'blur(1px)' },
                                                '100%': { backgroundColor: 'transparent', filter: 'blur(0px)' }
                                            }
                                        } : {}}
                                    />
                                );
                            } else if (field.tipod === 'W') {
                                InputElement = (
                                    <TextField
                                        fullWidth multiline rows={field.altomemo || 3}
                                        id={`form-field-${field.campo}`}
                                        label={field.titlefield || field.campo}
                                        value={value}
                                        onChange={(e) => handleChange(field.campo, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, editFields.indexOf(field))}
                                        disabled={field.readonly || field.locked || readonlyMode}
                                        InputProps={{ style: { textTransform: gridMeta.mayusculas ? 'uppercase' : 'none' } }}
                                        InputLabelProps={{ sx: field.obligatorio ? { color: 'maroon', '&.Mui-focused': { color: 'maroon' } } : {} }}
                                        sx={{
                                            '& .MuiInputBase-root': {
                                                alignItems: 'flex-start',
                                                borderColor: (field.obligatorio && (!value || value.toString().trim() === '')) ? 'maroon' : undefined,
                                                '& fieldset': {
                                                    borderColor: (field.obligatorio && (!value || value.toString().trim() === '')) ? 'maroon' : undefined,
                                                    borderWidth: (field.obligatorio && (!value || value.toString().trim() === '')) ? '1.5px' : undefined,
                                                },
                                                animation: (showValidationEffect && field.obligatorio && (!value || value.toString().trim() === ''))
                                                    ? 'validation-pulse 1s ease-in-out infinite' : 'none',
                                                '@keyframes validation-pulse': {
                                                    '0%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)', backgroundColor: 'transparent' },
                                                    '50%': { boxShadow: '0 0 20px maroon', filter: 'blur(1.5px)', backgroundColor: 'rgba(128, 0, 0, 0.08)' },
                                                    '100%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)', backgroundColor: 'transparent' }
                                                },
                                                '& textarea': {
                                                    resize: 'vertical',
                                                    overflow: 'auto !important'
                                                }
                                            }
                                        }}
                                    />
                                );
                            } else if (field.tipod === 'D') {
                                InputElement = (
                                    <TextField
                                        fullWidth size="small" type="date"
                                        id={`form-field-${field.campo}`}
                                        label={field.titlefield || field.campo}
                                        value={value}
                                        onChange={(e) => handleChange(field.campo, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, editFields.indexOf(field))}
                                        disabled={field.readonly || field.locked || readonlyMode}
                                        InputLabelProps={{ shrink: true, sx: field.obligatorio ? { color: 'maroon', '&.Mui-focused': { color: 'maroon' } } : {} }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: (field.obligatorio && (!value || value.toString().trim() === '')) ? 'maroon' : undefined,
                                                    borderWidth: (field.obligatorio && (!value || value.toString().trim() === '')) ? '1.5px' : undefined,
                                                },
                                                animation: (showValidationEffect && field.obligatorio && (!value || value.toString().trim() === ''))
                                                    ? 'validation-pulse 1s ease-in-out infinite' : 'none',
                                                '@keyframes validation-pulse': {
                                                    '0%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)', backgroundColor: 'transparent' },
                                                    '50%': { boxShadow: '0 0 20px maroon', filter: 'blur(1.5px)', backgroundColor: 'rgba(128, 0, 0, 0.08)' },
                                                    '100%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)', backgroundColor: 'transparent' }
                                                }
                                            }
                                        }}
                                    />
                                );
                            } else if (field.campo === 'xicons' || field.campo === 'previsualizacion' || field.tipod === 'X') {
                                // Renderizar el icono si existe en Material Icons
                                const iconName = value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
                                const IconComp = Icons[iconName] || Icons['HelpOutline'];
                                InputElement = (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <IconComp color="primary" sx={{ fontSize: 32 }} />
                                        <TextField
                                            fullWidth size="small"
                                            id={`form-field-${field.campo}`}
                                            label={field.titlefield || field.campo}
                                            value={value}
                                            onChange={(e) => handleChange(field.campo, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, editFields.indexOf(field))}
                                            disabled={field.readonly || field.locked || readonlyMode}
                                            InputProps={{ style: { textTransform: gridMeta.mayusculas ? 'uppercase' : 'none' } }}
                                            InputLabelProps={{ sx: field.obligatorio ? { color: 'maroon', '&.Mui-focused': { color: 'maroon' } } : {} }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    '& fieldset': {
                                                        borderColor: (field.obligatorio && (!value || value.toString().trim() === '')) ? 'maroon' : undefined,
                                                        borderWidth: (field.obligatorio && (!value || value.toString().trim() === '')) ? '1.5px' : undefined,
                                                    },
                                                    animation: (showValidationEffect && field.obligatorio && (!value || value.toString().trim() === ''))
                                                        ? 'validation-pulse 1s ease-in-out infinite' : 'none',
                                                    '@keyframes validation-pulse': {
                                                        '0%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)' },
                                                        '50%': { boxShadow: '0 0 15px maroon', filter: 'blur(0.5px)' },
                                                        '100%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)' }
                                                    }
                                                }
                                            }}
                                        />
                                    </Box>
                                );
                            } else {
                                InputElement = (
                                    <TextField
                                        fullWidth size="small"
                                        id={`form-field-${field.campo}`}
                                        type={field.tipod === 'I' || field.tipod === 'F' ? 'number' : 'text'}
                                        label={field.titlefield || field.campo}
                                        value={value}
                                        onChange={(e) => handleChange(field.campo, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, editFields.indexOf(field))}
                                        disabled={field.readonly || field.locked || readonlyMode}
                                        InputProps={{ style: { textTransform: gridMeta.mayusculas ? 'uppercase' : 'none' } }}
                                        InputLabelProps={{ sx: field.obligatorio ? { color: 'maroon', '&.Mui-focused': { color: 'maroon' } } : {} }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {
                                                    borderColor: (field.obligatorio && (!value || value.toString().trim() === '')) ? 'maroon' : undefined,
                                                    borderWidth: (field.obligatorio && (!value || value.toString().trim() === '')) ? '1.5px' : undefined,
                                                },
                                                animation: (showValidationEffect && field.obligatorio && (!value || value.toString().trim() === ''))
                                                    ? 'validation-pulse 1s ease-in-out infinite' : 'none',
                                                '@keyframes validation-pulse': {
                                                    '0%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)', backgroundColor: 'transparent' },
                                                    '50%': { boxShadow: '0 0 20px maroon', filter: 'blur(1.5px)', backgroundColor: 'rgba(128, 0, 0, 0.08)' },
                                                    '100%': { boxShadow: '0 0 0px maroon', filter: 'blur(0px)', backgroundColor: 'transparent' }
                                                }
                                            }
                                        }}
                                    />
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
                            <Box key={child.idgrid} sx={{ mt: 1, pt: 1, mx: { xs: -1, sm: 0 } }}>
                                <DynamicGrid
                                    gridMeta={child}
                                    idform={idform}
                                    masterRecord={formData}
                                    allGrids={allGrids}
                                    readonlyMode={readonlyMode}
                                    autoFocusFirstRow={false}
                                />
                            </Box>
                        ))}
                </Box>
            </Box>

            <AlertDialog
                open={alert.open}
                title={alert.title}
                message={alert.message}
                severity={alert.severity}
                onClose={() => {
                    setAlert({ ...alert, open: false });
                    if (alert.severity === 'warning') {
                        // Activar efecto de animación justo después de cerrar el aviso
                        setShowValidationEffect(true);
                        setTimeout(() => setShowValidationEffect(false), 2200);
                    }
                }}
            />
        </Paper>
    );
};

export default DynamicForm;
