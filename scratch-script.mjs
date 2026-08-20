import duckdb from 'duckdb';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database/AmaziaERP.db');
const db = new duckdb.Database(dbPath, duckdb.OPEN_READONLY);

db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory_table'", (err, rows) => {
  if (err) console.error(err);
  else console.log(rows);
});
