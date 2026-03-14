import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Grid as MuiGrid, MenuItem, Checkbox, FormControlLabel, Paper, Autocomplete, IconButton, Tooltip } from '@mui/material';
import { Save as SaveIcon, Close as CancelIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import * as Icons from '@mui/icons-material';
import axios from 'axios';
import { formatNumber, formatDate } from '../utils/formatters';
import DynamicGrid from './DynamicGrid';
import AlertDialog from './AlertDialog';
import MemoEditorDialog from './MemoEditorDialog';

const DynamicForm = ({ gridMeta, idform, record, onClose, allGrids, readonlyMode, uiStyles = {}, dispatchGridEvent }) => {
    const [formData, setFormData] = useState(record || {});
    const [alert, setAlert] = useState({ open: false, title: '', message: '', severity: 'error' });
    const [showValidationEffect, setShowValidationEffect] = useState(false);
    const [focusedField, setFocusedField] = useState(null);
    const [memoEditor, setMemoEditor] = useState({ open: false, campo: null, tipoMemo: 1, title: '' });

    // Estados para búsqueda interactiva de combos (Type-Ahead)
    const [asyncComboOptions, setAsyncComboOptions] = useState({}); // { campo: [{value, label}] }
    const [comboLoading, setComboLoading] = useState({}); // { campo: boolean }
    const comboFetchTimeout = React.useRef(null);
    const comboRequestId = React.useRef({}); // { campo: number } - contador para descartar respuestas obsoletas


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
        const fieldMeta = editFields.find(f => f.campo === campo);

        if (gridMeta.mayusculas && typeof valor === 'string' && fieldMeta?.tipod !== 'W') {
            finalValue = valor.toUpperCase();
        }

        setFormData(prev => {
            const newState = { ...prev, [campo]: finalValue };
            if (fieldMeta && fieldMeta.datafield && fieldMeta.datafield.trim() !== '') {
                newState[fieldMeta.datafield.trim()] = finalValue;
            }
            return newState;
        });

        if (fieldMeta && fieldMeta.svalida) {
            try {
                const validateFunc = new Function('formData', 'setFormData', 'valor', fieldMeta.svalida);
                validateFunc(formData, setFormData, valor);
            } catch (e) {
                console.error(`Error script svalida en ${campo}`, e);
            }
        }
    };

    const fetchRemoteOptions = async (campo, query = '') => {
        if (!comboRequestId.current[campo]) comboRequestId.current[campo] = 0;
        const thisRequest = ++comboRequestId.current[campo];

        setAsyncComboOptions(prev => ({ ...prev, [campo]: [] })); // Limpiar (necesario para filtrar)
        setComboLoading(prev => ({ ...prev, [campo]: true }));    // React bacha ambos → MUI muestra spinner
        try {
            const res = await axios.get(`/api/dynamic/combo/${idform}/${gridMeta.idgrid}/${campo}?q=${query}`);
            // Solo aplicar si esta es la petición más reciente para este campo
            if (thisRequest === comboRequestId.current[campo] && res.data.success) {
                setAsyncComboOptions(prev => ({ ...prev, [campo]: res.data.data }));
            }
        } catch (error) {
            if (thisRequest === comboRequestId.current[campo]) {
                console.error(`Error fetching combo options for ${campo}:`, error);
            }
        } finally {
            if (thisRequest === comboRequestId.current[campo]) {
                setComboLoading(prev => ({ ...prev, [campo]: false }));
            }
        }
    };

    const handleComboSearch = (campo, query) => {
        if (comboFetchTimeout.current) clearTimeout(comboFetchTimeout.current);
        comboFetchTimeout.current = setTimeout(() => {
            fetchRemoteOptions(campo, query);
        }, 300);
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

        if (dispatchGridEvent) {
            const continuable = await dispatchGridEvent('ssave', { record: formData });
            if (!continuable) return;
        } else if (gridMeta.ssave) {
            try {
                const beforePost = new Function('formData', gridMeta.ssave);
                const allow = beforePost(formData);
                if (allow === false) return;
            } catch (error) {
                // Silencioso o log mínimo en producción
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
                if (dispatchGridEvent) {
                    await dispatchGridEvent('ssavepost', { record: formData });
                } else if (gridMeta.ssavepost) {
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
                            // PERO si es una instancia de Date de JS, la dejamos pasar para que el formateador de fecha lo maneje
                            if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
                                try {
                                    value = JSON.stringify(value, null, 2);
                                } catch (e) {
                                    value = '[Error: Object]';
                                }
                            }

                            let InputElement = null;

                            if (field.valcombo || field.sqlcombo) {
                                if (field.datafield && field.datafield.trim() !== '') {
                                    value = formData[field.datafield.trim()] ?? value;
                                }

                                const isAsync = !!field.sqlcombo;
                                const remoteOptions = asyncComboOptions[field.campo] || [];
                                const staticOptions = field.comboDataList || (field.valcombo ? field.valcombo.split(',').map(v => ({ value: v.trim(), label: v.trim() })) : []);

                                // Si es async, combinamos las opciones remotas con la opción seleccionada actual si no está en la lista
                                let options = isAsync ? remoteOptions : staticOptions;

                                // Asegurar que el valor actual (si existe) tenga una etiqueta en la lista para que Autocomplete no falle
                                if (value !== '' && value !== null) {
                                    const exists = options.find(o => String(o.value) === String(value));
                                    if (!exists) {
                                        // Intentar buscar el label en el mapeo global de metadata si está disponible
                                        const label = field.comboDataKeyVal?.[String(value)] || value;
                                        options = [{ value: String(value), label: String(label) }, ...options];
                                    }
                                }

                                InputElement = (
                                    <Autocomplete
                                        fullWidth
                                        size="small"
                                        id={`form-field-${field.campo}`}
                                        disabled={field.readonly || field.locked || readonlyMode}
                                        options={options}
                                        filterOptions={(x) => x} // <--- IMPORTANTE: Deshabilita el filtro de React (usamos solo el del servidor)
                                        loading={comboLoading[field.campo] || false}
                                        loadingText="Buscando..."
                                        autoComplete={false} // Evita sugerencias raras del navegador
                                        clearOnBlur={false} // Evita que se borre lo que escribimos al salir
                                        value={options.find(o => String(o.value) === String(value)) || null}
                                        onChange={(e, newValue) => {
                                            handleChange(field.campo, newValue ? newValue.value : '');
                                        }}
                                        onInputChange={(e, newInputValue, reason) => {
                                            if (isAsync && (reason === 'input' || (reason === 'clear' && newInputValue === ''))) {
                                                handleComboSearch(field.campo, newInputValue);
                                            }
                                        }}
                                        getOptionLabel={(option) => {
                                            if (typeof option === 'string') return option;
                                            return option.label || '';
                                        }}
                                        isOptionEqualToValue={(option, val) => String(option.value) === String(val.value)}
                                        onOpen={() => {
                                            if (isAsync && options.length <= 1) {
                                                fetchRemoteOptions(field.campo, '');
                                            }
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label={field.titlefield || field.campo}
                                                onFocus={(e) => e.target.select()}
                                                InputLabelProps={{ sx: field.obligatorio ? { color: 'maroon', '&.Mui-focused': { color: 'maroon' } } : {} }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        '& fieldset': {
                                                            borderColor: (field.obligatorio && (!value || value.toString().trim() === '')) ? 'maroon' : undefined,
                                                            borderWidth: (field.obligatorio && (!value || value.toString().trim() === '')) ? '1.5px' : undefined,
                                                        },
                                                        animation: (showValidationEffect && field.obligatorio && (!value || value.toString().trim() === ''))
                                                            ? 'validation-pulse 1s ease-in-out infinite' : 'none'
                                                    }
                                                }}
                                            />
                                        )}
                                    />
                                );
                            } else if (field.tipod === 'B') {
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
                                const tipoMemo = field.tipomemo || 1;
                                InputElement = (
                                    <Box sx={{ position: 'relative' }}>
                                        <TextField
                                            fullWidth multiline rows={field.altomemo || 3}
                                            id={`form-field-${field.campo}`}
                                            label={field.titlefield || field.campo}
                                            value={value}
                                            onFocus={(e) => e.target.select()}
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
                                        {tipoMemo > 0 && !readonlyMode && !field.readonly && !field.locked && (
                                            <Tooltip title={tipoMemo === 1 ? 'Editor de texto' : tipoMemo === 2 ? 'Editor de código' : 'Editor visual'}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setMemoEditor({ open: true, campo: field.campo, tipoMemo, title: field.titlefield || field.campo })}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: 4,
                                                        right: 4,
                                                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                                        '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.2)' },
                                                        zIndex: 1
                                                    }}
                                                >
                                                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                );
                            } else if (field.tipod === 'D') {
                                // Asegurar que el valor esté en formato YYYY-MM-DD para el input type="date"
                                const dateValue = formatDate(value, 'YYYY-MM-DD');

                                InputElement = (
                                    <TextField
                                        fullWidth size="small" type="date"
                                        id={`form-field-${field.campo}`}
                                        label={field.titlefield || field.campo}
                                        value={dateValue}
                                        onFocus={(e) => e.target.select()}
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
                                            onFocus={(e) => e.target.select()}
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
                                const isNumeric = field.tipod === 'I' || field.tipod === 'F';
                                const displayValue = (isNumeric && focusedField !== field.campo)
                                    ? formatNumber(value, field.formato, field.tipod === 'F')
                                    : value;

                                InputElement = (
                                    <TextField
                                        fullWidth size="small"
                                        id={`form-field-${field.campo}`}
                                        type="text" // Usamos text para permitir prefijos/sufijos y formato
                                        label={field.titlefield || field.campo}
                                        value={displayValue}
                                        onFocus={(e) => {
                                            if (isNumeric) setFocusedField(field.campo);
                                            e.target.select();
                                        }}
                                        onBlur={() => isNumeric && setFocusedField(null)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            // Si es numerico, solo permitir números, puntos y comas mientras edita (si se desea ser estricto)
                                            // Por ahora mantenemos elasticidad
                                            handleChange(field.campo, val);
                                        }}
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
                                    simplified={true}
                                    autoHeightContent={true}
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

            <MemoEditorDialog
                open={memoEditor.open}
                onClose={() => setMemoEditor({ ...memoEditor, open: false })}
                onAccept={(content) => {
                    handleChange(memoEditor.campo, content);
                    setMemoEditor({ ...memoEditor, open: false });
                }}
                initialValue={formData[memoEditor.campo] || ''}
                tipoMemo={memoEditor.tipoMemo}
                fieldTitle={memoEditor.title}
            />
        </Paper>
    );
};

export default DynamicForm;
