const express = require('express');
const router = express.Router();
const DynamicController = require('../controllers/DynamicController');
const ReportController = require('../controllers/ReportController');

// 1. Obtener listado de forms/menus para pintar UI principal
router.get('/menu', DynamicController.getMenu);

// 2. Refrescar caché (poner detras de auth admin)
router.post('/refresh-cache', DynamicController.refreshCache);

// 3. Obtener metadatos (configuración) completos de un Formulario y sus Grillas
router.get('/meta/:idform', DynamicController.getFormDefinition);

// 3.1 Obtener configuración global del sistema (shortcuts, etc)
router.get('/sistema-config', DynamicController.getSistemaConfig);


// 4. Obtener datos (registros físicos) de la VISTA (vquery) de una grilla específica
router.get('/data/:idform/:idgrid', DynamicController.getGridData);

// 5. Guardar datos en la base de datos (dinámico basado en grilla/tabla)
router.post('/data/:idform/:idgrid', DynamicController.saveGridData);

// 6. Eliminar datos en la base de datos (Borrado Lógico)
router.delete('/data/:idform/:idgrid/:id', DynamicController.deleteGridData);

// 6.1 Restaurar registro eliminado
router.post('/data-restore/:idform/:idgrid/:id', DynamicController.restoreGridData);

// 6.2 Borrado definitivo (Físico)
router.delete('/data-permanent/:idform/:idgrid/:id', DynamicController.permanentDeleteGridData);

// 7. Guardar anchos y posiciones de columnas en XFIELD
router.post('/save-interface', DynamicController.saveInterface);

// 7.1 Ejecutar consulta libre (SELECT) para scripts dinámicos
router.post('/run-query', DynamicController.runQuery);

// 7.2 Ejecutor de Scripts Dinámicos (Sactivate, Sclose, etc)
router.post('/run/:idform/:event', DynamicController.executeScript);

// 8. Descargar/Visualizar un reporte en PDF basado en XREPORTS
router.get('/report/:idreport', ReportController.downloadReportPdf);

// 8.1 Obtener configuración (diseño) de un reporte de XREPORTS
router.get('/report-config/:idreport', ReportController.getReportConfig);

// 8.2 Guardar configuración (diseño) de un reporte en XREPORTS
router.post('/report-config/:idreport', ReportController.saveReportConfig);

// 9. Búsqueda interactiva de datos para los combo interactivos (type-ahead)
router.get('/combo/:idform/:idgrid/:campo', DynamicController.searchComboData);

module.exports = router;
