const { Pool } = require('pg');
const pool = new Pool({
  user: 'joseabanto',
  host: 'localhost',
  database: 'joseabanto',
  password: '',
  port: 5432,
});

async function run() {
  try {
    const res = await pool.query('SELECT ocultabar FROM XGRID WHERE idgrid = $1', ['grid_xforms']);
    console.log('Before:', res.rows[0]);
    
    await pool.query('UPDATE XGRID SET ocultabar = $1 WHERE idgrid = $2', [true, 'grid_xforms']);
    
    const res2 = await pool.query('SELECT ocultabar FROM XGRID WHERE idgrid = $1', ['grid_xforms']);
    console.log('After set to true:', res2.rows[0]);
    
    await pool.query('UPDATE XGRID SET ocultabar = $1 WHERE idgrid = $2', [false, 'grid_xforms']);
    
    const res3 = await pool.query('SELECT ocultabar FROM XGRID WHERE idgrid = $1', ['grid_xforms']);
    console.log('After set to false:', res3.rows[0]);
    
    pool.end();
  } catch(e) {
    console.error(e);
  }
}
run();
