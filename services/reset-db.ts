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
  
  DROP VIEW IF EXISTS v_order_financials;
  DROP VIEW IF EXISTS v_order_etsy_allocations;
  DROP VIEW IF EXISTS v_order_etsy_expenses;
  DROP VIEW IF EXISTS v_order_fedex_cost;
  DROP VIEW IF EXISTS v_order_material_cost;
  DROP VIEW IF EXISTS v_order_refunds;
  DROP VIEW IF EXISTS v_order_sales;
  DROP TABLE IF EXISTS etsy_allocation_batches;
  DROP TABLE IF EXISTS etsy_order_allocations;

  -- Drop existing tracked tables
  DROP TABLE IF EXISTS etsy_listing_allocations;
  DROP TABLE IF EXISTS etsy_expenses;
  DROP TABLE IF EXISTS etsy_sales;
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
  DROP SEQUENCE IF EXISTS seq_etsy_sales;
  DROP SEQUENCE IF EXISTS seq_inventory_table;
  DROP SEQUENCE IF EXISTS seq_import_history;
  DROP SEQUENCE IF EXISTS seq_etsy_expenses;
  DROP SEQUENCE IF EXISTS seq_etsy_listing_allocs;
  DROP SEQUENCE IF EXISTS seq_etsy_imports;
  DROP SEQUENCE IF EXISTS seq_etsy_allocation_batches;

  -- =================================================================
  -- 3. CREATE FRESH SEQUENCES
  -- =================================================================
  CREATE SEQUENCE seq_fedex_billing START 1;
  CREATE SEQUENCE seq_inventory_table START 1;
  CREATE SEQUENCE seq_import_history START 1;
  CREATE SEQUENCE seq_etsy_imports START 1;
  CREATE SEQUENCE seq_etsy_allocation_batches START 1;

  -- =================================================================
  -- 4. CREATE NEW SCHEMA TABLES
  -- =================================================================

  -- File Ingestion & Audit Log (FedEx/Global)
  CREATE TABLE import_history (
    id INTEGER DEFAULT nextval('seq_import_history') PRIMARY KEY,
    file_name VARCHAR, file_hash VARCHAR UNIQUE, file_size INTEGER, status VARCHAR,
    invoice_type VARCHAR, total_rows INTEGER, imported_rows INTEGER, failed_rows INTEGER,
    processing_time INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Etsy File Ingestion & Audit Log
  CREATE TABLE etsy_imports (
    id BIGINT DEFAULT nextval('seq_etsy_imports') PRIMARY KEY,
    file_name VARCHAR NOT NULL,
    file_hash VARCHAR NOT NULL UNIQUE,
    file_size BIGINT,
    statement_start_date DATE,
    statement_end_date DATE,
    total_rows INTEGER DEFAULT 0,
    new_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    processing_time_ms BIGINT DEFAULT 0,
    status VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  -- Etsy Allocation Batches (Groups allocations by import)
  CREATE TABLE etsy_allocation_batches (
    allocation_batch_id VARCHAR PRIMARY KEY,
    expense_type VARCHAR NOT NULL,
    pool_amount DOUBLE NOT NULL,
    eligible_order_count INTEGER NOT NULL,
    allocated_amount DOUBLE NOT NULL,
    status VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Etsy Order Allocations (Canonical allocation table)
  CREATE TABLE etsy_order_allocations (
    allocation_id VARCHAR PRIMARY KEY,
    allocation_batch_id VARCHAR NOT NULL,
    order_no VARCHAR NOT NULL,
    amount DOUBLE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  -- =================================================================
  -- 5. CREATE VIEWS
  -- =================================================================
  CREATE VIEW v_order_sales AS SELECT order_no, COALESCE(sum(gross_amount), 0) AS sales FROM etsy_sales GROUP BY order_no;
  
  CREATE VIEW v_order_refunds AS SELECT order_no, COALESCE(sum(-(net_amount)), 0) AS refunds FROM etsy_expenses WHERE (expense_type = 'REFUND') GROUP BY order_no;
  
  CREATE VIEW v_order_material_cost AS SELECT order_no, COALESCE(sum(CASE  WHEN ((upper(material_type) = 'COTTON')) THEN ((quantity * 90)) ELSE (quantity * 100) END), 0) AS material_cost FROM inventory_table GROUP BY order_no;
  
  CREATE VIEW v_order_fedex_cost AS WITH awb_order_counts AS (SELECT awb_number, count(DISTINCT order_no) AS total_orders_in_awb FROM order_awb_mapping GROUP BY awb_number)SELECT m.order_no, sum((f.total_cost / c.total_orders_in_awb)) AS fedex_cost, sum((f.duty / c.total_orders_in_awb)) AS fedex_duty, sum((f.transportation_charges / c.total_orders_in_awb)) AS fedex_transportation, string_agg(DISTINCT m.awb_number, ', ') AS awb_numbers FROM order_awb_mapping AS m INNER JOIN fedex_billing AS f ON ((trim(CAST(m.awb_number AS VARCHAR)) = trim(CAST(f.awb_number AS VARCHAR)))) INNER JOIN awb_order_counts AS c ON ((trim(CAST(m.awb_number AS VARCHAR)) = trim(CAST(c.awb_number AS VARCHAR)))) GROUP BY m.order_no;
  
  CREATE VIEW v_order_etsy_expenses AS SELECT order_no, COALESCE(sum(CASE  WHEN ((expense_type = 'TDS')) THEN (-(net_amount)) ELSE 0 END), 0) AS tds, COALESCE(sum(CASE  WHEN ((expense_type = 'TCS')) THEN (-(net_amount)) ELSE 0 END), 0) AS tcs, COALESCE(sum(CASE  WHEN ((expense_type = 'TRANSACTION_FEE')) THEN (-(net_amount)) ELSE 0 END), 0) AS transaction_fee, COALESCE(sum(CASE  WHEN ((expense_type = 'PROCESSING_FEE')) THEN (-(net_amount)) ELSE 0 END), 0) AS processing_fee, COALESCE(sum(CASE  WHEN ((expense_type = 'SALES_TAX')) THEN (-(net_amount)) ELSE 0 END), 0) AS sales_tax, COALESCE(sum(CASE  WHEN ((expense_type = 'REGULATORY_FEE')) THEN (-(net_amount)) ELSE 0 END), 0) AS regulatory_fee, COALESCE(sum(CASE  WHEN ((expense_type = 'BUYER_FEE')) THEN (-(net_amount)) ELSE 0 END), 0) AS buyer_fee, COALESCE(sum(CASE  WHEN ((expense_type = 'OFFSITE_ADS')) THEN (-(net_amount)) ELSE 0 END), 0) AS offsite_ads, COALESCE(sum(-(net_amount)), 0) AS total_order_etsy_expenses FROM etsy_expenses WHERE ((order_no IS NOT NULL) AND (order_no != '') AND (expense_type != 'REFUND') AND (is_allocation = CAST('f' AS BOOLEAN))) GROUP BY order_no;
  
  CREATE VIEW v_order_etsy_allocations AS SELECT order_no, COALESCE(sum(CASE  WHEN ((b.expense_type = 'LISTING_FEE')) THEN (a.amount) ELSE 0 END), 0) AS etsy_listing_expense, COALESCE(sum(CASE  WHEN ((b.expense_type = 'ETSY_ADS')) THEN (a.amount) ELSE 0 END), 0) AS etsy_ads_expense, COALESCE(sum(a.amount), 0) AS total_allocated_expenses FROM etsy_order_allocations AS a INNER JOIN etsy_allocation_batches AS b ON ((a.allocation_batch_id = b.allocation_batch_id)) GROUP BY order_no;
  
  CREATE VIEW v_order_financials AS WITH all_orders AS ((SELECT order_no, sale_date FROM etsy_sales) UNION ALL (SELECT order_no, expense_date AS sale_date FROM etsy_expenses WHERE ((order_no IS NOT NULL) AND (order_no != '')))), unique_orders AS (SELECT order_no, min(sale_date) AS sale_date FROM all_orders GROUP BY order_no)SELECT o.order_no, o.sale_date, COALESCE(s.sales, 0) AS sales, COALESCE(r.refunds, 0) AS refunds, COALESCE(m.material_cost, 0) AS material_cost, COALESCE(f.fedex_cost, 0) AS fedex_cost, COALESCE(f.fedex_duty, 0) AS fedex_duty, COALESCE(f.fedex_transportation, 0) AS fedex_transportation, COALESCE(f.awb_numbers, 'N/A') AS awb_numbers, COALESCE(a.etsy_listing_expense, 0) AS etsy_listing_expense, COALESCE(a.etsy_ads_expense, 0) AS etsy_ads_expense, COALESCE(a.total_allocated_expenses, 0) AS total_allocated_expenses, COALESCE(e.tds, 0) AS tds, COALESCE(e.tcs, 0) AS tcs, COALESCE(e.transaction_fee, 0) AS transaction_fee, COALESCE(e.processing_fee, 0) AS processing_fee, COALESCE(e.sales_tax, 0) AS sales_tax, COALESCE(e.regulatory_fee, 0) AS regulatory_fee, COALESCE(e.buyer_fee, 0) AS buyer_fee, COALESCE(e.offsite_ads, 0) AS offsite_ads, COALESCE(e.total_order_etsy_expenses, 0) AS order_etsy_expenses, (COALESCE(e.total_order_etsy_expenses, 0) + COALESCE(a.total_allocated_expenses, 0)) AS etsy_expenses, (((COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0)) + COALESCE(e.total_order_etsy_expenses, 0)) + COALESCE(a.total_allocated_expenses, 0)) AS total_expense, ((COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) - (((COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0)) + COALESCE(e.total_order_etsy_expenses, 0)) + COALESCE(a.total_allocated_expenses, 0))) AS profit, CASE  WHEN (((COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) > 0)) THEN (((((COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) - (((COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0)) + COALESCE(e.total_order_etsy_expenses, 0)) + COALESCE(a.total_allocated_expenses, 0))) / (COALESCE(s.sales, 0) - COALESCE(r.refunds, 0))) * 100)) ELSE 0 END AS margin, (COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) AS net_sales FROM unique_orders AS o LEFT JOIN v_order_sales AS s ON ((o.order_no = s.order_no)) LEFT JOIN v_order_refunds AS r ON ((o.order_no = r.order_no)) LEFT JOIN v_order_material_cost AS m ON ((o.order_no = m.order_no)) LEFT JOIN v_order_fedex_cost AS f ON ((o.order_no = f.order_no)) LEFT JOIN v_order_etsy_expenses AS e ON ((o.order_no = e.order_no)) LEFT JOIN v_order_etsy_allocations AS a ON ((o.order_no = a.order_no));

  -- Initialize sync metadata baseline
  INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at)
  VALUES 
    ('etsy', 0, NULL),
    ('fedex_billing', 0, NULL),
    ('google_sheets_inventory', 0, NULL);
`;

const statements = resetScript.split(';').map(s => s.trim()).filter(s => s.length > 0);

db.serialize(() => {
  let hasError = false;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      db.exec(stmt);
    } catch (err) {
      console.error(`❌ Error executing statement:\n${stmt}\n`, err);
      hasError = true;
      break;
    }
  }

  if (hasError) {
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