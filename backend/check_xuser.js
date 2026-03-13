const { Client } = require('pg');
const client = new Client({
  user: 'joseabanto',
  host: 'localhost',
  database: 'ghenesis',
  password: 'mysecretpassword',
  port: 5433,
});
client.connect();
client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'xuser'", (err, res) => {
  if (err) throw err;
  console.log(res.rows.map(r => r.column_name));
  client.end();
});
