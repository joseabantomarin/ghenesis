const db = require('../config/db');
const PdfPrinter = require('pdfmake');
const fs = require('fs');

// Fuentes base gratuitas (Roboto) integradas en pdfmake
const fonts = {
    Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

const printer = new PdfPrinter(fonts);

class ReportService {

    // Función que carga el registro XREPORT y lo renderiza basado en rformato (JSON) 
    // y consulta (Query)
    async generatePdf(idreport, params = {}) {
        try {
            // 1. Obtener la metadata del reporte de la base de datos
            const res = await db.query('SELECT * FROM XREPORTS WHERE idreport = $1', [idreport]);
            let repoMeta = null;

            if (res.rows.length > 0) {
                repoMeta = res.rows[0];
            } else {
                // FALLBACK MOCK
                if (idreport === 'catalog_rep') {
                    repoMeta = {
                        nombre: 'Catálogo de Usuarios',
                        formato: JSON.stringify({
                            conEncabezado: true,
                            columnas: ['ID', 'Usuario', 'Correo']
                        }),
                        ejecuta: 'SELECT id, username, email FROM fake_table'
                    };
                } else {
                    throw new Error(`Reporte con ID ${idreport} no encontrado`);
                }
            }

            // 2. Extraer el formato (JSON o XML)
            let layoutOptions = {};
            const formatStr = repoMeta.formato || repoMeta.rformato || '{}';
            if (formatStr.trim().startsWith('{')) {
                try {
                    layoutOptions = JSON.parse(formatStr);
                } catch (e) {
                    console.warn("No se pudo parsear formato como JSON, usando objeto vacío");
                }
            }

            // 3. Ejecutar la consulta (simulado si es XML por ahora)
            let rawData = [];
            let queryToRun = repoMeta.consulta || repoMeta.ejecuta;
            
            try {
                if (queryToRun && queryToRun.toLowerCase().includes('select')) {
                    const dataRes = await db.query(queryToRun);
                    rawData = dataRes.rows;
                }
            } catch (e) {
                console.warn("Error ejecutando consulta de reporte, usando mocks:", e.message);
                rawData = [
                    { "ID": 1, "Usuario": "admin", "Correo": "admin@empresa.com" },
                    { "ID": 2, "Usuario": "jdoe", "Correo": "jdoe@empresa.com" }
                ];
            }

            // 4. Construir documento PdfMake
            let tableBody = [];
            if (rawData.length > 0) {
                const headers = layoutOptions.columnas || Object.keys(rawData[0]);
                tableBody.push(headers.map(h => ({ text: h, style: 'tableHeader' })));

                rawData.forEach(row => {
                    tableBody.push(headers.map(h => {
                        const cellVal = row[h] || row[h.toLowerCase()];
                        return { text: cellVal ? cellVal.toString() : '' };
                    }));
                });
            } else {
                tableBody.push(['Sin resultados']);
            }

            const docDefinition = {
                content: [
                    { text: repoMeta.descripcion || repoMeta.nombre || 'Reporte del Sistema', style: 'header' },
                    { text: 'Generado desde Ghenesis Framework\n\n', style: 'subheader' },
                    {
                        style: 'tableExample',
                        table: {
                            headerRows: 1,
                            body: tableBody
                        },
                        layout: 'lightHorizontalLines'
                    }
                ],
                styles: {
                    header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
                    subheader: { fontSize: 12, italics: true, color: 'gray' },
                    tableExample: { margin: [0, 5, 0, 15] },
                    tableHeader: { bold: true, fontSize: 13, color: 'black', fillColor: '#eeeeee' }
                },
                defaultStyle: { font: 'Roboto' }
            };

            return printer.createPdfKitDocument(docDefinition);

        } catch (error) {
            console.error('Error generando reporte PDF:', error);
            throw error;
        }
    }
}

module.exports = new ReportService();
