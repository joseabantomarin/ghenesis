import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Paper, TextField, CircularProgress, Alert, Button, Box, Typography,
    IconButton, Tooltip, Menu, MenuItem, useTheme, useMediaQuery, Checkbox, Autocomplete
} from '@mui/material';
import {
    Add as AddIcon, Edit as EditIcon, Print as PrintIcon, MoreVert as MoreVertIcon,
    Delete as DeleteIcon, FileDownload as DownloadIcon, Refresh as RefreshIcon,
    FirstPage as FirstPageIcon, NavigateBefore as NavigateBeforeIcon,
    NavigateNext as NavigateNextIcon, LastPage as LastPageIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import * as Icons from '@mui/icons-material';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import DynamicForm from './DynamicForm';
import ConfirmDialog from './ConfirmDialog';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import { runGridScript } from '../utils/ScriptingEngine';
import { formatNumber, formatDate } from '../utils/formatters';
import AlertDialog from './AlertDialog';
import MemoEditorDialog from './MemoEditorDialog';
import '../styles/totals.css';

// --- Editor de Combo Asíncrono para AG Grid (Type-Ahead) ---
const AsyncComboEditor = React.forwardRef((props, ref) => {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const timeoutRef = useRef(null);
    const requestIdRef = useRef(0);

    React.useImperativeHandle(ref, () => ({
        getValue: () => props.value,
        isPopup: () => true,
        isCancelAfterEnd: () => true
    }));

    // Mismo patrón que fetchRemoteOptions del form
    const fetchOptions = async (query) => {
        const thisRequest = ++requestIdRef.current;
        setOptions([]);       // Limpiar (necesario para que filtre)
        setLoading(true);     // React bacha ambos → MUI muestra spinner
        try {
            const res = await axios.get(`/api/dynamic/combo/${props.idform}/${props.idgrid}/${props.column.colId}?q=${query}`);
            if (thisRequest === requestIdRef.current && res.data.success) {
                setOptions(res.data.data);
            }
        } catch (e) {
            if (thisRequest === requestIdRef.current) console.error("Error en combo editor:", e);
        } finally {
            if (thisRequest === requestIdRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        fetchOptions('');
    }, []);

    // Mismo patrón que handleComboSearch del form
    const handleSearch = (query) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            fetchOptions(query);
        }, 300);
    };

    return (
        <Box sx={{ p: 0.5, backgroundColor: 'white', minWidth: 250, boxShadow: 3, borderRadius: 1 }}>
            <Autocomplete
                open
                disablePortal
                size="small"
                options={options}
                loading={loading}
                loadingText="Buscando..."
                filterOptions={(x) => x}
                autoComplete={false}
                clearOnBlur={false}
                value={options.find(o => String(o.value) === String(props.value)) || null}
                onInputChange={(e, newInputValue, reason) => {
                    if (reason === 'input' || (reason === 'clear' && newInputValue === '')) {
                        handleSearch(newInputValue);
                    }
                }}
                onChange={(e, newVal) => {
                    if (newVal) {
                        props.node.setDataValue(props.column.getColId(), newVal.value);
                        props.api.stopEditing();
                    }
                }}
                getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    return option.label || '';
                }}
                isOptionEqualToValue={(option, val) => String(option.value) === String(val.value)}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        autoFocus
                        placeholder="Buscar..."
                        variant="standard"
                        InputProps={{ ...params.InputProps, disableUnderline: true }}
                    />
                )}
            />
        </Box>
    );
});

// Requerido en AG Grid v31+ para que renderice
ModuleRegistry.registerModules([AllCommunityModule]);

// Theming API (V32+): Reemplaza completamente los CSS tradicionales
const myTheme = themeQuartz.withParams({
    headerBackgroundColor: 'var(--grid-header-bg)',
    headerTextColor: 'var(--grid-header-color)',
    selectedRowBackgroundColor: 'var(--grid-selected-row-bg)',
    rowHoverColor: 'transparent',
    headerColumnBorder: true,
    columnBorder: true,
    borderColor: '#dde2eb',

    // Aplicar color de fondo de selección (o el que decida el usuario) a las cajas de filtro
    inputBackgroundColor: 'var(--grid-selected-row-bg)',
    inputBorderColor: 'transparent',
    inputFocusBorderColor: 'var(--primary-color)',
    inputHeight: 26, // Altura interna reducida para que no se vea "ajustado" en los 38px
    fontSize: 13,    // Tamaño de fuente ligeramente menor para el grid

    // Variables nativas para forzar Checkbox: Borde primary, tick primary, interior blanco (sin relleno sólido)
    accentColor: 'var(--primary-color)',
    checkboxBorderWidth: 2,
    checkboxCheckedShape: 'tick',

    // Oculta el fondo redondo gris-celeste de hover en la cabecera
    iconButtonHoverBackgroundColor: 'transparent',

    // Centrar títulos de columnas y grupos
    headerColumnTitleTextAlign: 'center',
    headerColumnGroupTitleTextAlign: 'center'
});



const DynamicGrid = ({ gridMeta, idform, masterRecord, onRowSelect, onEditingStateChange, allGrids, sactivateData, readonlyMode, simplified, autoFocusFirstRow = true, autoHeightContent = false }) => {
    const gridRef = useRef();
    const { user } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Paginación y Búsqueda
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(gridMeta.rxpage || 10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [sortField, setSortField] = useState(null);
    const [sortOrder, setSortOrder] = useState(null);
    const [gridFilters, setGridFilters] = useState(null); // Nuevo estado para Filtros de Cabecera
    const [searchText, setSearchText] = useState(''); // Búsqueda global
    const [extraParams, setExtraParams] = useState({}); // Parámetros adicionales para scripts
    const [serverAggregates, setServerAggregates] = useState({}); // Totales del servidor

    // Estado para Edit y Selección
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [selectedRowIndex, setSelectedRowIndex] = useState(null);
    const [editingRecord, setEditingRecord] = useState(null);
    const [focusedHelpText, setFocusedHelpText] = useState('');
    const [memoEditor, setMemoEditor] = useState({ open: false, campo: null, tipoMemo: 1, title: '', node: null });

    // Estado para Menú de Reportes (Móvil/Desplegable)
    const [anchorEl, setAnchorEl] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', severity: 'info' });
    const [uiStyles, setUiStyles] = useState({});
    const [contextMenu, setContextMenu] = useState(null);
    const [isConfirmingExport, setIsConfirmingExport] = useState(false);
    const [showDeleted, setShowDeleted] = useState(false);
    const [pendingChanges, setPendingChanges] = useState({}); // { rowId: { colId: newValue } }

    // Refs para coordinación de navegación y guardado
    const pendingMove = useRef(null);
    const isSaving = useRef(false);
    const focusFromClickRef = useRef(0);      // Timestamp del último click (evita conflicto con onCellFocused)
    const shiftHeldRef = useRef(false);       // Rastrea si Shift está presionado
    const pendingSelectPK = useRef(null);     // PK del registro a reseleccionar tras fetchData
    const pendingSelectCol = useRef(null);    // Campo a re-enfocar tras fetchData
    const pendingLocate = useRef(null);        // {field, value} para localizar registro en otra página

    // Rastrear estado de la tecla Shift globalmente
    useEffect(() => {
        const onKeyDown = (e) => { if (e.key === 'Shift') shiftHeldRef.current = true; };
        const onKeyUp = (e) => { if (e.key === 'Shift') shiftHeldRef.current = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);
    // --- Helper Memos y Callbacks (Definidos antes de ser usados en effects) ---
    const isDeveloper = useMemo(() => {
        const role = user?.role?.toUpperCase() || '';
        return role === 'DEVELOPER' || role === 'PROGRAMADOR';
    }, [user]);

    const detectPK = useMemo(() => {
        return (record) => {
            if (!record) return null;
            // 1. Check metadata pk flag
            let pkField = (gridMeta.fields || []).find(f => f.pk === true)?.campo;
            if (pkField && record[pkField] !== undefined) return pkField;

            // 2. Fallback to common patterns if no pk flag
            const vquery = (gridMeta.vquery || '').toLowerCase();
            const tableName = vquery.replace(/^x/, '').replace(/s$/, '');
            const candidates = [`id${vquery}`, `id${tableName}`, 'id'];
            pkField = Object.keys(record).find(k => candidates.includes(k.toLowerCase()));
            if (pkField) return pkField;

            // 3. Fallback to system IDs (pkHierarchy)
            const pkHierarchy = ['idfield', 'idcontrol', 'idgrid', 'idreport', 'idtable', 'idconsult', 'idfunction', 'idfile', 'iduser', 'idrole', 'idacademia', 'idcurso', 'idform', 'idsistema', 'id'];
            pkField = Object.keys(record).find(k => pkHierarchy.includes(k.toLowerCase()));
            if (pkField) return pkField;

            // 4. Ultimate fallback to first 'id' prefix
            pkField = Object.keys(record).find(k => k.toLowerCase().startsWith('id'));
            return pkField || Object.keys(record)[0]; // Último recurso: primer campo
        };
    }, [gridMeta.fields, gridMeta.vquery]);

    const getRowId = useMemo(() => {
        return (params) => {
            const d = params.data;
            if (!d) return Math.random().toString();
            const pkField = detectPK(d);
            return pkField && d[pkField] !== undefined ? String(d[pkField]) : String(d.id || Math.random().toString());
        };
    }, [detectPK]);

    const fetchData = React.useCallback(async (silent = false) => {
        if (gridMeta.gparent && !masterRecord) {
            setData([]);
            setTotalRecords(0);
            return;
        }
        if (!silent) setLoading(true);
        isSaving.current = true;
        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                ...(sortField && { sortField, sortOrder }),
                ...(gridFilters && { filters: JSON.stringify(gridFilters) }),
                ...(searchText && { search: searchText }),
                showDeleted: showDeleted,
                ...extraParams
            };

            if (gridMeta.gparent && masterRecord) {
                let masterPkField = null;

                // 1. Intentar encontrar el Meta del Grid Padre para obtener su PK real configurada
                if (allGrids) {
                    const parentGrid = allGrids.find(g => g.idgrid === gridMeta.gparent);
                    if (parentGrid && parentGrid.fields) {
                        // Buscar el campo marcado como PK en el padre
                        masterPkField = parentGrid.fields.find(f => f.pk === true)?.campo;

                        // Si no hay PK marcado, intentar adivinar basado en el nombre del padre (ej: xforms -> idform)
                        if (!masterPkField && parentGrid.vquery) {
                            const vquery = parentGrid.vquery.toLowerCase();
                            const tableName = vquery.replace(/^x/, '').replace(/s$/, '');
                            const candidate = `id${tableName}`;
                            if (masterRecord[candidate] !== undefined) masterPkField = candidate;
                        }
                    }
                }

                // 2. Fallback a la jerarquía si no se pudo determinar por metadata del padre
                if (!masterPkField) {
                    const pkHierarchy = ['idfield', 'idcontrol', 'idgrid', 'idreport', 'idtable', 'idconsult', 'idfunction', 'idfile', 'iduser', 'idrole', 'idacademia', 'idcurso', 'idform', 'idsistema', 'id'];
                    masterPkField = pkHierarchy.find(key => masterRecord[key] !== undefined) || Object.keys(masterRecord)[0];
                }

                params.masterField = masterPkField;
                params.masterValue = masterRecord[masterPkField];
                params.masterRecordPayload = JSON.stringify(masterRecord);
            }

            // Si hay un registro pendiente de localizar, agregar params para que el backend calcule la página
            if (pendingLocate.current) {
                params.locateField = pendingLocate.current.field;
                params.locateValue = pendingLocate.current.value;
                pendingLocate.current = null;
            }

            const res = await axios.get(`/api/dynamic/data/${idform}/${gridMeta.idgrid}`, { params });
            if (res.data.success) {
                setData(res.data.data);
                setTotalRecords(res.data.meta.total);
                setServerAggregates(res.data.meta.aggregates || {});
                if (res.data.meta.uiStyles) {
                    setUiStyles(prev => ({ ...prev, ...res.data.meta.uiStyles }));
                }
                // Si el backend devolvió una página diferente (porque localizó el registro), sincronizar
                if (res.data.meta.page !== undefined) {
                    const serverPage = res.data.meta.page - 1; // Backend es 1-indexed, frontend 0-indexed
                    if (serverPage !== page) {
                        setPage(serverPage);
                    }
                }
            } else {
                setError(res.data.error || 'Error fetching grid data');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            if (!silent) setLoading(false);
            isSaving.current = false;
        }
    }, [idform, gridMeta, page, rowsPerPage, sortField, sortOrder, gridFilters, searchText, extraParams, masterRecord, showDeleted]);

    // Re-seleccionar registro tras fetchData (cuando pendingSelectPK está activo)
    useEffect(() => {
        if (!pendingSelectPK.current || !gridRef.current?.api || data.length === 0) return;
        const pkValue = pendingSelectPK.current;
        pendingSelectPK.current = null;

        // Buscar nodo por PK en la grilla
        const api = gridRef.current.api;
        let targetNode = null;
        let targetIndex = null;
        api.forEachNodeAfterFilterAndSort((node, index) => {
            if (targetNode) return;
            const d = node.data;
            if (!d) return;
            const pkField = detectPK(d);
            if (pkField && String(d[pkField]) === String(pkValue)) {
                targetNode = node;
                targetIndex = index;
            }
        });

        if (targetNode) {
            const colToFocus = pendingSelectCol.current || api.getAllDisplayedColumns()[0]?.getColId();
            pendingSelectCol.current = null;

            // Si hay un movimiento pendiente (flecha arriba/abajo), aplicarlo DESPUÉS de ubicar la fila
            if (pendingMove.current) {
                const { direction, colId } = pendingMove.current;
                const nextIndex = targetIndex + direction;
                const rowCount = api.getDisplayedRowCount();
                pendingMove.current = null;

                if (nextIndex >= 0 && nextIndex < rowCount) {
                    api.deselectAll();
                    const nextNode = api.getDisplayedRowAtIndex(nextIndex);
                    if (nextNode) {
                        nextNode.setSelected(true);
                        api.ensureIndexVisible(nextIndex, 'middle');
                        api.setFocusedCell(nextIndex, colId || colToFocus);
                    }
                } else {
                    // Estamos en el borde, quedarnos en la fila actual
                    api.deselectAll();
                    targetNode.setSelected(true);
                    api.ensureIndexVisible(targetIndex, 'middle');
                    if (colToFocus) api.setFocusedCell(targetIndex, colToFocus);
                }
            } else {
                // Sin movimiento pendiente: re-enfocar la misma celda
                api.deselectAll();
                targetNode.setSelected(true);
                api.ensureIndexVisible(targetIndex, 'middle');
                if (colToFocus) api.setFocusedCell(targetIndex, colToFocus);
            }
        }
    }, [data, detectPK]);

    // Cargar datos al montar y cuando cambien sus dependencias estables
    useEffect(() => {
        fetchData();
    }, [fetchData, sactivateData]);


    // Puente global para los controles HTML personalizados
    useEffect(() => {
        window.ghenesis = {
            run: (action) => {
                if (gridMeta.ejecuta) {
                    runGridScript(gridMeta.ejecuta, {
                        action,
                        grid: { api: gridRef.current?.api, columnApi: gridRef.current?.columnApi },
                        data,
                        selected: selectedRecord,
                        ui: {
                            alert: (title, message, severity = 'info') =>
                                setAlertConfig({ open: true, title, message, severity }),
                            notify: (msg) => console.log("[Ghenesis Notify]", msg),
                            setLabel: (key, value) => setUiStyles(prev => ({ ...prev, [key]: { ...prev[key], label: value } })),
                            setStyle: (key, style) => setUiStyles(prev => ({ ...prev, [key]: { ...prev[key], ...style } })),
                            refresh: () => fetchData(),
                            reporte: (idreport) => window.dispatchEvent(new CustomEvent('open-report', { detail: idreport })),
                            setSearch: (text) => {
                                setSearchText(text);
                                setPage(0);
                            },
                            setParam: (key, value) => {
                                setExtraParams(prev => ({ ...prev, [key]: value }));
                                setPage(0);
                            },
                            setParams: (obj) => {
                                setExtraParams(prev => ({ ...prev, ...obj }));
                                setPage(0);
                            },
                            clearParams: () => {
                                setExtraParams({});
                                setPage(0);
                            },
                            clearFilters: () => {
                                setGridFilters(null);
                                setSearchText('');
                                setExtraParams({});
                                setPage(0);
                            },
                            // --- NUEVO: API FLUIDA DE FILTRADO ---
                            filter: () => {
                                const internalParams = {};
                                const builder = {
                                    igual: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[field] = val; return builder; },
                                    distinto: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_ne`] = val; return builder; },
                                    mayor: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_gt`] = val; return builder; },
                                    mayorIgual: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_ge`] = val; return builder; },
                                    menor: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_lt`] = val; return builder; },
                                    menorIgual: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_le`] = val; return builder; },
                                    contiene: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_like`] = val; return builder; },
                                    aplicar: () => {
                                        setExtraParams(internalParams);
                                        setPage(0);
                                    }
                                };
                                return builder;
                            }
                        },
                        api: axios
                    });
                }
            }
        };
        return () => { delete window.ghenesis; };
    }, [gridMeta.ejecuta, data, selectedRecord, fetchData]);

    // Disparar acción de inicialización si existe un script
    useEffect(() => {
        if (gridMeta.ejecuta) {
            // Un pequeño delay para asegurar que cualquier HTML personalizado en la cabecera ya esté renderizado
            const timer = setTimeout(() => {
                if (window.ghenesis && typeof window.ghenesis.run === 'function') {
                    window.ghenesis.run('INIT');
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [gridMeta.idgrid]); // Solo cuando cambia el grid

    // Notificar al padre cuando cambia el estado de edición (para ocultar el detail en master-detail)
    useEffect(() => {
        if (onEditingStateChange) {
            onEditingStateChange(!!editingRecord);
        }
    }, [editingRecord, onEditingStateChange]);
    const openMenu = Boolean(anchorEl);
    const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleToggleDeleted = () => {
        const newState = !showDeleted;
        setShowDeleted(newState);
        setPage(0);
        handleMenuClose();
    };

    const handleContextMenu = (event) => {
        event.preventDefault();
        setContextMenu(
            contextMenu === null
                ? { mouseX: event.clientX - 2, mouseY: event.clientY - 4 }
                : null,
        );
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    const handleCellDoubleClicked = React.useCallback((params) => {
        const fieldMeta = (gridMeta.fields || []).find(f => f.campo === params.colDef.field);
        if (fieldMeta && fieldMeta.tipod === 'W' && !readonlyMode && !simplified) {
            setMemoEditor({
                open: true,
                campo: fieldMeta.campo,
                tipoMemo: parseInt(fieldMeta.tipomemo, 10) || 1,
                title: fieldMeta.titlefield || fieldMeta.campo,
                node: params.node
            });
        }
    }, [gridMeta.fields, readonlyMode, simplified]);

    // Procesar el script de dibujado personalizado de la grilla (sdraw)
    const getRowStyle = useMemo(() => {
        if (!gridMeta?.sdraw || gridMeta.sdraw.trim() === '') return undefined;

        try {
            // Creamos una función en tiempo de ejecución de forma segura
            // Se le pasa 'data' (la fila actual) y debe manipular el objeto local 'style'
            const sdrawFunc = new Function('data', `
                let style = {}; 
                try {
                    ${gridMeta.sdraw}
                } catch(err) {
                    console.error("Error en script sdraw (xgrid):", err);
                }
                return style;
            `);

            // AG Grid Callback
            return (params) => {
                if (!params.data) return undefined;
                const resultStyle = sdrawFunc(params.data);
                return Object.keys(resultStyle).length > 0 ? resultStyle : undefined;
            };
        } catch (e) {
            console.error("Error compilando sdraw de xgrid:", e);
            return undefined;
        }
    }, [gridMeta?.sdraw]);


    // Mapear Columnas de Ghenesis a AG-Grid
    // Usamos gridMeta.idgrid como dependencia principal para asegurar estabilidad
    const columnDefs = useMemo(() => {
        // Incluimos campos ocultos si tienen "cabeza", para que actúen como columnas expandibles
        const fields = (gridMeta.fields || [])
            .filter(f => !f.oculto || (f.cabeza && f.cabeza.trim() !== ''))
            .sort((a, b) => a.posicion - b.posicion);

        let savedState = {};
        try {
            const stored = localStorage.getItem(`grid-col-state-${gridMeta.idgrid}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                // EL DEVELOPER MANDA: Si la versión de la base de datos es mayor, ignoramos localstorage
                if (!gridMeta.layout_version || (parsed.version && parsed.version >= gridMeta.layout_version)) {
                    savedState = parsed.state || {};
                } else {
                    console.log('Nueva versión de interfaz detectada, ignorando configuración local');
                }
            }
        } catch (e) { }

        // Si hay estado guardado válido, respetar el orden de las columnas del usuario
        if (Object.keys(savedState).length > 0) {
            fields.sort((a, b) => {
                const ia = savedState[a.campo]?.index ?? 999;
                const ib = savedState[b.campo]?.index ?? 999;
                return ia - ib;
            });
        }

        const defs = [
            {
                width: 50,
                pinned: 'left',
                sortable: false,
                resizable: false,
                headerCheckboxSelection: true,
                checkboxSelection: true,
                suppressMenu: true,
                suppressMovable: true,
                lockPosition: 'left',
                cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
            }
        ];
        let currentGroup = null;

        fields.forEach(f => {
            const colDef = {
                field: f.campo,
                headerName: f.titlefield || f.campo,
                initialWidth: savedState[f.campo]?.width || f.ancho || 150,
                minWidth: 1,
                wrapText: true,
                autoHeight: true,
                wrapHeaderText: false,
                autoHeaderHeight: false,
                headerTooltip: f.titlefield || f.campo,
                valueGetter: (params) => {
                    const val = params.data?.[f.campo];

                    if (f.tipod === 'D' && val) {
                        try {
                            const dateStr = val.toString().split('T')[0];
                            const d = new Date(dateStr + 'T00:00:00');
                            return isNaN(d.getTime()) ? val : d;
                        } catch (e) {
                            return val;
                        }
                    }
                    return val;
                },
                valueFormatter: (params) => {
                    if (params.value === null || params.value === undefined) return '';

                    if (f.comboDataKeyVal && f.comboDataKeyVal[String(params.value)]) {
                        return f.comboDataKeyVal[String(params.value)];
                    }

                    // Aplicar formato para números (F: Float, I: Integer)
                    if (f.tipod === 'F' || f.tipod === 'I') {
                        return formatNumber(params.value, f.formato, f.tipod === 'F');
                    }

                    // Formato para fechas (D: Date) - Usa formatDate con el patrón de 'formato'
                    if (f.tipod === 'D') {
                        return formatDate(params.value, f.formato);
                    }

                    return params.value;
                },
                cellRenderer: (params) => {
                    if (f.tipod === 'W') {
                        const tipoNum = parseInt(f.tipomemo, 10) || 1;
                        let label = tipoNum === 2 ? 'Code' : tipoNum === 3 ? 'Document' : 'Text';

                        // Si hay contenido, mostrar en MAYÚSCULAS
                        if (params.value && String(params.value).trim() !== '') {
                            label = label.toUpperCase();
                        }

                        return (
                            <Typography variant="body2" sx={{
                                color: 'primary.main',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                [{label}]
                            </Typography>
                        );
                    }
                    if (f.tipod === 'B') {
                        return <Checkbox checked={Boolean(params.value)} readOnly size="small" sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 18 } }} />;
                    }
                    if (f.campo === 'previsualizacion' || f.campo === 'xicons' || f.tipod === 'X') {
                        const val = params.value || (f.campo === 'previsualizacion' ? params.data?.nombre : null);
                        if (!val) return null;
                        const iconName = val.charAt(0).toUpperCase() + val.slice(1);
                        const IconComp = Icons[iconName];
                        return IconComp ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', pt: 0.5 }}>
                                <IconComp sx={{ fontSize: 20 }} />
                            </Box>
                        ) : val;
                    }

                    if (params.valueFormatted !== null && params.valueFormatted !== undefined) {
                        return params.valueFormatted;
                    }

                    if (typeof params.value === 'object' && params.value !== null) {
                        return JSON.stringify(params.value);
                    }
                    return params.value;
                },
                cellDataType: f.tipod === 'D' ? false : 'text',
                // AsyncComboEditor solo para shadow columns (sqlcombo + datafield)
                // agSelectCellEditor nativo para combos regulares (sqlcombo sin datafield, o valcombo)
                cellEditor: (f.sqlcombo && f.sqlcombo.trim() !== '' && f.datafield && f.datafield.trim() !== '')
                    ? AsyncComboEditor
                    : ((f.sqlcombo && f.sqlcombo.trim() !== '') || (f.valcombo && f.valcombo.trim() !== ''))
                        ? 'agSelectCellEditor'
                        : (f.tipod === 'D' ? 'agDateCellEditor' : undefined),
                cellEditorPopup: !!(f.sqlcombo && f.sqlcombo.trim() !== '' && f.datafield && f.datafield.trim() !== ''),
                cellEditorParams: (f.sqlcombo && f.sqlcombo.trim() !== '' && f.datafield && f.datafield.trim() !== '')
                    ? { idform, idgrid: gridMeta.idgrid }
                    : ((f.sqlcombo && f.sqlcombo.trim() !== '') || (f.valcombo && f.valcombo.trim() !== ''))
                        ? {
                            values: f.comboDataList
                                ? f.comboDataList.map(d => d.value)
                                : (f.valcombo ? f.valcombo.split(',').map(v => v.trim()).filter(Boolean) : []),
                            valueListFormatter: (params) => {
                                if (f.comboDataKeyVal && f.comboDataKeyVal[String(params.value)]) {
                                    return f.comboDataKeyVal[String(params.value)];
                                }
                                return params.value;
                            }
                        }
                        : undefined,
                //              editable: !simplified && !readonlyMode,
                editable: (params) => {
                    // Si la fila está anclada (es de totales), no permitir edición
                    if (params.node.isRowPinned()) return false;

                    // Los campos Memo se editan en una ventana emergente
                    if (f.tipod === 'W') return false;

                    // De lo contrario, seguir la lógica normal del componente
                    return !simplified && !readonlyMode;
                },
                filter: (f.tipod === 'I' || f.tipod === 'F') ? 'agNumberColumnFilter' : (!f.calculado && !simplified),
                filterValueGetter: (params) => {
                    const val = params.data?.[f.campo];
                    if (f.comboDataKeyVal && val !== undefined && f.comboDataKeyVal[String(val)]) {
                        return f.comboDataKeyVal[String(val)];
                    }

                    if (f.tipod === 'D') {
                        return formatDate(val, f.formato);
                    }
                    // Para números, asegurar que devolvemos un Number para que el filtro local sea preciso
                    return (f.tipod === 'I' || f.tipod === 'F') ? (val !== null ? Number(val) : null) : val;
                },
                filterParams: (f.tipod === 'I' || f.tipod === 'F') ? {
                    filterOptions: [
                        {
                            displayKey: 'equals',
                            displayName: 'Igual a',
                            predicate: ([filterValue], cellValue) => {
                                if (filterValue == null || cellValue == null) return filterValue === cellValue;
                                // Si el filtro no tiene decimales, comparamos solo la parte entera (Smart Search)
                                const hasDecimals = String(filterValue).includes('.') || String(filterValue).includes(',');
                                if (!hasDecimals) {
                                    return Math.trunc(cellValue) === Math.trunc(filterValue);
                                }
                                // Si tiene decimales, comparación exacta
                                return cellValue === filterValue;
                            },
                            numberOfInputs: 1
                        },
                        'notEqual', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual', 'inRange'
                    ]
                } : (f.tipod === 'D' ? {} : undefined),
                sortable: !f.calculado && !simplified,
                comparator: (valueA, valueB, nodeA, nodeB) => {
                    let labelA = String(valueA || '');
                    let labelB = String(valueB || '');

                    if (f.comboDataKeyVal) {
                        labelA = f.comboDataKeyVal[String(valueA)] || labelA;
                        labelB = f.comboDataKeyVal[String(valueB)] || labelB;
                    }



                    if (f.tipod === 'I' || f.tipod === 'F') {
                        const a = isNaN(labelA) ? 0 : Number(labelA);
                        const b = isNaN(labelB) ? 0 : Number(labelB);
                        return a - b;
                    }
                    return String(labelA).localeCompare(String(labelB));
                },
                resizable: !simplified,
                suppressMovable: simplified,
                cellStyle: {
                    textAlign: f.alinear === 'D' ? 'right' : f.alinear === 'C' ? 'center' : 'left',
                    backgroundColor: f.color || undefined,
                    color: f.fontcolor || undefined,
                    fontWeight: f.fontbold ? 'bold' : 'normal',
                    textTransform: gridMeta.mayusculas ? 'uppercase' : 'none'
                },
                valueSetter: (params) => {
                    let newValue = params.newValue;
                    if (gridMeta.mayusculas && typeof newValue === 'string' && f.tipod !== 'W') {
                        newValue = newValue.toUpperCase();
                    }

                    // Asegurar casteo correcto para números ya que usamos cellDataType: 'text'
                    if (f.tipod === 'I') newValue = parseInt(newValue, 10);
                    if (f.tipod === 'F') newValue = parseFloat(newValue);

                    // Si es fecha (D), asegurar que se guarde en formato estándar string (YYYY-MM-DD)
                    if (f.tipod === 'D' && newValue !== undefined) {
                        // Permitir borrar la celda
                        if (newValue === null || String(newValue).trim() === '') {
                            newValue = null;
                        }
                        // 1. Si ya es YYYY-MM-DD
                        else if (typeof newValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(newValue)) {
                            // Ya está en el formato correcto
                        } else {
                            let d;
                            // 2. Objeto Date (Normalmente inyectado por el DatePicker de AG Grid)
                            if (newValue instanceof Date) {
                                d = newValue;
                            } else {
                                const dateStr = String(newValue);

                                // 3. Capturar ISO string manual o generado por librerías
                                const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                // 4. Input manual DD/MM/YYYY o DD-MM-YYYY (2 o 4 dígitos de año)
                                const dmyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})$/);

                                if (isoMatch) {
                                    d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
                                } else if (dmyMatch) {
                                    let y = parseInt(dmyMatch[3], 10);
                                    if (y < 100) y += (y < 50 ? 2000 : 1900); // 23 -> 2023, 99 -> 1999

                                    const m = parseInt(dmyMatch[2], 10) - 1;
                                    const dia = parseInt(dmyMatch[1], 10);
                                    d = new Date(y, m, dia);

                                    // Validación estricta: Si JS auto-corrigió la fecha (ej: 30 Feb se vuelve 2 Mar), entonces es inválida
                                    if (d.getFullYear() !== y || d.getMonth() !== m || d.getDate() !== dia) {
                                        return false; // Revertir a celda anterior
                                    }
                                } else {
                                    // Fallback final
                                    d = new Date(dateStr);
                                }
                            }

                            // Asegurarse de que el Date finalmente sea válido
                            if (d && !isNaN(d.getTime())) {
                                // Solucion al AgDateCellEditor nativo: Este componente devuelve la fecha a las 00:00 UTC.
                                // En Latinoamérica, esa hora UTC equivale al DIA ANTERIOR en hora local.
                                // Entonces, si un Date Object viene *exactamente* a las 00:00:00.000 UTC, sabemos que vino del picker
                                // y por lo tanto debemos extraer los factores UTC (que representan la fecha elegida real).
                                if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCMilliseconds() === 0) {
                                    const year = d.getUTCFullYear();
                                    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                                    const day = String(d.getUTCDate()).padStart(2, '0');
                                    newValue = `${year}-${month}-${day}`;
                                } else {
                                    // Para fechas manuales parcheadas localmente
                                    const year = d.getFullYear();
                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                    const day = String(d.getDate()).padStart(2, '0');
                                    newValue = `${year}-${month}-${day}`;
                                }
                            } else {
                                console.error("valueSetter Date Parse Error:", newValue);
                                alert("Error interno del Grid: No se pudo interpretar la fecha " + String(newValue));
                                return false; // Fechas nulas/inválidas se devuelven intactas al estado previo
                            }
                        }
                    }

                    params.data[f.campo] = newValue;
                    return true;
                },
                // Agregar aggFunc si el campo tiene totalizar=true y es numérico
                ...(f.totalizar && (f.tipod === 'I' || f.tipod === 'F') && { aggFunc: 'sum' })
            };

            if (f.cabeza && f.cabeza.trim() !== '') {
                if (f.oculto) {
                    colDef.columnGroupShow = 'open';
                }

                if (currentGroup && currentGroup.headerName === f.cabeza) {
                    currentGroup.children.push(colDef);
                } else {
                    currentGroup = {
                        headerName: f.cabeza,
                        children: [colDef],
                        marryChildren: false,
                        openByDefault: false
                    };
                    defs.push(currentGroup);
                }
            } else {
                currentGroup = null;
                defs.push(colDef);
            }
        });

        return defs;
    }, [gridMeta.idgrid, gridMeta.fields, gridMeta.layout_version]);

    // Obtener totales desde el servidor o calcular localmente si no hay servidor
    const pinnedBottomRowData = useMemo(() => {
        const totalsRow = {};

        // Iterar sobre todos los campos y si tienen totalizar=true
        (gridMeta.fields || []).forEach(f => {
            if (f.totalizar && (f.tipod === 'I' || f.tipod === 'F')) {
                // Usar el valor que vino del servidor (total de toda la consulta)
                const total = serverAggregates[f.campo] ?? 0;
                totalsRow[f.campo] = formatNumber(total, f.formato, f.tipod === 'F');
            }
        });

        // Agregar un label en la primera columna si hay totales
        if (Object.keys(totalsRow).length > 0) {
            const firstField = (gridMeta.fields || []).find(f => f.posicion === 0) || (gridMeta.fields || [])[0];
            if (firstField) {
                totalsRow[firstField.campo] = 'TOTAL';
            }
            return [totalsRow];
        }

        return [];
    }, [serverAggregates, gridMeta.fields]);

    const hasGroups = useMemo(() => {
        return (gridMeta.fields || []).some(f => f.cabeza && f.cabeza.trim() !== '');
    }, [gridMeta.fields]);

    // Guardar estado completo de columnas (orden + anchos)
    const saveColumnState = (api) => {
        if (!api) return;
        const columnState = api.getColumnState();
        const stateToStore = {};
        columnState.forEach((col, index) => {
            stateToStore[col.colId] = { width: col.width, index };
        });
        localStorage.setItem(`grid-col-state-${gridMeta.idgrid}`, JSON.stringify({
            version: gridMeta.layout_version || 0,
            state: stateToStore
        }));
    };

    const handleColumnResized = (e) => {
        if (e.finished && e.source === 'uiColumnResized') {
            saveColumnState(e.api);
            // Auto-guardar en base de datos si es desarrollador
            //if (isDeveloper) handleSaveInterface(e.api);
        }
    };

    const handleColumnMoved = (e) => {
        if (e.finished) {
            saveColumnState(e.api);
            // Auto-guardar en base de datos si es desarrollador
            //if (isDeveloper) handleSaveInterface(e.api);
        }
    };


    // Atajos dinámicos provenientes de la configuración del sistema
    const systemShortcuts = useMemo(() => gridMeta?.sistema?.shortcuts || {}, [gridMeta?.sistema?.shortcuts]);

    // Escuchar Atajos de Teclado Globales (F5 y otros)
    useEffect(() => {
        const handleKeyDown = (e) => {
            const pressedKey = (e.ctrlKey ? 'ctrl+' : '') + e.key.toLowerCase();

            // Buscar acción asociada al shortcut en systemShortcuts (formato: { "add": "f2", ... })
            let customAction = null;
            for (const [actionName, shortcutValue] of Object.entries(systemShortcuts)) {
                if (shortcutValue && typeof shortcutValue === 'string' && shortcutValue.toLowerCase() === pressedKey) {
                    customAction = actionName.toUpperCase();
                    break;
                }
            }

            // Log de depuración para el programador (visible en consola)
            if (customAction || e.key.startsWith('F')) {
                console.log(`[Keyboard] Key: ${pressedKey}, Action: ${customAction || 'None'}`);
            }

            // 1. REFRESH: F5 o lo configurado (siempre se permite F5)
            if (customAction === 'REFRESH' || (e.key === 'F5' && !customAction)) {
                e.preventDefault();
                e.stopPropagation();
                fetchData();
                return;
            }

            // 2. AGREGAR (ADD)
            if (customAction === 'ADD') {
                e.preventDefault();
                e.stopPropagation();
                handleAddRecord();
                return;
            }

            // 3. EDITAR (EDIT)
            if (customAction === 'EDIT') {
                e.preventDefault();
                e.stopPropagation();
                handleEditSelected();
                return;
            }

            // 4. ELIMINAR (DELETE)
            if (customAction === 'DELETE') {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteSelected();
                return;
            }

            // Fallback para DELETE (Ctrl+Supr)
            if ((e.ctrlKey && (e.key === 'Delete' || e.key === 'Backspace')) && !customAction) {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteSelected();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRecord, systemShortcuts, fetchData]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSelectionChanged = async () => {
        const api = gridRef.current?.api;
        if (!api) return;
        const selectedRows = api.getSelectedRows();

        // Para el indicador y el detalle, usamos la fila enfocada si hay selección
        const focusedCell = api.getFocusedCell();
        let primaryRecord = null;
        let primaryIndex = null;

        if (focusedCell) {
            const focusedNode = api.getDisplayedRowAtIndex(focusedCell.rowIndex);
            if (focusedNode && focusedNode.isSelected()) {
                primaryRecord = focusedNode.data;
                primaryIndex = focusedCell.rowIndex;
            }
        }

        // Fallback: si no hay foco o el foco no está seleccionado, usar primera seleccionada
        if (!primaryRecord && selectedRows.length > 0) {
            primaryRecord = selectedRows[0];
            api.forEachNodeAfterFilterAndSort((node, index) => {
                if (primaryIndex === null && node.data === primaryRecord) primaryIndex = index;
            });
        }

        setSelectedRecord(primaryRecord);
        setSelectedRowIndex(primaryIndex !== null ? page * rowsPerPage + primaryIndex + 1 : null);

        if (primaryRecord) {
            await dispatchGridEvent('sscroll', { selected: primaryRecord });
        }

        if (onRowSelect) {
            onRowSelect(gridMeta.idgrid, primaryRecord);
        }
    };

    const handleSortChanged = (e) => {
        const sortState = e.api.getColumnState().find(s => s.sort != null);
        if (sortState) {
            setSortField(sortState.colId);
            setSortOrder(sortState.sort);
        } else {
            setSortField(null);
            setSortOrder(null);
        }
        setPage(0);
    };

    const handleRestoreRecord = async () => {
        const selectedNodes = gridRef.current?.api?.getSelectedNodes();
        if (!selectedNodes || selectedNodes.length === 0) return;

        const ids = selectedNodes.map(node => {
            const pkField = detectPK(node.data);
            return node.data[pkField];
        }).filter(id => id !== undefined && id !== null);

        if (ids.length === 0) return;

        try {
            const res = await axios.post(`/api/dynamic/data-restore/${idform}/${gridMeta.idgrid}/${ids.join(',')}`);
            if (res.data.success) {
                setAlertConfig({
                    open: true,
                    title: 'Restaurado',
                    message: ids.length > 1 ? `${ids.length} registros restaurados exitosamente` : 'Registro restaurado exitosamente',
                    severity: 'success'
                });
                fetchData();
            }
        } catch (e) {
            setAlertConfig({ open: true, title: 'Error', message: 'No se pudo restaurar: ' + (e.response?.data?.error || e.message), severity: 'error' });
        }
    };

    const handlePermanentDelete = async () => {
        const selectedNodes = gridRef.current?.api?.getSelectedNodes();
        if (!selectedNodes || selectedNodes.length === 0) return;

        const ids = selectedNodes.map(node => {
            const pkField = detectPK(node.data);
            return node.data[pkField];
        }).filter(id => id !== undefined && id !== null);

        if (ids.length === 0) return;

        const msg = ids.length > 1
            ? `¿Está ABSOLUTAMENTE SEGURO de eliminar estos ${ids.length} registros permanentemente? Esta acción NO SE PUEDE DESHACER.`
            : '¿Está ABSOLUTAMENTE SEGURO de eliminar este registro permanentemente? Esta acción NO SE PUEDE DESHACER.';

        if (!window.confirm(msg)) return;

        try {
            const res = await axios.delete(`/api/dynamic/data-permanent/${idform}/${gridMeta.idgrid}/${ids.join(',')}`);
            if (res.data.success) {
                setAlertConfig({
                    open: true,
                    title: 'Eliminado',
                    message: ids.length > 1 ? `${ids.length} registros eliminados físicamente` : 'Registro eliminado físicamente del sistema',
                    severity: 'success'
                });
                fetchData();
            }
        } catch (e) {
            setAlertConfig({ open: true, title: 'Error', message: 'No se pudo eliminar permanentemente: ' + (e.response?.data?.error || e.message), severity: 'error' });
        }
    };

    const dispatchGridEvent = async (eventName, eventData = {}) => {
        const scriptCode = gridMeta[eventName];
        if (!scriptCode || scriptCode.trim() === '') return true; // Continúa el ciclo si no hay script

        return new Promise(async (resolve) => {
            try {
                const context = {
                    action: eventName.toUpperCase(),
                    grid: { api: gridRef.current?.api, columnApi: gridRef.current?.columnApi },
                    data: data,
                    selected: eventData.selected || selectedRecord,
                    record: eventData.record || {},
                    ui: {
                        alert: (title, message, severity = 'info') =>
                            setAlertConfig({ open: true, title, message, severity }),
                        notify: (msg) => console.log(`[Ghenesis ${eventName}]`, msg),
                        setLabel: (key, value) => setUiStyles(prev => ({ ...prev, [key]: { ...prev[key], label: value } })),
                        setStyle: (key, style) => setUiStyles(prev => ({ ...prev, [key]: { ...prev[key], ...style } })),
                        refresh: () => fetchData(true),
                        reporte: (idreport) => window.dispatchEvent(new CustomEvent('open-report', { detail: idreport })),
                        setSearch: (text) => {
                            setSearchText(text);
                            setPage(0);
                        },
                        setParam: (key, value) => {
                            setExtraParams(prev => ({ ...prev, [key]: value }));
                            setPage(0);
                        },
                        setParams: (obj) => {
                            setExtraParams(prev => ({ ...prev, ...obj }));
                            setPage(0);
                        },
                        clearParams: () => {
                            setExtraParams({});
                            setPage(0);
                        },
                        clearFilters: () => {
                            setGridFilters(null);
                            setSearchText('');
                            setExtraParams({});
                            setPage(0);
                        },
                        filter: () => {
                            const internalParams = {};
                            const builder = {
                                igual: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[field] = val; return builder; },
                                distinto: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_ne`] = val; return builder; },
                                mayor: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_gt`] = val; return builder; },
                                mayorIgual: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_ge`] = val; return builder; },
                                menor: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_lt`] = val; return builder; },
                                menorIgual: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_le`] = val; return builder; },
                                contiene: (field, val) => { if (val !== undefined && val !== null && val !== '') internalParams[`${field}_like`] = val; return builder; },
                                aplicar: () => {
                                    setExtraParams(internalParams);
                                    setPage(0);
                                }
                            };
                            return builder;
                        }
                    },
                    api: axios
                };

                const result = await runGridScript(scriptCode, context);
                // Si el script retorna `false` explícitamente, abortamos la acción (ej: validación fallida)
                resolve(result !== false);
            } catch (err) {
                console.error(`Error en ciclo de vida ${eventName}:`, err);
                resolve(false); // aborta por seguridad si hay error
            }
        });
    };

    const handleFilterChanged = (e) => {
        const filterModel = e.api.getFilterModel();
        // Excluir filtros de campos combo sin datafield:
        // El filterValueGetter filtra por label (texto), pero la columna real es numérica.
        // El filtro client-side ya funciona, no se debe enviar al backend.
        const backendFilters = { ...filterModel };
        (gridMeta.fields || []).forEach(f => {
            if (f.comboDataKeyVal && (!f.datafield || f.datafield.trim() === '') && backendFilters[f.campo]) {
                delete backendFilters[f.campo];
            }
        });
        setGridFilters(Object.keys(backendFilters).length > 0 ? backendFilters : null);
        setPage(0);
    };

    const handleAddRecord = async () => {
        const newRecordContext = {};
        // Dispara snewrecord pasando un objeto en blanco para que el script pueda inyectar valores por defecto
        const continuable = await dispatchGridEvent('snewrecord', { record: newRecordContext });
        if (continuable) {
            setEditingRecord(newRecordContext);
        }
    };

    const handleEditSelected = () => {
        if (selectedRecord) {
            setEditingRecord(selectedRecord);
        }
    };

    const closeEdit = () => {
        // Guardar PK del registro editado para reseleccionarlo tras refrescar
        if (editingRecord) {
            const pkField = detectPK(editingRecord);
            if (pkField && editingRecord[pkField] !== undefined) {
                pendingSelectPK.current = editingRecord[pkField];
                pendingLocate.current = { field: pkField, value: editingRecord[pkField] };
            }
        }
        setEditingRecord(null);
        fetchData();
    };

    const handleDeleteSelected = () => {
        const selectedNodes = gridRef.current?.api?.getSelectedNodes();
        if (!selectedNodes || selectedNodes.length === 0) return;
        setIsDeleting(true);
    };

    const executeDelete = async () => {
        setIsDeleting(false);

        const selectedNodes = gridRef.current?.api?.getSelectedNodes();
        if (!selectedNodes || selectedNodes.length === 0) return;

        // Fase 1: BEFORE DELETE (Puede Abortar)
        // Nota: El evento sdelete normalmente opera sobre la fila enfocada,
        // para masivos podríamos disparar uno por uno o pasar la lista.
        // Por compatibilidad con scripts existentes, pasamos el primer record o el array.
        const continuable = await dispatchGridEvent('sdelete', {
            records: selectedNodes.map(n => n.data),
            record: selectedNodes[0].data
        });
        if (!continuable) return;

        const ids = selectedNodes.map(node => {
            const pkField = detectPK(node.data);
            return node.data[pkField];
        }).filter(id => id !== undefined && id !== null);

        if (ids.length === 0) return;

        try {
            const res = await axios.delete(`/api/dynamic/data/${idform}/${gridMeta.idgrid}/${ids.join(',')}`);
            if (res.data.success) {
                // Fase 2: AFTER DELETE (Post exito)
                await dispatchGridEvent('sdeletepost', {
                    records: selectedNodes.map(n => n.data),
                    count: ids.length
                });
                fetchData();
            } else {
                alert('Error al eliminar: ' + res.data.error);
            }
        } catch (error) {
            console.error('Error en executeDelete:', error);
            alert('Excepción al intentar eliminar registros');
        }
    };

    const handleExportXlsx = () => {
        setIsConfirmingExport(true);
    };

    const executeExport = async () => {
        setIsConfirmingExport(false);
        if (!gridRef.current) return;
        const cols = gridRef.current.api.getColumnDefs();
        const headers = cols.map(c => c.headerName || c.field);
        const fields = cols.map(c => c.field);

        try {
            const params = {
                page: 1, limit: 0,
                ...(sortField && { sortField, sortOrder }),
                ...(gridFilters && { filters: JSON.stringify(gridFilters) })
            };

            if (gridMeta.gparent && masterRecord) {
                const pkHierarchy = ['idfield', 'idcontrol', 'idgrid', 'idreport', 'idtable', 'idconsult', 'idfunction', 'idfile', 'iduser', 'idrole', 'idacademia', 'idcurso', 'idform', 'idsistema', 'id'];
                const masterPkField = pkHierarchy.find(key => masterRecord[key] !== undefined) || Object.keys(masterRecord)[0];

                params.masterField = masterPkField;
                params.masterValue = masterRecord[masterPkField];
                params.masterRecordPayload = JSON.stringify(masterRecord);
            }

            const res = await axios.get(`/api/dynamic/data/${idform}/${gridMeta.idgrid}`, { params });
            if (!res.data.success) {
                alert('Error al exportar: ' + (res.data.error || 'Error desconocido'));
                return;
            }

            const allData = res.data.data || [];
            const rows = allData.map(record => fields.map(f => record[f] ?? ''));
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, gridMeta.titulo || 'Datos');
            XLSX.writeFile(wb, `${gridMeta.titulo || 'Exportacion'}.xlsx`);
        } catch (err) {
            console.error('Error exportando XLSX', err);
            alert('Ocurrió un error al exportar los datos.');
        }
    };

    const handlePrint = () => {
        window.open(`http://localhost:3000/api/dynamic/report/catalog_rep`, '_blank');
    };

    const handleSaveInterface = async (passedApi) => {
        const api = passedApi || (gridRef.current && gridRef.current.api);
        if (!api) return;

        // Obtener estado actual de las columnas (contiene anchos y orden)
        const columnState = api.getColumnState();
        const validFields = (gridMeta.fields || []).map(f => f.campo);

        // Mapear a lo que el backend espera, filtrando solo columnas que existen en XFIELD
        const payload = {
            idgrid: gridMeta.idgrid,
            columns: columnState
                .filter(col => validFields.includes(col.colId))
                .map((col, index) => ({
                    campo: col.colId,
                    ancho: Math.round(col.width || 150),
                    posicion: index + 1,
                    oculto: !!col.hide
                }))
        };

        try {
            const res = await axios.post('/api/dynamic/save-interface', payload);
            if (res.data.success) {
                setAlertConfig({
                    open: true,
                    title: 'Interfaz Guardada',
                    message: 'La configuración de anchos, orden y visibilidad de las columnas se ha guardado permanentemente en los metadatos.',
                    severity: 'success'
                });
                console.log('Interfaz guardada correctamente');
            }
        } catch (err) {
            setAlertConfig({
                open: true,
                title: 'Error al Guardar',
                message: 'No se pudo guardar la configuración de la interfaz: ' + err.message,
                severity: 'error'
            });
            console.error('Error saving interface:', err);
        }
    };

    const handleCellValueChanged = async (event) => {
        const { colDef, newValue } = event;
        const recordData = { ...event.data };
        const rowId = getRowId(event);

        // Propagar datafield si existe (Mapping virtual -> físico)
        const fieldMeta = gridMeta.fields?.find(f => f.campo === colDef.field);
        if (fieldMeta && fieldMeta.datafield && fieldMeta.datafield.trim() !== '') {
            recordData[fieldMeta.datafield.trim()] = newValue;
        }

        // --- COMPORTAMIENTO BATCH EDIT (recnoedit) ---
        if (gridMeta.recnoedit) {
            setPendingChanges(prev => ({
                ...prev,
                [rowId]: {
                    ...(prev[rowId] || {}),
                    [colDef.field]: newValue
                }
            }));
            if (onEditingStateChange) onEditingStateChange(true);

            // Ejecutar movimiento pendiente (flechas arriba/abajo) inmediatamente
            if (pendingMove.current && gridRef.current?.api) {
                const { direction, rowIndex, colId } = pendingMove.current;
                const nextIndex = rowIndex + direction;
                const api = gridRef.current.api;
                const rowCount = api.getDisplayedRowCount();
                if (nextIndex >= 0 && nextIndex < rowCount) {
                    api.setFocusedCell(nextIndex, colId);
                    const node = api.getDisplayedRowAtIndex(nextIndex);
                    if (node) {
                        api.deselectAll();
                        node.setSelected(true);
                    }
                }
                pendingMove.current = null;
            }
            return;
        }

        // Fase 1: BEFORE SAVE INLINE
        if (dispatchGridEvent) {
            const continuable = await dispatchGridEvent('ssave', { record: recordData });
            if (!continuable) {
                fetchData(true);
                return;
            }
        }

        // Identificar PK basándonos en la lógica comprobada (usando helper)
        const pkField = detectPK(recordData);
        if (!pkField) {
            console.error('No se pudo identificar la clave primaria para guardar inline');
            return;
        }

        try {
            const res = await axios.post(`/api/dynamic/data/${idform}/${gridMeta.idgrid}`, {
                data: recordData,
                isUpdate: true,
                recordId: recordData[pkField],
                pkField: pkField
            });

            if (!res.data.success) {
                alert("Error al guardar cambios: " + res.data.error);
                fetchData(true);
            } else {
                console.log('Fila guardada automáticamente (inline edit)');
                // Fase 2: AFTER SAVE INLINE
                if (dispatchGridEvent) {
                    await dispatchGridEvent('ssavepost', { record: recordData });
                }
            }

            // Guardar PK y Columna para reseleccionar tras refrescar
            const pkVal = recordData[pkField];
            if (pkVal !== undefined && pkVal !== null) {
                pendingSelectPK.current = pkVal;
                pendingSelectCol.current = colDef.field;
                pendingLocate.current = { field: pkField, value: pkVal };
            }

            // Refrescar totales y datos de forma silenciosa
            await fetchData(true);

            // El pendingMove se ejecutará en el useEffect de reselección,
            // cuando los datos ya estén renderizados en la grilla.
        } catch (error) {
            console.error('Error en auto-guardado inline:', error);
            alert("Excepción crítica al guardar cambios: " + (error.response?.data?.error || error.message));
            fetchData(true);
        }
    };

    const handleBatchCancel = () => {
        setPendingChanges({});
        if (onEditingStateChange) onEditingStateChange(false);
        fetchData(true);
    };

    const handleBatchSave = async () => {
        const rowIds = Object.keys(pendingChanges);
        if (rowIds.length === 0) return;

        setLoading(true);
        let successCount = 0;
        let errorCount = 0;

        for (const rowId of rowIds) {
            const changes = pendingChanges[rowId];
            const node = gridRef.current?.api?.getRowNode(rowId);
            if (!node) continue;

            const recordData = { ...node.data, ...changes };
            const pkField = detectPK(recordData);

            try {
                // BEFORE SAVE
                const continuable = await dispatchGridEvent('ssave', { record: recordData });
                if (!continuable) {
                    errorCount++;
                    continue;
                }

                const res = await axios.post(`/api/dynamic/data/${idform}/${gridMeta.idgrid}`, {
                    data: recordData,
                    isUpdate: true,
                    recordId: recordData[pkField],
                    pkField: pkField
                });

                if (res.data.success) {
                    successCount++;
                    // AFTER SAVE
                    await dispatchGridEvent('ssavepost', { record: recordData });
                } else {
                    errorCount++;
                }
            } catch (err) {
                console.error(`Error saving row ${rowId}:`, err);
                errorCount++;
            }
        }

        setLoading(false);
        setPendingChanges({});
        if (onEditingStateChange) onEditingStateChange(false);
        fetchData(true);
    };

    const applyColumnStates = (states) => {
        if (!gridRef.current || !gridRef.current.api) return;
        try {
            gridRef.current.api.applyColumnState({
                state: states,
                applyOrder: true
            });
        } catch (e) {
            console.error("Error applying column states:", e);
        }
    };

    if (error) return <Alert severity="error">{error}</Alert>;

    if (editingRecord) {
        return (
            <>
                <DynamicForm
                    gridMeta={gridMeta}
                    idform={idform}
                    record={editingRecord}
                    onClose={closeEdit}
                    allGrids={allGrids}
                    readonlyMode={readonlyMode}
                    uiStyles={uiStyles}
                    dispatchGridEvent={dispatchGridEvent}
                />
                <AlertDialog
                    open={alertConfig.open}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    severity={alertConfig.severity}
                    onClose={() => setAlertConfig({ ...alertConfig, open: false })}
                />
            </>
        );
    }

    return (
        <Paper
            elevation={gridMeta.gparent ? 0 : 3}
            className={gridMeta.mayusculas ? 'force-uppercase' : ''}
            sx={{
                width: '100%',
                height: autoHeightContent ? 'auto' : '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: gridMeta.pie ? 'auto' : 'hidden',
                borderRadius: gridMeta.gparent ? 0 : undefined,
                border: gridMeta.gparent ? 'none' : undefined
            }}
        >
            {/* Área de Cabecera Personalizada (Metadata) */}
            {gridMeta.cabecera && (
                <Box
                    sx={{ p: 0, borderBottom: '1px solid #eee' }}
                    dangerouslySetInnerHTML={{ __html: gridMeta.cabecera }}
                />
            )}

            {/* Header: Titulo y Botones (Oculto en simplified de consulta, visible en autoHeightContent de formulario) */}
            {(!simplified || autoHeightContent) && (
                <Box sx={{
                    pl: { xs: 1.5, sm: 1 },
                    pr: { xs: 0, sm: 1 },
                    py: { xs: 0.3, sm: 0.4 },
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    borderBottom: 1,
                    borderColor: 'divider',
                    gap: { xs: 1, sm: 0 }
                }}>
                    <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' }, pr: { sm: 2 } }}>
                        <Typography noWrap sx={{
                            fontWeight: 'bold',
                            fontSize: { xs: '0.9rem', sm: '1.05rem' },
                            color: uiStyles.title?.color || 'var(--active-tab-color)',
                            display: uiStyles.title?.visible === false ? 'none' : 'block',
                            m: 0
                        }}>
                            {uiStyles.title?.label || gridMeta.titulo}
                        </Typography>
                    </Box>
                    {/* Barra de Herramientas Principal */}
                    {!gridMeta.ocultabar && (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0, width: { xs: '100%', sm: 'auto' }, overflowX: 'auto', pb: { xs: 0.5, sm: 0 }, '&::-webkit-scrollbar': { display: 'none' } }}>
                            {!readonlyMode && (
                                <Button
                                    variant="outlined" color="success"
                                    onClick={handleAddRecord}
                                    disabled={uiStyles.new?.disabled}
                                    startIcon={isMobile ? null : <AddIcon />}
                                    sx={{
                                        borderRadius: '8px', textTransform: 'none', px: isMobile ? 1 : 2, py: 0.4, minWidth: isMobile ? 40 : 'auto', fontWeight: 600,
                                        display: uiStyles.new?.visible === false ? 'none' : 'flex',
                                        backgroundColor: uiStyles.new?.backgroundColor,
                                        color: uiStyles.new?.color,
                                        borderColor: uiStyles.new?.borderColor
                                    }}
                                >
                                    {isMobile ? <AddIcon /> : (uiStyles.new?.label || "Nuevo")}
                                </Button>
                            )}

                            <Button
                                variant="outlined" color="primary"
                                disabled={!selectedRecord || gridMeta.readonlyg || uiStyles.edit?.disabled}
                                onClick={handleEditSelected}
                                startIcon={isMobile ? null : <EditIcon />}
                                sx={{
                                    borderRadius: '8px', textTransform: 'none', px: isMobile ? 1 : 2, py: 0.75, minWidth: isMobile ? 40 : 'auto', fontWeight: 600,
                                    display: uiStyles.edit?.visible === false ? 'none' : 'flex',
                                    backgroundColor: uiStyles.edit?.backgroundColor,
                                    color: uiStyles.edit?.color,
                                    borderColor: uiStyles.edit?.borderColor
                                }}
                            >
                                {isMobile ? <EditIcon /> : (uiStyles.edit?.label || "Editar")}
                            </Button>

                            {!readonlyMode && !showDeleted && (
                                <Button
                                    variant="outlined" color="error" disableFocusRipple
                                    disabled={!selectedRecord || gridMeta.readonlyg || uiStyles.delete?.disabled}
                                    onClick={handleDeleteSelected}
                                    startIcon={isMobile ? null : <DeleteIcon />}
                                    sx={{
                                        borderRadius: '8px', textTransform: 'none', px: isMobile ? 1 : 2, py: 0.75, minWidth: isMobile ? 40 : 'auto', fontWeight: 600,
                                        display: uiStyles.delete?.visible === false ? 'none' : 'flex',
                                        backgroundColor: uiStyles.delete?.backgroundColor,
                                        color: uiStyles.delete?.color,
                                        borderColor: uiStyles.delete?.borderColor
                                    }}
                                >
                                    {isMobile ? <DeleteIcon /> : (uiStyles.delete?.label || "Borrar")}
                                </Button>
                            )}

                            {showDeleted && (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="contained" color="success"
                                        disabled={!selectedRecord} // Podría ser enabled con masivo, pero selectedRecord ya indica si hay al menos uno
                                        onClick={handleRestoreRecord}
                                        startIcon={<Icons.RestoreFromTrash />}
                                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                                    >
                                        Restaurar
                                    </Button>
                                    <Button
                                        variant="contained" color="error"
                                        disabled={!selectedRecord}
                                        onClick={handlePermanentDelete}
                                        startIcon={<DeleteIcon />}
                                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                                    >
                                        Borrar Físico
                                    </Button>
                                </Box>
                            )}

                            <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', height: 28, mx: 0.5 }}></Box>

                            <IconButton
                                onClick={() => fetchData()} color="default"
                                disabled={uiStyles.refresh?.disabled}
                                sx={{
                                    borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38,
                                    display: uiStyles.refresh?.visible === false ? 'none' : 'inline-flex',
                                    color: uiStyles.refresh?.color,
                                    backgroundColor: uiStyles.refresh?.backgroundColor
                                }}
                            >
                                <RefreshIcon />
                            </IconButton>

                            <IconButton
                                color="info" onClick={handleExportXlsx}
                                disabled={uiStyles.export?.disabled}
                                sx={{
                                    borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38,
                                    display: uiStyles.export?.visible === false ? 'none' : 'inline-flex',
                                    color: uiStyles.export?.color,
                                    backgroundColor: uiStyles.export?.backgroundColor
                                }}
                            >
                                <DownloadIcon />
                            </IconButton>

                            <Tooltip title={uiStyles.options?.label || "Más opciones"}>
                                <IconButton
                                    color="default" onClick={handleMenuClick}
                                    disabled={uiStyles.options?.disabled}
                                    sx={{
                                        borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38,
                                        display: uiStyles.options?.visible === false ? 'none' : 'inline-flex',
                                        color: uiStyles.options?.color,
                                        backgroundColor: uiStyles.options?.backgroundColor
                                    }}
                                >
                                    <MoreVertIcon />
                                </IconButton>
                            </Tooltip>

                            <Menu
                                anchorEl={anchorEl} open={openMenu} onClose={handleMenuClose}
                                PaperProps={{ elevation: 3, sx: { mt: 1.5, minWidth: 150 } }}
                                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                            >
                                <MenuItem onClick={() => { handlePrint(); handleMenuClose(); }}>
                                    <PrintIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                                    Reporte Principal
                                </MenuItem>
                                {isDeveloper && (
                                    <MenuItem onClick={() => { handleSaveInterface(); handleMenuClose(); }}>
                                        <SaveIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                                        Guardar interfaz
                                    </MenuItem>
                                )}
                                {(isDeveloper || user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'ADMINISTRADOR') && (
                                    <MenuItem onClick={handleToggleDeleted} sx={{ color: showDeleted ? 'primary.main' : 'inherit' }}>
                                        {showDeleted ? <Icons.Visibility /> : <Icons.DeleteSweep />}
                                        <Typography sx={{ ml: 1 }}>
                                            {showDeleted ? "Ver registros activos" : "Ver registros eliminados"}
                                        </Typography>
                                    </MenuItem>
                                )}
                            </Menu>
                        </Box>
                    )}
                </Box>
            )}

            <Box
                onContextMenu={handleContextMenu}
                sx={{ flexGrow: 1, flexShrink: gridMeta.pie ? 0 : 1, minHeight: gridMeta.pie ? (uiStyles.grid?.minHeight || 'calc(100% - 130px)') : 'auto', width: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}
            >
                {/* Menú Contextual Personalizado */}
                <Menu
                    open={contextMenu !== null}
                    onClose={handleCloseContextMenu}
                    anchorReference="anchorPosition"
                    anchorPosition={
                        contextMenu !== null
                            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                            : undefined
                    }
                >
                    <MenuItem onClick={() => { fetchData(); handleCloseContextMenu(); }}>
                        <RefreshIcon fontSize="small" sx={{ mr: 1 }} /> Actualizar (F5)
                    </MenuItem>
                    {!readonlyMode && (
                        <MenuItem onClick={() => { handleAddRecord(); handleCloseContextMenu(); }}>
                            <AddIcon fontSize="small" sx={{ mr: 1 }} /> Agregar (F2)
                        </MenuItem>
                    )}
                    {selectedRecord && !readonlyMode && (
                        <MenuItem onClick={() => { handleEditSelected(); handleCloseContextMenu(); }}>
                            <EditIcon fontSize="small" sx={{ mr: 1 }} /> Editar
                        </MenuItem>
                    )}
                    {selectedRecord && !readonlyMode && !showDeleted && (
                        <MenuItem onClick={() => { handleDeleteSelected(); handleCloseContextMenu(); }}>
                            <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Borrar
                        </MenuItem>
                    )}
                    {selectedRecord && showDeleted && (
                        <>
                            <MenuItem onClick={() => { handleRestoreRecord(); handleCloseContextMenu(); }} sx={{ color: 'success.main' }}>
                                <Icons.RestoreFromTrash fontSize="small" sx={{ mr: 1 }} /> Restaurar registro
                            </MenuItem>
                            <MenuItem onClick={() => { handlePermanentDelete(); handleCloseContextMenu(); }} sx={{ color: 'error.main' }}>
                                <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Borrar definitivamente
                            </MenuItem>
                        </>
                    )}
                    <MenuItem onClick={() => { handleExportXlsx(); handleCloseContextMenu(); }}>
                        <DownloadIcon fontSize="small" sx={{ mr: 1 }} /> Exportar Excel
                    </MenuItem>
                    {isDeveloper && (
                        <MenuItem onClick={() => { handleSaveInterface(); handleCloseContextMenu(); }}>
                            <SaveIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} /> Guardar interfaz
                        </MenuItem>
                    )}
                </Menu>
                {loading && (
                    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                        <CircularProgress />
                    </Box>
                )}
                <Box sx={{
                    flexGrow: 1,
                    width: '100%',
                    // Solo activar altura dinámica si se pide explícitamente (ej: en el formulario)
                    ...(autoHeightContent && {
                        height: 'auto',
                        minHeight: 50,
                        '& .ag-root-wrapper': {
                            border: 'none'
                        }
                    }),
                    // Si no es auto-height, forzamos 100% para ocupar el espacio del Splitter o Tab
                    ...(!autoHeightContent && {
                        height: '100%',
                        minHeight: 0
                    })
                }}>
                    <AgGridReact
                        domLayout={autoHeightContent ? 'autoHeight' : 'normal'}
                        ref={gridRef}
                        theme={myTheme}
                        rowData={data}
                        columnDefs={columnDefs}
                        maintainColumnOrder={true}
                        getRowId={getRowId}
                        getRowStyle={getRowStyle}
                        rowSelection="multiple"
                        suppressRowClickSelection={true}
                        rowMultiSelectWithClick={false}
                        onSelectionChanged={handleSelectionChanged}
                        onCellDoubleClicked={handleCellDoubleClicked}
                        onCellMouseDown={() => { focusFromClickRef.current = Date.now(); }}
                        onRowClicked={(params) => {
                            const event = params.event;
                            const api = params.api;
                            const node = params.node;
                            if (!node || node.isRowPinned()) return;

                            // Detectar si el click fue en la columna del checkbox
                            const colId = params.column?.getColId?.() || '';
                            const colDef = params.column?.getColDef?.() || {};
                            const isCheckboxCol = colDef.checkboxSelection === true;

                            if (isCheckboxCol) {
                                // Click en checkbox: toggle individual sin limpiar las demás
                                node.setSelected(!node.isSelected());
                            } else if (event.shiftKey) {
                                // Shift+Click: selección por rango
                                const focusedCell = api.getFocusedCell();
                                const startIdx = focusedCell ? focusedCell.rowIndex : 0;
                                const endIdx = params.rowIndex;
                                const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
                                if (!event.ctrlKey && !event.metaKey) {
                                    api.deselectAll();
                                }
                                for (let i = lo; i <= hi; i++) {
                                    const n = api.getDisplayedRowAtIndex(i);
                                    if (n) n.setSelected(true);
                                }
                            } else if (event.ctrlKey || event.metaKey) {
                                // Ctrl/Cmd+Click: toggle individual sin limpiar
                                node.setSelected(!node.isSelected());
                            } else {
                                // Click normal: seleccionar solo esta fila
                                api.deselectAll();
                                node.setSelected(true);
                            }
                        }}
                        onSortChanged={handleSortChanged}
                        onFilterChanged={handleFilterChanged}
                        onColumnResized={handleColumnResized}
                        onColumnMoved={handleColumnMoved}
                        onCellValueChanged={handleCellValueChanged}
                        stopEditingWhenCellsLoseFocus={true}
                        onCellKeyDown={(params) => {
                            const { event, api, column, node, value } = params;

                            // --- COPIAR FILAS (Ctrl+C / Cmd+C) ---
                            const isCopyRow = (event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C');
                            // --- COPIAR CELDA (Ctrl+K / Cmd+K) ---
                            const isCopyCell = (event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K');

                            if (isCopyRow || isCopyCell) {
                                event.preventDefault();
                                event.stopPropagation();

                                const selectedNodes = api.getSelectedNodes();
                                let textToCopy = '';

                                if (isCopyRow) {
                                    // Copiar toda la fila (o filas seleccionadas si hay varias)
                                    // Si no hay filas seleccionadas explícitamente, tomamos la actual del nodo
                                    const nodesToProcess = selectedNodes.length > 0 ? selectedNodes : [node];

                                    textToCopy = nodesToProcess.filter(sn => sn).map(sn => {
                                        return api.getAllDisplayedColumns()
                                            .filter(col => {
                                                const colDef = col.getColDef();
                                                // Ignorar columna de selección
                                                return colDef.checkboxSelection !== true;
                                            })
                                            .map(col => {
                                                let val = api.getCellValue({
                                                    rowNode: sn,
                                                    column: col,
                                                    node: sn,
                                                    data: sn.data
                                                });

                                                if (val === undefined || val === null) val = sn.data[col.getColDef().field];

                                                const fieldMeta = (gridMeta.fields || []).find(f => f.campo === col.getColDef().field);
                                                if (fieldMeta && fieldMeta.comboDataKeyVal && fieldMeta.comboDataKeyVal[String(val)]) {
                                                    val = fieldMeta.comboDataKeyVal[String(val)];
                                                }
                                                return (val !== null && val !== undefined) ? String(val) : '';
                                            })
                                            .join('\t');
                                    }).join('\n');
                                } else if (isCopyCell) {
                                    // Copiar solo la celda actual (Cmd+K)
                                    const rawValue = value !== undefined ? value : (node?.data?.[column.getColId()]);
                                    textToCopy = (rawValue !== null && rawValue !== undefined) ? String(rawValue) : '';
                                }

                                if (textToCopy) {
                                    navigator.clipboard.writeText(textToCopy).then(() => {
                                        console.warn(`[Ghenesis] ${isCopyRow ? 'Fila(s)' : 'Celda'} copiada al portapapeles`);
                                    }).catch(err => {
                                        console.error('Error crítico al copiar:', err);
                                        const textArea = document.createElement("textarea");
                                        textArea.value = textToCopy;
                                        document.body.appendChild(textArea);
                                        textArea.select();
                                        document.execCommand("copy");
                                        document.body.removeChild(textArea);
                                    });
                                }
                                return;
                            }

                            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                if (api.getEditingCells().length > 0) {
                                    const currentRowIndex = node?.rowIndex ?? params.rowIndex ?? 0;
                                    // Registrar movimiento pendiente y detener edición
                                    // El guardado se dispara en onCellValueChanged -> handleCellValueChanged
                                    pendingMove.current = {
                                        direction: event.key === 'ArrowDown' ? 1 : -1,
                                        rowIndex: currentRowIndex,
                                        colId: column.getColId()
                                    };
                                    api.stopEditing();
                                    event.preventDefault();
                                }
                            }
                        }}
                        onCellEditingStopped={(params) => {
                            // Fallback para cuando NO hubo cambios (no se dispara handleCellValueChanged)
                            // o si el guardado falló. Esperamos un poco para dejar que handleCellValueChanged gane.
                            setTimeout(() => {
                                if (pendingMove.current && !isSaving.current) {
                                    const { direction, rowIndex, colId } = pendingMove.current;
                                    const nextIndex = rowIndex + direction;
                                    const rowCount = params.api.getDisplayedRowCount();
                                    if (nextIndex >= 0 && nextIndex < rowCount) {
                                        params.api.setFocusedCell(nextIndex, colId);
                                        const node = params.api.getDisplayedRowAtIndex(nextIndex);
                                        if (node) node.setSelected(true);
                                    }
                                    pendingMove.current = null;
                                }
                            }, 200);
                        }}
                        onFirstDataRendered={(params) => {
                            if (!autoFocusFirstRow) return;
                            // Seleccionar y enfocar el primer registro al cargar los datos
                            const firstRowNode = params.api.getDisplayedRowAtIndex(0);
                            if (firstRowNode) {
                                firstRowNode.setSelected(true);
                                const firstCol = params.api.getAllDisplayedColumns()[0];
                                params.api.setFocusedCell(0, firstCol);
                            }
                        }}
                        onCellFocused={(e) => {
                            if (e.column && e.api) {
                                const colId = e.column.getColId();
                                const fieldMeta = (gridMeta.fields || []).find(f => f.campo === colId);
                                if (fieldMeta) setFocusedHelpText(fieldMeta.ayuda || fieldMeta.titlefield || colId);

                                // Si el foco vino de un click reciente (<100ms), onRowClicked ya manejó la selección
                                if (Date.now() - focusFromClickRef.current < 100) {
                                    return;
                                }

                                // Navegación por teclado: sincronizar selección
                                if (e.rowIndex !== null && e.rowIndex !== undefined && !e.rowPinned) {
                                    const rowNode = e.api.getDisplayedRowAtIndex(e.rowIndex);
                                    if (rowNode) {
                                        if (shiftHeldRef.current) {
                                            // Shift+Flecha: agregar a la selección
                                            rowNode.setSelected(true);
                                        } else if (!rowNode.isSelected()) {
                                            // Flecha simple: seleccionar solo esta fila
                                            e.api.deselectAll();
                                            rowNode.setSelected(true);
                                        }
                                    }
                                }
                            }
                        }}
                        enableBrowserTooltips={false}
                        tooltipShowDelay={0}
                        animateRows={false}
                        rowHeight={gridMeta.altofila || 34}
                        headerHeight={simplified ? 30 : 34}
                        groupHeaderHeight={hasGroups ? 34 : 0}
                        floatingFiltersHeight={simplified ? 0 : 34}
                        pinnedBottomRowData={pinnedBottomRowData}
                        defaultColDef={{
                            sortable: true,
                            filter: !simplified,
                            floatingFilter: !simplified,
                            resizable: !simplified,
                            unSortIcon: false,
                            cellClassRules: {
                                'cell-dirty': (params) => {
                                    if (!gridMeta.recnoedit || !params.data || !params.column) return false;
                                    const rowId = getRowId(params);
                                    const colId = params.column.getColId();
                                    return !!pendingChanges[rowId]?.[colId];
                                }
                            },
                            suppressKeyboardEvent: (params) => {
                                // Evitar que el editor numérico de AG Grid incremente/decremente el valor con las flechas
                                // antes de que nuestra lógica de navegación y guardado tome el control.
                                const { event, editing } = params;
                                if (editing && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                                    return true; // Le dice a AG Grid que ignore el evento interno
                                }
                                return false;
                            },
                            suppressHeaderMenuButton: simplified,
                            cellClass: (params) => {
                                // Si la fila es pinned (totales), aplicar estilos especiales
                                if (params.node && params.node.rowPinned) {
                                    return 'ag-pinned-total-row';
                                }
                                return '';
                            },
                            filterParams: {
                                buttons: ['clear'],
                                debounceMs: 500,
                                closeOnApply: false
                            }
                        }}
                    />
                </Box>
            </Box>

            {/* Barra de Acciones Batch (Guardar/Cancelar) */}
            {gridMeta.recnoedit && Object.keys(pendingChanges).length > 0 && (
                <Box sx={{
                    px: 2,
                    py: 0.8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    // bgcolor: 'rgba(60, 122, 125, 0.85)',
                    bgcolor: 'rgb(from var(--primary-color) r g b / 10%)',
                    color: 'white',
                    borderTop: '2px solid',
                    borderColor: 'var(--primary-color)',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
                    zIndex: 10
                }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<Icons.Check />}
                            onClick={handleBatchSave}
                            sx={{ fontWeight: 'bold', textTransform: 'none', borderRadius: 2, bgcolor: 'var(--primary-color)', '&:hover': { bgcolor: '#1a3a4d' } }}
                        >
                            Guardar
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Icons.Close />}
                            onClick={handleBatchCancel}
                            sx={{ fontWeight: 'bold', textTransform: 'none', borderRadius: 2, color: 'white', borderColor: 'white', bgcolor: 'var(--grid-header-bg)', '&:hover': { bgcolor: 'rgba(60,122,125,0.9)' } }}
                        >
                            Cancelar
                        </Button>
                    </Box>
                </Box>
            )}

            {/* Barra de Ayuda del Campo Enfocado (Sigue activa para feedback) */}
            {focusedHelpText && (
                <Box sx={{
                    px: { xs: 1.5, sm: 2 },
                    py: 0.6,
                    bgcolor: '#f4f6f8',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    minHeight: 28,
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <Typography sx={{ fontSize: '0.82rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                        {focusedHelpText}
                    </Typography>
                </Box>
            )}

            {/* Paginador personalizado - Se muestra si NO es simplificado O si supera el rxpage */}
            {(!simplified || totalRecords > (gridMeta.rxpage || 10)) && (
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.2,
                    pl: { xs: 1, sm: 1 },
                    pr: { xs: 1, sm: 1 },
                    py: { xs: 0.4, sm: 0.5 },
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    '&::-webkit-scrollbar': { height: '4px' },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: '#ccc', borderRadius: '4px' }
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box component="span" sx={{
                            fontWeight: 'bold',
                            fontSize: '0.875rem',
                            display: { xs: 'none', sm: 'inline-block' }
                        }}>RxP:</Box>
                        <TextField
                            select
                            size="small"
                            value={rowsPerPage}
                            onChange={handleChangeRowsPerPage}
                            sx={{
                                minWidth: { xs: 65, sm: 85 },
                                width: { xs: 65, sm: 85 },
                                '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f4f6f8' },
                                '& .MuiSelect-select': { py: 0.5, pl: 1, pr: 2 }
                            }}
                        >
                            {[10, 50, 100, 1000].map(val => <MenuItem key={val} value={val}>{val}</MenuItem>)}
                        </TextField>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: { xs: 1, sm: 2 } }}>
                        <Button variant="outlined" sx={{ minWidth: 36, width: 36, p: 0.5, borderRadius: '8px', borderColor: '#ccc', color: '#555' }} disabled={page === 0} onClick={() => setPage(0)}><FirstPageIcon fontSize="small" /></Button>
                        <Button variant="outlined" sx={{ minWidth: 36, width: 36, p: 0.5, borderRadius: '8px', borderColor: '#ccc', color: '#555' }} disabled={page === 0} onClick={() => setPage(page - 1)}><NavigateBeforeIcon fontSize="small" /></Button>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: { xs: 1, sm: 1 } }}>
                        <Box component="span" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Pag:</Box>
                        <TextField
                            size="small"
                            value={page + 1}
                            onChange={(e) => {
                                let p = parseInt(e.target.value);
                                const maxPage = Math.ceil(totalRecords / rowsPerPage) || 1;
                                if (!isNaN(p) && p >= 1 && p <= maxPage) setPage(p - 1);
                            }}
                            sx={{
                                width: 50,
                                minWidth: 50,
                                '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f4f6f8' },
                                '& input': { textAlign: 'center', p: '4.5px 8px' }
                            }}
                        />
                        <Box component="span" sx={{ fontSize: '0.875rem', mx: 0.5 }}>/ {Math.ceil(totalRecords / rowsPerPage) || 1}</Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: { xs: 1, sm: 1 } }}>
                        <Button variant="outlined" sx={{ minWidth: 36, width: 36, p: 0.5, borderRadius: '8px', borderColor: '#ccc', color: '#555' }} disabled={page >= (Math.ceil(totalRecords / rowsPerPage) - 1)} onClick={() => setPage(page + 1)}><NavigateNextIcon fontSize="small" /></Button>
                        <Button variant="outlined" sx={{ minWidth: 36, width: 36, p: 0.5, borderRadius: '8px', borderColor: '#ccc', color: '#555' }} disabled={page >= (Math.ceil(totalRecords / rowsPerPage) - 1)} onClick={() => setPage(Math.ceil(totalRecords / rowsPerPage) - 1)}><LastPageIcon fontSize="small" /></Button>
                    </Box>

                    <Box component="span" sx={{ ml: { xs: 1, sm: 2 }, fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>
                        Reg. {selectedRowIndex !== null ? selectedRowIndex : (totalRecords > 0 ? (page * rowsPerPage + 1) : 0)} de {totalRecords}
                    </Box>
                </Box>
            )}

            {/* Área de Pie Personalizada (Metadata) */}
            {gridMeta.pie && (
                <Box
                    sx={{ p: 1, borderTop: '1px solid #ccc', flexShrink: 0, bgcolor: 'background.paper' }}
                    dangerouslySetInnerHTML={{ __html: gridMeta.pie }}
                />
            )}
            {/* Solo mostrar Diálogo de Confirmación si no es simplificado */}
            {!simplified && (
                <>
                    {/* Diálogo de Confirmación para Exportación */}
                    <ConfirmDialog
                        open={isConfirmingExport}
                        title="Exportar a Excel"
                        message={`¿Deseas descargar los ${data.length} registros actuales en formato Excel?`}
                        confirmText="Exportar"
                        type="info"
                        onConfirm={executeExport}
                        onCancel={() => setIsConfirmingExport(false)}
                    />

                    <ConfirmDialog
                        open={isDeleting}
                        title="Confirmar Eliminación"
                        message={gridRef.current?.api?.getSelectedNodes()?.length > 1
                            ? `¿Estás seguro de que deseas eliminar los ${gridRef.current.api.getSelectedNodes().length} registros seleccionados?`
                            : "¿Estás seguro de que deseas eliminar el registro seleccionado?"}
                        confirmText="Eliminar"
                        type="error"
                        onConfirm={executeDelete}
                        onCancel={() => setIsDeleting(false)}
                    />


                    <AlertDialog
                        open={alertConfig.open}
                        title={alertConfig.title}
                        message={alertConfig.message}
                        severity={alertConfig.severity}
                        onClose={() => setAlertConfig({ ...alertConfig, open: false })}
                    />

                    <MemoEditorDialog
                        open={memoEditor.open}
                        onClose={() => setMemoEditor({ ...memoEditor, open: false })}
                        onAccept={async (content) => {
                            if (memoEditor.node && gridRef.current?.api) {
                                // 1. Actualizar el valor a nivel visual (frontend)
                                memoEditor.node.setDataValue(memoEditor.campo, content);

                                // 2. Extraer la definición de la columna y el eventObject para forzar 'handleCellValueChanged'
                                // Normalmente setDataValue debiera detonar el handler si lo bindeas a un field,
                                // pero para estar 100% seguros y evitar loops raros simulamos el evento nativo:
                                const colDef = gridRef.current.api.getColumnDef(memoEditor.campo);

                                const simEvent = {
                                    api: gridRef.current.api,
                                    colDef: colDef || { field: memoEditor.campo },
                                    data: memoEditor.node.data,
                                    node: memoEditor.node,
                                    newValue: content,
                                    oldValue: memoEditor.node.data[memoEditor.campo]
                                };

                                // 3. Disparar autoguardado manual
                                await handleCellValueChanged(simEvent);
                            }
                            setMemoEditor({ ...memoEditor, open: false });
                        }}
                        initialValue={memoEditor.node?.data?.[memoEditor.campo] || ''}
                        tipoMemo={memoEditor.tipoMemo}
                        fieldTitle={memoEditor.title}
                    />
                </>
            )}
        </Paper>
    );
};

export default DynamicGrid;
