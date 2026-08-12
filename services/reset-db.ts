import duckdb from 'duckdb';
import path from 'path';

// Resolve the path to your DuckDB file
const dbPath = path.resolve(process.cwd(), 'database/AmaziaERP.db');
const db = new duckdb.Database(dbPath);

console.log(`Connecting to database at: ${dbPath}`);

const resetScript = `
  -- 1. Drop all existing tables (including old naming conventions)
  DROP TABLE IF EXISTS fedex_billing;
  DROP TABLE IF EXISTS etsy_statement;
  DROP TABLE IF EXISTS inventory_table;
  DROP TABLE IF EXISTS import_history;
  DROP TABLE IF EXISTS sync_metadata;
  DROP TABLE IF EXISTS order_awb_mapping;
  DROP TABLE IF EXISTS shipment_order_mapping;

  -- 2. Drop all sequences
  DROP SEQUENCE IF EXISTS seq_fedex_billing;
  DROP SEQUENCE IF EXISTS seq_etsy_statement;
  DROP SEQUENCE IF EXISTS seq_inventory_table;
  DROP SEQUENCE IF EXISTS seq_import_history;

  -- 3. Create fresh sequences starting at 1
  CREATE SEQUENCE seq_fedex_billing START 1;
  CREATE SEQUENCE seq_etsy_statement START 1;
  CREATE SEQUENCE seq_import_history START 1;
  CREATE SEQUENCE seq_inventory_table START 1;

  -- 4. Recreate the mapping table
  CREATE TABLE IF NOT EXISTS order_awb_mapping (
    order_no VARCHAR,
    awb_number VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (order_no, awb_number)
  );

  -- Note: The rest of your tables (etsy_statement, fedex_billing, etc.) 
  -- will automatically be recreated by your database/index.ts initialization 
  -- logic the next time you start the Next.js app or run the scheduler.
`;

db.exec(resetScript, (err) => {
  if (err) {
    console.error('Error resetting database:', err);
    process.exit(1);
  } else {
    console.log('Database reset successfully! All data cleared and sequences reset to 1.');
    
    // Verify by showing remaining tables
    db.all('SHOW TABLES;', (err, res) => {
      if (err) throw err;
      console.log('Current Tables in DB:');
      console.table(res);
      process.exit(0);
    });
  }
});