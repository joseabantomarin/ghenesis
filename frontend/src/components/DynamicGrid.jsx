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

const DynamicGrid = ({ gridMeta, idform, masterRecord, onRowSelect, allGrids, sactivateData, readonlyMode }) => {
    const gridRef = useRef();
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
    // Usamos gridMeta.idgrid como dependencia principal para asegurar estabilidad
    const columnDefs = useMemo(() => {
        // Incluimos campos ocultos si tienen "cabeza", para que actúen como columnas expandibles
        const fields = (gridMeta.fields || [])
            .filter(f => !f.oculto || (f.cabeza && f.cabeza.trim() !== ''))
            .sort((a, b) => a.posicion - b.posicion);

        let savedState = {};
        try {
            const stored = localStorage.getItem(`grid-col-state-${gridMeta.idgrid}`);
            if (stored) savedState = JSON.parse(stored);
        } catch (e) { }

        // Si hay estado guardado, respetar el orden de las columnas del usuario
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
                cellRenderer: f.tipod === 'B' ? 'agCheckboxCellRenderer' : undefined,
                cellStyle: {
                    textAlign: f.alinear === 'D' ? 'right' : f.alinear === 'C' ? 'center' : 'left',
                    backgroundColor: f.color || undefined,
                    color: f.fontcolor || undefined,
                    fontWeight: f.fontbold ? 'bold' : 'normal'
                }
            };

            if (f.cabeza && f.cabeza.trim() !== '') {
                // Si la columna tiene "cabeza", agruparla
                // Lógica Ghenesis: los campos marcados como 'oculto' dentro de un grupo 
                // se consideran columnas de "detalle" (solo se ven al expandir)
                if (f.oculto) {
                    colDef.columnGroupShow = 'open';
                }

                if (currentGroup && currentGroup.headerName === f.cabeza) {
                    currentGroup.children.push(colDef);
                } else {
                    currentGroup = {
                        headerName: f.cabeza,
                        children: [colDef],
                        marryChildren: false, // Permitir que se expandan/colapsen
                        openByDefault: false   // Empezar colapsado
                    };
                    defs.push(currentGroup);
                }
            } else {
                currentGroup = null;
                defs.push(colDef);
            }
        });

        return defs;
    }, [gridMeta.idgrid, gridMeta.fields]);

    const hasGroups = useMemo(() => {
        return (gridMeta.fields || []).some(f => f.cabeza && f.cabeza.trim() !== '');
    }, [gridMeta.fields]);

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


    // --- MEJORA: Determinación de Row ID para mantener estado de la UI (filtros, scroll) ---
    const getRowId = useMemo(() => {
        return (params) => {
            const d = params.data;
            const pkHierarchy = [
                'idfield', 'idcontrol', 'idgrid', 'idreport', 'idtable', 'idconsult', 'idfunction', 'idfile',
                'iduser', 'idrole', 'idacademia', 'idcurso', 'idform', 'idsistema', 'id'
            ];
            const bestPk = pkHierarchy.find(key => d[key] !== undefined) || Object.keys(d)[0];
            return String(d[bestPk] || Math.random());
        };
    }, []);

    const fetchData = async () => {
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
                // Determinar el campo de enlace (Foreign Key) en la grilla detallle.
                // Por convención, usamos el nombre de la PK del registro maestro.
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
    };

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
        setConfirmOpen(true);
    };

    const executeDelete = async () => {
        setConfirmOpen(false);
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
            console.error('Error deleting record', error);
            alert('Ocurrió un error al intentar eliminar el registro.');
        }
    };

    const handleExportXlsx = async () => {
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
            />
        );
    }

    return (
        <Paper elevation={3} sx={{ width: '100%', height: gridMeta.gparent ? '500px' : '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header: Titulo y Botones */}
            <Box sx={{
                pl: { xs: 1.5, sm: 1 },
                pr: { xs: 0, sm: 1 },
                py: { xs: 1, sm: 1.2 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                borderBottom: 1,
                borderColor: 'divider',
                gap: { xs: 1, sm: 0 }
            }}>
                <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' }, pr: { sm: 2 } }}>
                    <Typography noWrap sx={{ fontWeight: 'bold', fontSize: { xs: '0.9rem', sm: '1.05rem' }, color: 'var(--active-tab-color)', m: 0 }}>
                        {gridMeta.titulo}
                    </Typography>
                </Box>
                {/* Barra de Herramientas Principal */}
                {!gridMeta.ocultabar && (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0, width: { xs: '100%', sm: 'auto' }, overflowX: 'auto', pb: { xs: 0.5, sm: 0 }, '&::-webkit-scrollbar': { display: 'none' } }}>
                        {!readonlyMode && (
                            <Button
                                variant="outlined" color="success"
                                onClick={() => setEditingRecord({})}
                                startIcon={isMobile ? null : <AddIcon />}
                                sx={{ borderRadius: '8px', textTransform: 'none', px: isMobile ? 1 : 2, py: 0.75, minWidth: isMobile ? 40 : 'auto', fontWeight: 600 }}
                            >
                                {isMobile ? <AddIcon /> : "Nuevo"}
                            </Button>
                        )}

                        <Button
                            variant="outlined" color="primary"
                            disabled={!selectedRecord || gridMeta.readonlyg}
                            onClick={handleEditSelected}
                            startIcon={isMobile ? null : <EditIcon />}
                            sx={{ borderRadius: '8px', textTransform: 'none', px: isMobile ? 1 : 2, py: 0.75, minWidth: isMobile ? 40 : 'auto', fontWeight: 600 }}
                        >
                            {isMobile ? <EditIcon /> : "Editar"}
                        </Button>

                        {!readonlyMode && (
                            <Button
                                variant="outlined" color="error" disableFocusRipple
                                disabled={!selectedRecord || gridMeta.readonlyg}
                                onClick={handleDeleteSelected}
                                startIcon={isMobile ? null : <DeleteIcon />}
                                sx={{ borderRadius: '8px', textTransform: 'none', px: isMobile ? 1 : 2, py: 0.75, minWidth: isMobile ? 40 : 'auto', fontWeight: 600 }}
                            >
                                {isMobile ? <DeleteIcon /> : "Borrar"}
                            </Button>
                        )}

                        <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', height: 28, mx: 0.5 }}></Box>

                        <IconButton onClick={() => fetchData()} color="default" sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38 }}>
                            <RefreshIcon />
                        </IconButton>

                        <IconButton color="info" onClick={handleExportXlsx} sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38 }}>
                            <DownloadIcon />
                        </IconButton>

                        <Tooltip title="Más opciones">
                            <IconButton color="default" onClick={handleMenuClick} sx={{ borderRadius: '8px', border: '1px solid', borderColor: 'divider', width: 38, height: 38 }}>
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
                        </Menu>
                    </Box>
                )}
            </Box>

            <Box sx={{ flexGrow: 1, width: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
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
                        rowSelection={{ mode: 'singleRow', checkboxes: false }}
                        onSelectionChanged={handleSelectionChanged}
                        onSortChanged={handleSortChanged}
                        onFilterChanged={handleFilterChanged}
                        onColumnResized={handleColumnResized}
                        onColumnMoved={handleColumnMoved}
                        onCellFocused={(e) => {
                            if (e.column) {
                                const colId = e.column.getColId();
                                const fieldMeta = (gridMeta.fields || []).find(f => f.campo === colId);
                                if (fieldMeta) setFocusedHelpText(fieldMeta.ayuda || fieldMeta.titlefield || colId);
                            }
                        }}
                        onCellClicked={(e) => {
                            // Seleccionar fila al hacer clic para activar botones (Editar, Borrar)
                            if (e.node && !e.node.isSelected()) {
                                e.node.setSelected(true, true);
                            }
                        }}
                        enableBrowserTooltips={false}
                        tooltipShowDelay={0}
                        animateRows={false}
                        rowHeight={gridMeta.altofila || 36}
                        headerHeight={38}
                        groupHeaderHeight={hasGroups ? 38 : 0}
                        floatingFiltersHeight={38}
                        defaultColDef={{
                            sortable: true,
                            filter: true,
                            floatingFilter: true,
                            resizable: true,
                            unSortIcon: true,
                            suppressMenuHide: true,
                            filterParams: {
                                buttons: ['clear'], // Solo 'clear' para permitir búsqueda reactiva sin botón 'apply'
                                debounceMs: 500,    // Espera 500ms tras dejar de escribir para filtrar automáticamente
                                closeOnApply: false
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
