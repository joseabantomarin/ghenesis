const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool();

const sopenScript = `
    // Este script se lanza al abrir o refrescar la grilla Detalle (Idgrid 11)
    if (!params.masterValue) {
        // En vez de armar arreglos vacíos o errores, podemos devolver el wrap object con una clausula imposible
        // o idealmente, retornar una consulta vacía manejada localmente
        return { data: [], total: 0 };
    }
    
    // Con la nueva arquitectura "Query Wrapping", ya no necesitamos parsear params, LIMIT, OFFSET,
    // ni construir dinámicamente el ORDER BY o los ILIKE manualmente aquí adentro.
    // Solo le decimos "Esta es la tabla base y su condición vital", la grilla se encargará del resto!
    
    return {
        wrapQuery: "SELECT * FROM CURSOS WHERE idacademia = $1",
        wrapParams: [params.masterValue]
    };
`;

pool.query('UPDATE XGRID SET sopen = $1 WHERE Idgrid = 11', [sopenScript])
    .then(() => {
        console.log('Sopen de Cursos Actualizado en PostgreSQL.');
        const http = require('http');
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/dynamic/refresh-cache',
            method: 'POST'
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => console.log('Caché refrescado:', data));
        });
        req.on('error', e => console.error(e));
        req.end();
    }).catch(console.error).finally(() => setTimeout(() => pool.end(), 1000));
