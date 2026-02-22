import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Paper, TextField, CircularProgress, Alert, Button, Box, Typography,
    IconButton, Tooltip, Menu, MenuItem, useTheme, useMediaQuery
} from '@mui/material';
import {
    Add as AddIcon, Edit as EditIcon, Print as PrintIcon, MoreVert as MoreVertIcon,
    Delete as DeleteIcon, FileDownload as DownloadIcon, Refresh as RefreshIcon,
    FirstPage as FirstPageIcon, NavigateBefore as NavigateBeforeIcon,
    NavigateNext as NavigateNextIcon, LastPage as LastPageIcon
} from '@mui/icons-material';
import axios from 'axios';
import * as XLSX from 'xlsx';
import DynamicForm from './DynamicForm';
import ConfirmDialog from './ConfirmDialog';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';

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

    // Variables nativas para forzar Checkbox: Borde primary, tick primary, interior blanco (sin relleno sólido)
    accentColor: 'var(--primary-color)',
    checkboxBorderWidth: 2,
    checkboxCheckedShape: 'tick',

    // Oculta el fondo redondo gris-celeste de hover en la cabecera
    iconButtonHoverBackgroundColor: 'transparent'
});

const DynamicGrid = ({ gridMeta, idform, masterRecord, onRowSelect, allGrids, sactivateData }) => {
    const gridRef = useRef();
    const activeFilterColRef = useRef(null);
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
    const [confirmOpen, setConfirmOpen] = useState(false);
    const openMenu = Boolean(anchorEl);
    const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // Mapear Columnas de Ghenesis a AG-Grid
    const columnDefs = useMemo(() => {
        const fields = (gridMeta.fields || [])
            .filter(f => !f.oculto)
            .sort((a, b) => a.posicion - b.posicion);

        // Restaurar estado guardado (orden + anchos)
        let savedState = {}; // { campo: { width, index } }
        try {
            const stored = localStorage.getItem(`grid-col-state-${gridMeta.idgrid}`);
            if (stored) savedState = JSON.parse(stored);
        } catch (e) { }

        let defs = fields.map(f => ({
            field: f.campo,
            headerName: f.titlefield || f.campo,
            initialWidth: savedState[f.campo]?.width || f.ancho || 150,
            minWidth: f.ancho || undefined,
            wrapText: true,
            autoHeight: true,
            wrapHeaderText: false,
            autoHeaderHeight: false,
            headerTooltip: f.titlefield || f.campo,
            tooltipField: f.campo,
            cellRenderer: f.tipod === 'B' ? 'agCheckboxCellRenderer' : undefined,
            cellStyle: {
                textAlign: f.alinear === 'D' ? 'right' : f.alinear === 'C' ? 'center' : 'left',
                backgroundColor: f.color || undefined,
                color: f.fontcolor || undefined,
                fontWeight: f.fontbold ? 'bold' : 'normal'
            },
            valueFormatter: f.tipod !== 'B' ? (params) => {
                return params.value;
            } : undefined
        }));

        // Reordenar según el orden guardado
        if (Object.keys(savedState).length > 0) {
            defs.sort((a, b) => {
                const ia = savedState[a.field]?.index ?? 999;
                const ib = savedState[b.field]?.index ?? 999;
                return ia - ib;
            });
        }

        return defs;
    }, [gridMeta]);

    // Guardar estado completo de columnas (orden + anchos)
    const saveColumnState = (api) => {
        const allCols = api.getColumnState();
        const state = {};
        allCols.forEach((c, i) => { state[c.colId] = { width: c.width, index: i }; });
        localStorage.setItem(`grid-col-state-${gridMeta.idgrid}`, JSON.stringify(state));
    };

    const handleColumnResized = (e) => {
        if (e.finished && e.source === 'uiColumnResized') saveColumnState(e.api);
    };

    const handleColumnMoved = (e) => {
        if (e.finished) saveColumnState(e.api);
    };

    const fetchData = async () => {
        // Pausar fetch si es grilla hija pero no se le ha pasado el registro padre
        if (gridMeta.gparent && !masterRecord) {
            setData([]);
            setTotalRecords(0);
            return;
        }

        setLoading(true);
        setSelectedRecord(null); // Reset selection on reload/page change

        // --- INTERCEPTOR SACTIVATE ---
        const inyectedData = sactivateData?.[gridMeta.vquery] || (sactivateData?.gridData && !gridMeta.gparent ? sactivateData.gridData : null);

        // Si el controlador en backend delegó todo y no hay orden ni filtro nativo, usamos el cache local
        // ATENCIÓN: Solo usamos el caché inyectado genérico si NO somos una grilla hija
        if (inyectedData && Array.isArray(inyectedData) && !sortField && !gridFilters) {
            let processedData = [...inyectedData];

            const startIndex = page * rowsPerPage;
            const pagedData = processedData.slice(startIndex, startIndex + rowsPerPage);

            setData(pagedData);
            setTotalRecords(processedData.length);
            setLoading(false);
            return;
        }
        // -----------------------------
        try {
            // El backend espera page (1-based), limit y filtros dinámicos
            const params = {
                page: page + 1,
                limit: rowsPerPage,
                ...(sortField && { sortField, sortOrder }),
                ...(gridFilters && { filters: JSON.stringify(gridFilters) })
            };

            // Inyectamos las variables relacionales para el SQL WHERE
            if (gridMeta.gparent && masterRecord) {
                // Si existe fieldgroup se manda al backend, si no, se manda una cadena vacía
                params.masterField = gridMeta.fieldgroup || '';

                let mValue;

                // Intentamos extraer el valor usando el fieldgroup exacto si existe
                if (gridMeta.fieldgroup) {
                    mValue = masterRecord[gridMeta.fieldgroup];

                    // Fallback 1: Buscar versión en minúsculas (a veces PostgreSQL devuelve columnas en minúsculas)
                    if (mValue === undefined) {
                        mValue = masterRecord[gridMeta.fieldgroup.toLowerCase()];
                    }
                }

                // Fallback 2: Buscar cualquier llave principal candidata si fieldgroup es nulo o falló
                if (mValue === undefined) {
                    const pkHierarchy = ['idf', 'idgrid', 'idform', 'idcontrol', 'idreport', 'idtable', 'idconsult', 'idfunction', 'idfile', 'idsistema', 'id'];
                    const bestPk = pkHierarchy.find(key => masterRecord[key] !== undefined);
                    if (bestPk) mValue = masterRecord[bestPk];
                }

                // Fallback 3: Si todo falla, coger el primer valor del registro (usualmente el ID)
                if (mValue === undefined && Object.keys(masterRecord).length > 0) {
                    mValue = masterRecord[Object.keys(masterRecord)[0]];
                }

                params.masterValue = mValue;

                // Transferir absolutamente todo el registro padre convertido a JSON 
                // para que cualquier script (sopen, etc) pueda acceder a cualquiera de sus variables.
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
    };

    // Fetch ÚNICO: Reacciona a cambios reales en la paginación, orden, filtros o registros padre
    useEffect(() => {
        fetchData();
    }, [page, rowsPerPage, sortField, sortOrder, gridFilters, gridMeta.idgrid, masterRecord, sactivateData]);

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

        // Calcular índice absoluto de la fila seleccionada (página + posición en grilla)
        if (rec) {
            let rowIdx = null;
            gridRef.current.api.forEachNodeAfterFilterAndSort((node, index) => {
                if (node.isSelected()) rowIdx = index;
            });
            setSelectedRowIndex(rowIdx !== null ? page * rowsPerPage + rowIdx + 1 : null);
        } else {
            setSelectedRowIndex(null);
        }

        // Disparar evento al padre DynamicView (Master-Detail orchestration)
        if (onRowSelect) {
            onRowSelect(gridMeta.idgrid, rec);
        }
    };

    const handleSortChanged = (e) => {
        // En AG Grid las versiones nuevas usan getColumnState en lugar de getSortModel
        const sortState = e.api.getColumnState().find(s => s.sort != null);
        if (sortState) {
            setSortField(sortState.colId);
            setSortOrder(sortState.sort); // 'asc' o 'desc'
        } else {
            setSortField(null);
            setSortOrder(null);
        }
        setPage(0); // Regresar a la primera página al ordenar
    };

    const handleFilterChanged = (e) => {
        const filterModel = e.api.getFilterModel();
        const activeFilterCols = Object.keys(filterModel);
        if (activeFilterCols.length > 0) {
            activeFilterColRef.current = activeFilterCols[activeFilterCols.length - 1];
            setGridFilters(filterModel);
        } else {
            // No limpiar activeFilterColRef — onRowDataUpdated lo reabrirá
            setGridFilters(null);
        }
        setPage(0);
    };

    const handleEditSelected = () => {
        if (selectedRecord) {
            setEditingRecord(selectedRecord);
        }
    };

    const closeEdit = () => {
        setEditingRecord(null);
        fetchData(); // Refrescar en caso haya guardado
    };

    const handleDeleteSelected = () => {
        if (!selectedRecord) return;
        setConfirmOpen(true);
    };

    const executeDelete = async () => {
        setConfirmOpen(false);

        // Intentar detectar la Primary Key
        let pkField = Object.keys(selectedRecord).find(k => k.startsWith('id') || k.endsWith('id'));
        if (!pkField) pkField = Object.keys(selectedRecord)[0]; // Fallback

        const id = selectedRecord[pkField];

        try {
            const res = await axios.delete(`/api/dynamic/data/${idform}/${gridMeta.idgrid}/${id}`);
            if (res.data.success) {
                fetchData(); // Recargar grilla
            } else {
                alert('Error al eliminar: ' + res.data.error);
            }
        } catch (error) {
            console.error('Error deleting record', error);
            alert('Ocurrió un error al intentar eliminar el registro.');
        }
    };

    const handleExportXlsx = async () => {
        if (!gridRef.current) return;

        // Obtener las columnas visibles (respetando el orden actual)
        const cols = gridRef.current.api.getColumnDefs();
        const headers = cols.map(c => c.headerName || c.field);
        const fields = cols.map(c => c.field);

        try {
            // Pedir TODOS los registros al backend (limit=0 = sin paginación)
            // respetando el orden y filtros actuales
            const params = {
                page: 1,
                limit: 0,
                ...(sortField && { sortField, sortOrder }),
                ...(gridFilters && { filters: JSON.stringify(gridFilters) })
            };

            // Inyectar parámetros master-detail si aplica
            if (gridMeta.gparent && masterRecord) {
                params.masterField = gridMeta.fieldgroup || '';
                let mValue;
                if (gridMeta.fieldgroup) {
                    mValue = masterRecord[gridMeta.fieldgroup]
                        ?? masterRecord[gridMeta.fieldgroup.toLowerCase()];
                }
                if (mValue === undefined) {
                    const pkHierarchy = ['idf', 'idgrid', 'idform', 'idcontrol', 'idreport', 'idtable', 'idconsult', 'idfunction', 'idfile', 'idsistema', 'id'];
                    const bestPk = pkHierarchy.find(key => masterRecord[key] !== undefined);
                    if (bestPk) mValue = masterRecord[bestPk];
                }
                if (mValue === undefined && Object.keys(masterRecord).length > 0) {
                    mValue = masterRecord[Object.keys(masterRecord)[0]];
                }
                params.masterValue = mValue;
                params.masterRecordPayload = JSON.stringify(masterRecord);
            }

            const res = await axios.get(`/api/dynamic/data/${idform}/${gridMeta.idgrid}`, { params });

            if (!res.data.success) {
                alert('Error al exportar: ' + (res.data.error || 'Error desconocido'));
                return;
            }

            // Construir filas a partir de la respuesta completa del servidor
            const allData = res.data.data || [];
            const rows = allData.map(record => fields.map(f => record[f] ?? ''));

            // Construir hoja Excel
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

    if (error) return <Alert severity="error">{error}</Alert>;

    // Si estamos en modo edición, renderizamos el DynamicForm
    if (editingRecord) {
        return (
            <DynamicForm
                gridMeta={gridMeta}
                idform={idform}
                record={editingRecord}
                onClose={closeEdit}
                allGrids={allGrids}
            />
        );
    }

    return (
        <Paper elevation={3} sx={{ width: '100%', height: gridMeta.gparent ? '500px' : '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header: Titulo y Botones */}
            <Box sx={{
                pl: { xs: 1.5, sm: 1 },
                pr: { xs: 0, sm: 1 },
                py: { xs: 1.5, sm: 2 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                borderBottom: 1,
                borderColor: 'divider',
                gap: { xs: 1, sm: 0 }
            }}>
                <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' }, pr: { sm: 2 } }}>
                    <Typography noWrap sx={{ fontWeight: 'bold', fontSize: { xs: '1rem', sm: '1.2rem' }, color: 'var(--active-tab-color)', m: 0 }}>
                        {gridMeta.titulo}
                    </Typography>
                </Box>
                {/* Barra de Herramientas Principal */}
                {!gridMeta.ocultabar && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0, width: { xs: '100%', sm: 'auto' }, overflowX: 'auto', pb: { xs: 0.5, sm: 0 }, '&::-webkit-scrollbar': { display: 'none' } }}>
                        <Button
                            variant="outlined"
                            color="success"
                            onClick={() => setEditingRecord({})}
                            startIcon={isMobile ? null : <AddIcon />}
                            sx={{ borderRadius: '8px', textTransform: 'none', px: isMobile ? 1 : 2, py: 0.75, minWidth: isMobile ? 40 : 'auto', fontWeight: 600 }}
                        >
                            {isMobile ? <AddIcon /> : "Nuevo"}
                        </Button>

                        <Button
                            variant="outlined"
                            color="primary"
                            disabled={!selectedRecord || gridMeta.readonlyg}
                            onClick={handleEditSelected}
                            startIcon={isMobile ? null : <EditIcon />}
                            sx={{ borderRadius: '8px', textTransform: 'none', px: isMobile ? 1 : 2, py: 0.75, minWidth: isMobile ? 40 : 'auto', fontWeight: 600 }}
                        >
                            {isMobile ? <EditIcon /> : "Editar"}
                        </Button>

                        <Button
                            variant="outlined"
                            color="error"
                            disableFocusRipple
                            disabled={!selectedRecord || gridMeta.readonlyg}
                            onClick={handleDeleteSelected}
                            startIcon={isMobile ? null : <DeleteIcon />}
                            sx={{ borderRadius: '8px', textTransform: 'none', px: isMobile ? 1 : 2, py: 0.75, minWidth: isMobile ? 40 : 'auto', fontWeight: 600 }}
                        >
                            {isMobile ? <DeleteIcon /> : "Borrar"}
                        </Button>

                        {/* Divisor vertical */}
                        <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', height: 28, mx: 0.5 }}></Box>

                        <IconButton
                            onClick={fetchData}
                            color="default"
                            sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38 }}
                        >
                            <RefreshIcon />
                        </IconButton>

                        <IconButton
                            color="info"
                            onClick={handleExportXlsx}
                            sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38 }}
                        >
                            <DownloadIcon />
                        </IconButton>

                        {/* Menú Desplegable Adicional (Reportes / Más) */}
                        <Tooltip title="Más opciones">
                            <IconButton
                                color="default"
                                onClick={handleMenuClick}
                                sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38 }}
                            >
                                <MoreVertIcon />
                            </IconButton>
                        </Tooltip>

                        <Menu
                            anchorEl={anchorEl}
                            open={openMenu}
                            onClose={handleMenuClose}
                            PaperProps={{
                                elevation: 3,
                                sx: { mt: 1.5, minWidth: 150 }
                            }}
                            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        >
                            <MenuItem onClick={() => { handlePrint(); handleMenuClose(); }}>
                                <PrintIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                                Reporte Principal
                            </MenuItem>
                        </Menu>
                    </Box>
                )}
            </Box>

            <Box sx={{ flexGrow: 1, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {loading && (
                    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
                        <CircularProgress />
                    </Box>
                )}
                {/* Tema AG Grid "Quartz" inyectado vía Theming API (V35+) */}
                <Box sx={{ flexGrow: 1, height: '100%', width: '100%' }}>
                    <AgGridReact
                        ref={gridRef}
                        theme={myTheme}
                        rowData={data}
                        columnDefs={columnDefs}
                        rowSelection={{ mode: 'singleRow', checkboxes: false }}
                        onSelectionChanged={handleSelectionChanged}
                        onSortChanged={handleSortChanged}
                        onFilterChanged={handleFilterChanged}
                        onColumnResized={handleColumnResized}
                        onColumnMoved={handleColumnMoved}
                        onRowDataUpdated={() => {
                            // Re-abrir popup de filtro
                            if (activeFilterColRef.current) {
                                const colId = activeFilterColRef.current;
                                try { gridRef.current?.api?.showColumnFilter(colId); } catch (e) { }
                            }
                        }}
                        onCellFocused={(e) => {
                            if (e.rowIndex !== null && e.api) {
                                const rowNode = e.api.getDisplayedRowAtIndex(e.rowIndex);
                                if (rowNode && !rowNode.isSelected()) {
                                    rowNode.setSelected(true, true);
                                }
                            }
                            // Actualizar texto de ayuda según la columna enfocada
                            if (e.column) {
                                const colId = e.column.getColId();
                                const fieldMeta = (gridMeta.fields || []).find(f => f.campo === colId);
                                if (fieldMeta) {
                                    setFocusedHelpText(fieldMeta.ayuda || fieldMeta.titlefield || colId);
                                }
                            }
                        }}
                        enableBrowserTooltips={true} // Obligatorio para que emerja el hint nativo del navegador
                        animateRows={false} // CRÍTICO: Desactivamos la animación de filas
                        rowHeight={gridMeta.altofila || 40} // Altura base predeterminada
                        headerHeight={45}
                        // Las columnas gestionarán la UI de sort pero NO lo harán en el cliente
                        defaultColDef={{
                            sortable: true,
                            filter: true,
                            resizable: true,
                            unSortIcon: true, // Mostrar siempre el icono para invitar a hacer click
                            filterParams: {
                                debounceMs: 300,       // Esperar 300ms después de escribir antes de filtrar
                                closeOnApply: false     // No cerrar el popup al filtrar, solo al hacer click afuera
                            }
                        }}
                    />
                </Box>
            </Box>

            {/* Barra de Ayuda del Campo Enfocado */}
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

            {/* Custom Paginator as requested in Fig 2 */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.5, sm: 1 },
                pl: { xs: 1.5, sm: 1 },
                pr: { xs: 0, sm: 1 },
                py: { xs: 1, sm: 2 },
                borderTop: '1px solid',
                borderColor: 'divider',
                flexWrap: 'nowrap',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                '&::-webkit-scrollbar': { height: '4px' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: '#ccc', borderRadius: '4px' }
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                    <Box component="span" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>RxP:</Box>
                    <TextField
                        select
                        size="small"
                        value={rowsPerPage}
                        onChange={handleChangeRowsPerPage}
                        sx={{
                            minWidth: 65,
                            width: 65,
                            '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: '#f4f6f8' },
                            '& .MuiSelect-select': { py: 0.5, pl: 1, pr: 2 }
                        }}
                    >
                        {[10, 25, 50, 100].map(val => <MenuItem key={val} value={val}>{val}</MenuItem>)}
                    </TextField>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: { xs: 0.5, sm: 2 } }}>
                    <Button variant="outlined" sx={{ minWidth: 36, width: 36, p: 0.5, borderRadius: '8px', borderColor: '#ccc', color: '#555' }} disabled={page === 0} onClick={() => setPage(0)}><FirstPageIcon fontSize="small" /></Button>
                    <Button variant="outlined" sx={{ minWidth: 36, width: 36, p: 0.5, borderRadius: '8px', borderColor: '#ccc', color: '#555' }} disabled={page === 0} onClick={() => setPage(page - 1)}><NavigateBeforeIcon fontSize="small" /></Button>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, ml: { xs: 0.5, sm: 1 } }}>
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

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: { xs: 0.5, sm: 1 } }}>
                    <Button variant="outlined" sx={{ minWidth: 36, width: 36, p: 0.5, borderRadius: '8px', borderColor: '#ccc', color: '#555' }} disabled={page >= (Math.ceil(totalRecords / rowsPerPage) - 1)} onClick={() => setPage(page + 1)}><NavigateNextIcon fontSize="small" /></Button>
                    <Button variant="outlined" sx={{ minWidth: 36, width: 36, p: 0.5, borderRadius: '8px', borderColor: '#ccc', color: '#555' }} disabled={page >= (Math.ceil(totalRecords / rowsPerPage) - 1)} onClick={() => setPage(Math.ceil(totalRecords / rowsPerPage) - 1)}><LastPageIcon fontSize="small" /></Button>
                </Box>

                <Box component="span" sx={{ ml: { xs: 0.5, sm: 2 }, fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>
                    Reg. {selectedRowIndex !== null ? selectedRowIndex : (totalRecords > 0 ? (page * rowsPerPage + 1) : 0)} de {totalRecords}
                </Box>
            </Box>
            {/* Diálogo de Confirmación para Eliminar */}
            <ConfirmDialog
                open={confirmOpen}
                title="Eliminar registro"
                message="¿Estás seguro de que deseas eliminar el registro seleccionado? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
                onConfirm={executeDelete}
                onCancel={() => setConfirmOpen(false)}
            />
        </Paper >
    );
};

export default DynamicGrid;
