const db = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function backup() {
    const backupDir = process.argv[2];
    const tables = ['XFORMS', 'XGRID', 'XFIELD', 'XCONTROLS'];
    const backupData = {};

    try {
        for (const table of tables) {
            const res = await db.query(`SELECT * FROM ${table}`);
            backupData[table] = res.rows;
        }
        fs.writeFileSync(path.join(backupDir, 'db_metadata_backup.json'), JSON.stringify(backupData, null, 2));
        console.log('✅ Metadatos de la base de datos exportados a JSON.');
    } catch (err) {
        console.error('❌ Error en el backup de DB:', err);
    } finally {
        process.exit();
    }
}

backup();
