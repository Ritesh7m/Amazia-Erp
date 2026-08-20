import duckdb from 'duckdb';
import path from 'path';

// Resolve the path to your DuckDB file
const dbPath = path.resolve(process.cwd(), 'database/AmaziaERP.db');
const db = new duckdb.Database(dbPath);

console.log(`Connecting to database at: ${dbPath}`);

const resetScript = `
  -- =================================================================
  -- 1. DROP ALL EXISTING & LEGACY TABLES & VIEWS
  -- =================================================================
  
  -- Drop missing views and tables identified from the database state
  DROP VIEW IF EXISTS v_order_etsy_allocations;
  DROP TABLE IF EXISTS etsy_allocation_batches;
  DROP TABLE IF EXISTS etsy_order_allocations;

  -- Drop existing tracked tables
  DROP TABLE IF EXISTS etsy_listing_allocations;
  DROP TABLE IF EXISTS order_listing_allocations;
  DROP TABLE IF EXISTS etsy_expenses;
  DROP TABLE IF EXISTS etsy_sales;
  DROP TABLE IF EXISTS etsy_statement;
  DROP TABLE IF EXISTS fedex_billing;
  DROP TABLE IF EXISTS inventory_table;
  DROP TABLE IF EXISTS sync_metadata;
  DROP TABLE IF EXISTS import_history;
  DROP TABLE IF EXISTS order_awb_mapping;
  DROP TABLE IF EXISTS shipment_order_mapping;

  -- =================================================================
  -- 2. DROP ALL LEGACY & CURRENT SEQUENCES
  -- =================================================================
  DROP SEQUENCE IF EXISTS seq_fedex_billing;
  DROP SEQUENCE IF EXISTS seq_etsy_statement;
  DROP SEQUENCE IF EXISTS seq_etsy_sales;
  DROP SEQUENCE IF EXISTS seq_inventory_table;
  DROP SEQUENCE IF EXISTS seq_import_history;
  DROP SEQUENCE IF EXISTS seq_etsy_expenses;
  DROP SEQUENCE IF EXISTS seq_etsy_listing_allocs;

  -- =================================================================
  -- 3. CREATE FRESH SEQUENCES
  -- =================================================================
  CREATE SEQUENCE seq_fedex_billing START 1;
  CREATE SEQUENCE seq_inventory_table START 1;
  CREATE SEQUENCE seq_import_history START 1;

  -- =================================================================
  -- 4. CREATE NEW SCHEMA TABLES
  -- =================================================================

  -- File Ingestion & Audit Log
  CREATE TABLE import_history (
    id INTEGER DEFAULT nextval('seq_import_history') PRIMARY KEY,
    file_name VARCHAR, file_hash VARCHAR UNIQUE, file_size INTEGER, status VARCHAR,
    invoice_type VARCHAR, total_rows INTEGER, imported_rows INTEGER, failed_rows INTEGER,
    processing_time INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Etsy Sales Ledger (Gross Revenue)
  CREATE TABLE etsy_sales (
    transaction_hash VARCHAR PRIMARY KEY,
    order_no VARCHAR NOT NULL,
    sale_date DATE NOT NULL,
    type VARCHAR DEFAULT 'Sale',
    gross_amount DOUBLE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Etsy Expenses & Deductions Fact Table (Fees, Taxes, Credits, Refunds)
  CREATE TABLE etsy_expenses (
    transaction_hash VARCHAR PRIMARY KEY,
    order_no VARCHAR,
    expense_date DATE,
    expense_type VARCHAR NOT NULL,
    title VARCHAR,
    info VARCHAR,
    currency VARCHAR DEFAULT 'INR',
    amount DOUBLE DEFAULT 0.0,
    fees_taxes DOUBLE DEFAULT 0.0,
    net_amount DOUBLE NOT NULL,
    tax_details VARCHAR,
    listing_id VARCHAR,
    is_allocation BOOLEAN DEFAULT FALSE,
    import_reference VARCHAR,
    source_transaction_hash VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Order Listing Allocations Tracker (Prevents duplicate listing fee amortizations)
  CREATE TABLE order_listing_allocations (
    order_no VARCHAR PRIMARY KEY,
    batch_reference VARCHAR,
    allocated_amount DOUBLE NOT NULL,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- FedEx Billing Invoices
  CREATE TABLE fedex_billing (
    id INTEGER PRIMARY KEY DEFAULT nextval('seq_fedex_billing'),
    invoice_number VARCHAR,
    awb_number VARCHAR,
    shipment_date DATE,
    transportation_charges DECIMAL(15, 2),
    duty DECIMAL(15, 2),
    taxes DECIMAL(15, 2),
    other_charges DECIMAL(15, 2),
    total_cost DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Inventory Tracking
  CREATE TABLE inventory_table (
    id INTEGER PRIMARY KEY DEFAULT nextval('seq_inventory_table'),
    order_no VARCHAR NOT NULL,
    material_type VARCHAR,
    category VARCHAR,
    color VARCHAR,
    quantity DOUBLE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_no, material_type, category, color)
  );

  -- Google Sheets Sync State Metadata
  CREATE TABLE sync_metadata (
    sync_name VARCHAR PRIMARY KEY,
    last_processed_row INTEGER DEFAULT 0,
    last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Order to AWB Relationship Mapping
  CREATE TABLE order_awb_mapping (
    order_no VARCHAR NOT NULL,
    awb_number VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (order_no, awb_number)
  );

  -- Initialize sync metadata baseline
  INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at)
  VALUES 
    ('etsy_statement', 0, NULL),
    ('fedex_billing', 0, NULL),
    ('google_sheets_inventory', 0, NULL);
`;

db.exec(resetScript, (err) => {
  if (err) {
    console.error('❌ Error resetting database schema:', err);
    process.exit(1);
  } else {
    console.log('✅ Database reset successfully! Normalized tables and sequences initialized.');

    // Verify all active tables
    db.all('SHOW TABLES;', (tableErr, res) => {
      if (tableErr) throw tableErr;
      console.log('\n--- Active Tables in DuckDB ---');
      console.table(res);
      process.exit(0);
    });
  }
});