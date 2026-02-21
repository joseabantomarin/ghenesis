const ReportService = require('../services/ReportService');

exports.downloadReportPdf = async (req, res) => {
    try {
        const { idreport } = req.params;

        // Obtenemos el flujo (stream) dinámico de la memoria y lo enviamos directo al cliente
        const pdfDoc = await ReportService.generatePdf(idreport, req.query);

        // Cabeceras HTTP para forzar visualizar o descargar el PDF en el navegador
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="reporte_${idreport}.pdf"`);

        pdfDoc.pipe(res);
        pdfDoc.end(); // Indica al constructor que el documento ha finalizado

    } catch (error) {
        res.status(500).json({ success: false, error: 'No se pudo generar el reporte PDF: ' + error.message });
    }
};
