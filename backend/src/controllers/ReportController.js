const ReportService = require('../services/ReportService');
const db = require('../config/db');

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

exports.getReportConfig = async (req, res) => {
    try {
        const idreport = parseInt(req.params.idreport, 10);
        if (isNaN(idreport)) {
            return res.json({ success: true, data: null, message: "Invalid idreport" });
        }

        const result = await db.query('SELECT formato FROM xreports WHERE idreport = $1', [idreport]);
        const formato = result.rows.length > 0 ? result.rows[0].formato : null;
        res.json({ success: true, data: formato });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.saveReportConfig = async (req, res) => {
    try {
        const idreport = parseInt(req.params.idreport, 10);
        if (isNaN(idreport)) {
            throw new Error("Invalid idreport parameter. Must be an integer.");
        }

        const { formato } = req.body;

        await db.query(`
            UPDATE xreports 
            SET formato = $2 
            WHERE idreport = $1
        `, [idreport, formato]);

        // Verificación técnica obligatoria (regla del usuario)
        const verify = await db.query('SELECT formato FROM xreports WHERE idreport = $1', [idreport]);
        const isSaved = verify.rows.length > 0 && verify.rows[0].formato === formato;

        res.json({ success: true, verified: isSaved });
    } catch (error) {
        console.error("Error saving report config:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
