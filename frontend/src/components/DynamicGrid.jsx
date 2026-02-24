import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Paper, TextField, CircularProgress, Alert, Button, Box, Typography,
    IconButton, Tooltip, Menu, MenuItem, useTheme, useMediaQuery, Checkbox
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
import AlertDialog from './AlertDialog';

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

const DynamicGrid = ({ gridMeta, idform, masterRecord, onRowSelect, onEditingStateChange, allGrids, sactivateData, readonlyMode, simplified, autoFocusFirstRow = true }) => {
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

    // Estado para Edit y Selección
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [selectedRowIndex, setSelectedRowIndex] = useState(null);
    const [editingRecord, setEditingRecord] = useState(null);
    const [focusedHelpText, setFocusedHelpText] = useState('');

    // Estado para Menú de Reportes (Móvil/Desplegable)
    const [anchorEl, setAnchorEl] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', message: '', severity: 'info' });
    const [uiStyles, setUiStyles] = useState({});

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
                            setStyle: (key, style) => setUiStyles(prev => ({ ...prev, [key]: { ...prev[key], ...style } }))
                        },
                        api: axios
                    });
                }
            }
        };
        return () => { delete window.ghenesis; };
    }, [gridMeta.ejecuta, data, selectedRecord]);

    // Notificar al padre cuando cambia el estado de edición (para ocultar el detail en master-detail)
    useEffect(() => {
        if (onEditingStateChange) {
            onEditingStateChange(!!editingRecord);
        }
    }, [editingRecord, onEditingStateChange]);
    const [isConfirmingExport, setIsConfirmingExport] = useState(false);
    const openMenu = Boolean(anchorEl);
    const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // Estado para Menú Contextual (Click Derecho)
    const [contextMenu, setContextMenu] = useState(null);

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

        const defs = [];
        let currentGroup = null;

        fields.forEach(f => {
            const colDef = {
                field: f.campo,
                headerName: f.titlefield || f.campo,
                initialWidth: savedState[f.campo]?.width || f.ancho || 150,
                minWidth: f.ancho || undefined,
                wrapText: true,
                autoHeight: true,
                wrapHeaderText: false,
                autoHeaderHeight: false,
                headerTooltip: f.titlefield || f.campo,
                valueFormatter: (params) => {
                    if (gridMeta.mayusculas && typeof params.value === 'string') {
                        return params.value.toUpperCase();
                    }
                    return params.value;
                },
                cellRenderer: (params) => {
                    if (f.tipod === 'B') {
                        return <Checkbox checked={Boolean(params.value)} readOnly size="small" sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 18 } }} />;
                    }
                    if (f.campo === 'previsualizacion' || f.campo === 'xicons' || f.tipod === 'X') {
                        // En grillas de iconos, 'previsualizacion' suele ser calculado.
                        // Usamos params.value si existe, sino intentamos con params.data.nombre
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
                    if (typeof params.value === 'object' && params.value !== null) {
                        return JSON.stringify(params.value);
                    }
                    return params.value;
                },
                editable: !simplified && !readonlyMode,
                filter: !f.calculado && !simplified,
                sortable: !f.calculado && !simplified,
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
                    if (gridMeta.mayusculas && typeof newValue === 'string') {
                        newValue = newValue.toUpperCase();
                    }
                    params.data[f.campo] = newValue;
                    return true;
                }
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
            if (isDeveloper) handleSaveInterface(e.api);
        }
    };

    const handleColumnMoved = (e) => {
        if (e.finished) {
            saveColumnState(e.api);
            // Auto-guardar en base de datos si es desarrollador
            if (isDeveloper) handleSaveInterface(e.api);
        }
    };

    const isDeveloper = useMemo(() => {
        const role = user?.role?.toUpperCase() || '';
        return role === 'DEVELOPER' || role === 'PROGRAMADOR';
    }, [user]);


    // --- MEJORA: Determinación de Row ID para mantener estado de la UI (filtros, scroll) ---
    const getRowId = useMemo(() => {
        return (params) => {
            const d = params.data;
            if (!d) return Math.random().toString();
            // Prioridad absoluta a la PK de la tabla actual
            if (d.idcurso) return String(d.idcurso);
            if (d.idacademia) return String(d.idacademia);
            if (d.idfield) return String(d.idfield);
            if (d.idgrid) return String(d.idgrid);
            if (d.idform) return String(d.idform);
            return String(d.id || Math.random());
        };
    }, []);

    const fetchData = React.useCallback(async () => {
        if (gridMeta.gparent && !masterRecord) {
            setData([]);
            setTotalRecords(0);
            return;
        }

        setLoading(true);

        try {
            const params = {
                page: page + 1,
                limit: rowsPerPage,
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

            if (res.data.success) {
                setData(res.data.data);
                setTotalRecords(res.data.meta.total);
            } else {
                setError(res.data.error || 'Error fetching grid data');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [idform, gridMeta.idgrid, gridMeta.gparent, masterRecord, page, rowsPerPage, sortField, sortOrder, gridFilters]);

    useEffect(() => {
        fetchData();
    }, [page, rowsPerPage, sortField, sortOrder, gridFilters, gridMeta.idgrid, masterRecord, sactivateData]);

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
                setEditingRecord({});
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

    const handleSelectionChanged = () => {
        const selectedRows = gridRef.current.api.getSelectedRows();
        const rec = selectedRows.length > 0 ? selectedRows[0] : null;
        setSelectedRecord(rec);

        if (rec) {
            let rowIdx = null;
            gridRef.current.api.forEachNodeAfterFilterAndSort((node, index) => {
                if (node.isSelected()) rowIdx = index;
            });
            setSelectedRowIndex(rowIdx !== null ? page * rowsPerPage + rowIdx + 1 : null);
        } else {
            setSelectedRowIndex(null);
        }

        if (onRowSelect) {
            onRowSelect(gridMeta.idgrid, rec);
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

    const handleFilterChanged = (e) => {
        const filterModel = e.api.getFilterModel();
        setGridFilters(filterModel);
        setPage(0);
    };

    const handleEditSelected = () => {
        if (selectedRecord) {
            setEditingRecord(selectedRecord);
        }
    };

    const closeEdit = () => {
        setEditingRecord(null);
        fetchData();
    };

    const handleDeleteSelected = () => {
        if (!selectedRecord) return;
        setIsDeleting(true);
    };

    const executeDelete = async () => {
        setIsDeleting(false);
        let pkField = Object.keys(selectedRecord).find(k => k.startsWith('id') || k.endsWith('id'));
        if (!pkField) pkField = Object.keys(selectedRecord)[0];
        const id = selectedRecord[pkField];

        try {
            const res = await axios.delete(`/api/dynamic/data/${idform}/${gridMeta.idgrid}/${id}`);
            if (res.data.success) {
                fetchData();
            } else {
                alert('Error al eliminar: ' + res.data.error);
            }
        } catch (error) {
            // Error de red o servidor
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
                    posicion: index + 1
                }))
        };

        try {
            const res = await axios.post('/api/dynamic/save-interface', payload);
            if (res.data.success) {
                // Notificación silenciosa o discreta si es auto-guardado
                console.log('Interfaz guardada automáticamente');
            }
        } catch (err) {
            console.error('Error auto-saving interface:', err);
        }
    };

    const handleCellValueChanged = async (event) => {
        const { data: rowData } = event;

        // Identificar PK
        let pkField = (gridMeta.fields || []).find(f => f.pk === true)?.campo;
        if (!pkField) {
            const pkHierarchy = ['idfield', 'idcontrol', 'idgrid', 'idreport', 'idtable', 'idconsult', 'idfunction', 'idfile', 'iduser', 'idrole', 'idsistema', 'id'];
            pkField = pkHierarchy.find(key => rowData[key] !== undefined) || Object.keys(rowData)[0];
        }

        try {
            await axios.post(`/api/dynamic/data/${idform}/${gridMeta.idgrid}`, {
                data: rowData,
                isUpdate: true,
                recordId: rowData[pkField],
                pkField: pkField
            });
            console.log('Fila guardada automáticamente (inline edit)');
        } catch (error) {
            console.error('Error en auto-guardado inline:', error);
        }
    };

    if (error) return <Alert severity="error">{error}</Alert>;

    if (editingRecord) {
        return (
            <DynamicForm
                gridMeta={gridMeta}
                idform={idform}
                record={editingRecord}
                onClose={closeEdit}
                allGrids={allGrids}
                readonlyMode={readonlyMode}
                uiStyles={uiStyles}
            />
        );
    }

    return (
        <Paper
            elevation={gridMeta.gparent ? 0 : 3}
            className={gridMeta.mayusculas ? 'force-uppercase' : ''}
            sx={{
                width: '100%',
                height: gridMeta.gparent ? '500px' : '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: gridMeta.gparent ? 0 : undefined,
                border: gridMeta.gparent ? 'none' : undefined
            }}
        >
            {/* Área de Cabecera Personalizada (Metadata) */}
            {gridMeta.cabecera && (
                <Box
                    sx={{ p: 1, borderBottom: '1px solid #eee' }}
                    dangerouslySetInnerHTML={{ __html: gridMeta.cabecera }}
                />
            )}

            {/* Header: Titulo y Botones (Oculto en simplified) */}
            {!simplified && (
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
                                    onClick={() => setEditingRecord({})}
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

                            {!readonlyMode && (
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
                                    <MenuItem onClick={() => handleSaveInterface()}>
                                        <SaveIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                                        Guardar interfaz
                                    </MenuItem>
                                )}
                            </Menu>
                        </Box>
                    )}
                </Box>
            )}

            <Box
                onContextMenu={handleContextMenu}
                sx={{ flexGrow: 1, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}
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
                        <MenuItem onClick={() => { setEditingRecord({}); handleCloseContextMenu(); }}>
                            <AddIcon fontSize="small" sx={{ mr: 1 }} /> Agregar (F2)
                        </MenuItem>
                    )}
                    {selectedRecord && !readonlyMode && (
                        <MenuItem onClick={() => { handleEditSelected(); handleCloseContextMenu(); }}>
                            <EditIcon fontSize="small" sx={{ mr: 1 }} /> Editar
                        </MenuItem>
                    )}
                    {selectedRecord && !readonlyMode && (
                        <MenuItem onClick={() => { handleDeleteSelected(); handleCloseContextMenu(); }}>
                            <DeleteIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} /> Eliminar (Ctrl+Supr)
                        </MenuItem>
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
                <Box sx={{ flexGrow: 1, width: '100%' }}>
                    <AgGridReact
                        ref={gridRef}
                        theme={myTheme}
                        rowData={data}
                        columnDefs={columnDefs}
                        getRowId={getRowId}
                        rowSelection="single"
                        suppressRowClickSelection={false}
                        onSelectionChanged={handleSelectionChanged}
                        onRowClicked={(params) => {
                            // Forzar selección en caso de que el evento estándar de AG Grid sea bloqueado por el contenedor
                            if (params.node && !params.node.isSelected()) {
                                params.node.setSelected(true);
                            }
                        }}
                        onSortChanged={handleSortChanged}
                        onFilterChanged={handleFilterChanged}
                        onColumnResized={handleColumnResized}
                        onColumnMoved={handleColumnMoved}
                        onCellValueChanged={handleCellValueChanged}
                        stopEditingWhenCellsLoseFocus={true}
                        onCellKeyDown={(params) => {
                            const { event, rowIndex, api, column } = params;
                            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                if (api.getEditingCells().length > 0) {
                                    api.stopEditing();

                                    // Calcular siguiente fila
                                    const nextIndex = event.key === 'ArrowDown' ? rowIndex + 1 : rowIndex - 1;
                                    const rowCount = api.getDisplayedRowCount();

                                    if (nextIndex >= 0 && nextIndex < rowCount) {
                                        // Dar un pequeño tiempo para que el Grid procese el cierre de la edición
                                        setTimeout(() => {
                                            api.setFocusedCell(nextIndex, column.getColId());
                                            const node = api.getDisplayedRowAtIndex(nextIndex);
                                            if (node) node.setSelected(true);
                                        }, 50);
                                    }
                                }
                            }
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

                                // Seleccionar la fila al navegar con flechas del teclado
                                if (e.rowIndex !== null) {
                                    const rowNode = e.api.getDisplayedRowAtIndex(e.rowIndex);
                                    if (rowNode && !rowNode.isSelected()) {
                                        rowNode.setSelected(true);
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
                        defaultColDef={{
                            sortable: true,
                            filter: !simplified,
                            floatingFilter: !simplified,
                            resizable: !simplified,
                            unSortIcon: false,
                            suppressHeaderMenuButton: simplified,
                            filterParams: {
                                buttons: ['clear'],
                                debounceMs: 500,
                                closeOnApply: false
                            }
                        }}
                    />
                </Box>
            </Box>

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
                }}>
                    <Typography sx={{ fontSize: '0.82rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                        {focusedHelpText}
                    </Typography>
                </Box>
            )}

            {/* Área de Pie Personalizada (Metadata) */}
            {gridMeta.pie && (
                <Box
                    sx={{ p: 1, borderTop: '1px solid #eee' }}
                    dangerouslySetInnerHTML={{ __html: gridMeta.pie }}
                />
            )}

            {/* Paginador personalizado */}
            {!simplified && (
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
                        message="¿Estás seguro de que deseas eliminar el registro seleccionado? Esta acción no se puede deshacer."
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
                </>
            )}
        </Paper>
    );
};

export default DynamicGrid;
