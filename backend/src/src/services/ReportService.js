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
                // FALLBACK MOCK para que puedas probarlo sin la BD corriendo
                if (idreport === 'catalog_rep') {
                    repoMeta = {
                        title: 'Catálogo de Usuarios',
                        rformato: JSON.stringify({
                            conEncabezado: true,
                            columnas: ['ID', 'Usuario', 'Correo']
                        }),
                        consulta: 'SELECT id, username, email FROM fake_table'
                    };
                } else {
                    throw new Error('Reporte no encontrado');
                }
            }

            // 2. Extraer el formato JSON guardado en RFormato
            // En tu BD, rformato guardará la estructura del diseño
            const layoutOptions = JSON.parse(repoMeta.rformato || '{}');

            // 3. Ejecutar la 'consulta' para traer los datos (Simulado si falla BD)
            let rawData = [];
            try {
                if (repoMeta.consulta) {
                    // Cuidado: En producción sanitizar `consulta` y parameters si vienen externos
                    const dataRes = await db.query(repoMeta.consulta);
                    rawData = dataRes.rows;
                }
            } catch (e) {
                // Mock data para reportes si la BD no responde
                rawData = [
                    { "ID": 1, "Usuario": "admin", "Correo": "admin@empresa.com" },
                    { "ID": 2, "Usuario": "jdoe", "Correo": "jdoe@empresa.com" },
                    { "ID": 3, "Usuario": "jperez", "Correo": "jperez@empresa.com" }
                ];
            }

            // 4. Construir el documento en formato PdfMake dinámicamente
            // Mapeamos los datos SQL a la tabla de PdfMake
            let tableBody = [];

            if (rawData.length > 0) {
                // Cabeceras (usando las llaves del primer objeto o las especificadas)
                const headers = layoutOptions.columnas || Object.keys(rawData[0]);
                tableBody.push(headers.map(h => ({ text: h, style: 'tableHeader' })));

                // Filas de datos
                rawData.forEach(row => {
                    tableBody.push(headers.map(h => {
                        const cellVal = row[h] || row[h.toLowerCase()];
                        return { text: cellVal ? cellVal.toString() : '' };
                    }));
                });
            } else {
                tableBody.push(['Sin resultados']);
            }

            // Document Definition Object de PdfMake
            const docDefinition = {
                content: [
                    { text: repoMeta.title || 'Reporte del Sistema', style: 'header' },
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

            // 5. Generar el PDF y devolver un Stream
            return printer.createPdfKitDocument(docDefinition);

        } catch (error) {
            console.error('Error generando reporte PDF:', error);
            throw error;
        }
    }
}

module.exports = new ReportService();
