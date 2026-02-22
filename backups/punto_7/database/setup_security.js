const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '/Users/joseabanto/Applications/ghenesis/backend/.env' });

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME || 'joseabanto',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432
});

async function setup() {
    try {
        await client.connect();
        console.log('Connected to database:', process.env.DB_NAME || 'joseabanto');

        const sqlPath = '/Users/joseabanto/Applications/ghenesis/database/auth_setup.sql';
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing auth_setup.sql...');
        await client.query(sql);
        console.log('✅ Security setup completed successfully');

    } catch (err) {
        console.error('❌ Error during setup:', err);
    } finally {
        await client.end();
    }
}

setup();
