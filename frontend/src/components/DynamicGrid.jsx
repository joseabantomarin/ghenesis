import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Paper, TablePagination, CircularProgress, Alert, Button, Box,
    IconButton, Tooltip, Menu, MenuItem
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Print as PrintIcon, MoreVert as MoreVertIcon, Delete as DeleteIcon, FileDownload as DownloadIcon } from '@mui/icons-material';
import axios from 'axios';
import DynamicForm from './DynamicForm';
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
    const [editingRecord, setEditingRecord] = useState(null);

    // Estado para Menú de Reportes (Móvil/Desplegable)
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);
    const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // Mapear Columnas de Ghenesis a AG-Grid
    const columnDefs = useMemo(() => {
        const fields = (gridMeta.fields || [])
            .filter(f => !f.oculto)
            .sort((a, b) => a.posicion - b.posicion);

        return fields.map(f => ({
            field: f.campo,
            headerName: f.titlefield || f.campo,
            width: f.ancho || 150,
            minWidth: f.ancho || undefined,
            wrapText: true,           // Habilitar salto de línea en celdas
            autoHeight: true,         // Que la celda crezca según el texto
            wrapHeaderText: true,     // Salto de línea en los títulos
            autoHeaderHeight: true,   // El cabezal crece si el título es largo
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
    }, [gridMeta]);

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
        // Obtenemos todos los filtros activos de las cabeceras
        const filterModel = e.api.getFilterModel();
        if (Object.keys(filterModel).length > 0) {
            setGridFilters(filterModel);
        } else {
            setGridFilters(null);
        }
        setPage(0); // Regresar a la primera página al filtrar
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

    const handleDeleteSelected = async () => {
        if (!selectedRecord) return;
        if (!window.confirm(`¿Estás seguro de eliminar el registro seleccionado?`)) return;

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

    const handleExportCsv = () => {
        if (gridRef.current) {
            gridRef.current.api.exportDataAsCsv({
                fileName: `${gridMeta.titulo || 'Exportacion'}.csv`
            });
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
        <Paper elevation={3} sx={{ width: '100%', display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
                <Box>
                    <Box component="span" sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--active-tab-color)' }}>
                        {gridMeta.titulo}
                    </Box>
                </Box>
                {/* Barra de Herramientas Principal */}
                {!gridMeta.ocultabar && (
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Tooltip title="Nuevo Registro">
                            <IconButton color="success" onClick={() => setEditingRecord({})} size="small" sx={{ bgcolor: 'rgba(46, 125, 50, 0.1)' }}>
                                <AddIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Editar Seleccionado">
                            <span>
                                <IconButton
                                    color="primary"
                                    disabled={!selectedRecord || gridMeta.readonlyg}
                                    onClick={handleEditSelected}
                                    size="small"
                                    sx={{ bgcolor: 'rgba(25, 118, 210, 0.1)' }}
                                >
                                    <EditIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title="Eliminar Seleccionado">
                            <span>
                                <IconButton
                                    color="error"
                                    disabled={!selectedRecord || gridMeta.readonlyg}
                                    onClick={handleDeleteSelected}
                                    size="small"
                                    sx={{ bgcolor: 'rgba(211, 47, 47, 0.1)' }}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title="Exportar Excel (CSV)">
                            <IconButton color="info" onClick={handleExportCsv} size="small" sx={{ bgcolor: 'rgba(2, 136, 209, 0.1)' }}>
                                <DownloadIcon />
                            </IconButton>
                        </Tooltip>

                        {/* Menú Desplegable Adicional (Reportes / Más) */}
                        <Tooltip title="Más opciones">
                            <IconButton color="default" onClick={handleMenuClick} size="small">
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
                <div style={{ height: 400, width: '100%' }}>
                    <AgGridReact
                        ref={gridRef}
                        theme={myTheme}
                        rowData={data}
                        columnDefs={columnDefs}
                        rowSelection="single"
                        onSelectionChanged={handleSelectionChanged}
                        onSortChanged={handleSortChanged}
                        onFilterChanged={handleFilterChanged}
                        onCellFocused={(e) => {
                            if (e.rowIndex !== null && e.api) {
                                const rowNode = e.api.getDisplayedRowAtIndex(e.rowIndex);
                                if (rowNode && !rowNode.isSelected()) {
                                    rowNode.setSelected(true, true); // true = limpiar select previous, true = disparar eventos
                                }
                            }
                        }}
                        animateRows={false} // CRÍTICO: Desactivamos la animación de filas para evitar que el render inicial de alturas variables salte / parpadee en la pantalla (Reflow shift constraint).
                        rowHeight={gridMeta.altofila || 40} // Altura base predeterminada
                        headerHeight={45}
                        // Las columnas gestionarán la UI de sort pero NO lo harán en el cliente
                        defaultColDef={{
                            sortable: true,
                            filter: true,
                            resizable: true,
                            unSortIcon: true // Mostrar siempre el icono para invitar a hacer click
                        }}
                    />
                </div>
            </Box>

            <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={totalRecords}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Registros por página:"
            />
        </Paper >
    );
};

export default DynamicGrid;
