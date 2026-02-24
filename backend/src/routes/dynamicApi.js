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

// 6. Eliminar datos en la base de datos
router.delete('/data/:idform/:idgrid/:id', DynamicController.deleteGridData);

// 7. Guardar anchos y posiciones de columnas en XFIELD
router.post('/save-interface', DynamicController.saveInterface);

// 8. Descargar/Visualizar un reporte en PDF basado en XREPORTS
router.get('/report/:idreport', ReportController.downloadReportPdf);

module.exports = router;
