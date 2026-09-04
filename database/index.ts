import duckdb from 'duckdb'; 
import path from 'path';
import fs from 'fs';

// Enable native JSON serialization for DuckDB BigInt values
if (typeof BigInt.prototype !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
}

declare global {
  var __duckdbDbPromise: Promise<duckdb.Database> | undefined;
}

const getDbInstance = async (): Promise<duckdb.Database> => {
  if (!globalThis.__duckdbDbPromise) {
    globalThis.__duckdbDbPromise = new Promise((resolve, reject) => {
      try {
        const DuckDBClass = (duckdb as any).Database || (duckdb as any).default?.Database;
        const dbPath = path.join(process.cwd(), 'database', 'AmaziaERP.db');
        
        const openDb = () => {
          const db = new DuckDBClass(dbPath, (err: any) => {
            if (err) {
              const walPath = `${dbPath}.wal`;
              if (fs.existsSync(walPath)) {
                try {
                  console.warn('[DuckDB] Cleaning uncommitted WAL file from unclean shutdown...');
                  fs.unlinkSync(walPath);
                  const retryDb = new DuckDBClass(dbPath, (retryErr: any) => {
                    if (retryErr) {
                      globalThis.__duckdbDbPromise = undefined;
                      reject(retryErr);
                    } else {
                      resolve(retryDb);
                    }
                  });
                  return;
                } catch (e) {
                  // Fall through
                }
              }
              globalThis.__duckdbDbPromise = undefined;
              reject(err);
            } else {
              resolve(db);
            }
          });
        };

        openDb();
      } catch (err) {
        globalThis.__duckdbDbPromise = undefined;
        reject(err);
      }
    });
  }
  return globalThis.__duckdbDbPromise;
};

export const getConnection = async (): Promise<duckdb.Connection> => {
  const db = await getDbInstance();
  return new Promise((resolve, reject) => {
    try {
      const conn = db.connect();
      resolve(conn);
    } catch (err: any) {
      if (err?.message?.includes('invalidated because of a previous fatal error') || err?.message?.includes('fatal error')) {
        globalThis.__duckdbDbPromise = undefined;
        try { db.close(); } catch (e) {}
      }
      reject(err);
    }
  });
};

export const closeConnection = async (): Promise<void> => {
  if (globalThis.__duckdbDbPromise) {
    const db = await globalThis.__duckdbDbPromise;
    return new Promise((resolve, reject) => {
      db.close((err: any) => {
        globalThis.__duckdbDbPromise = undefined;
        if (err) reject(err);
        else resolve();
      });
    });
  }
  return Promise.resolve();
};

export const executeQuery = async (query: string): Promise<void> => {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    conn.run(query, (err: Error | null) => {
      conn.close();
      if (err) {
        if (err.message && err.message.includes('invalidated because of a previous fatal error')) {
          globalThis.__duckdbDbPromise = undefined;
        }
        reject(err);
      }
      else resolve();
    });
  });
};

export const fetchQuery = async <T>(query: string, params: any[] = []): Promise<T[]> => {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    const callback = (err: Error | null, res: any) => {
      conn.close();
      if (err) {
        if (err.message && err.message.includes('invalidated because of a previous fatal error')) {
          globalThis.__duckdbDbPromise = undefined;
        }
        reject(err);
      }
      else resolve(res as T[]);
    };

    if (params && params.length > 0) {
      conn.all(query, ...params, callback);
    } else {
      conn.all(query, callback);
    }
  });
};

export const executePreparedStatement = async (
  conn: duckdb.Connection,
  query: string,
  params: any[]
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const stmt = conn.prepare(query);
    stmt.run(...params, (err: Error | null) => {
      stmt.finalize();
      if (err) {
        if (err.message && err.message.includes('invalidated because of a previous fatal error')) {
          globalThis.__duckdbDbPromise = undefined;
        }
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const executeTransaction = async <T>(
  callback: (conn: duckdb.Connection) => Promise<T>
): Promise<T> => {
  const conn = await getConnection();

  return new Promise((resolve, reject) => {
    conn.run('BEGIN TRANSACTION', async (beginErr: Error | null) => {
      if (beginErr) {
        if (beginErr.message && beginErr.message.includes('invalidated because of a previous fatal error')) {
          globalThis.__duckdbDbPromise = undefined;
        }
        conn.close();
        return reject(beginErr);
      }

      try {
        const result = await callback(conn);
        
        conn.run('COMMIT', (commitErr: Error | null) => {
          if (commitErr) {
            if (commitErr.message && (commitErr.message.includes('invalidated') || commitErr.message.includes('TransactionContext') || commitErr.message.includes('conflict'))) {
              globalThis.__duckdbDbPromise = undefined;
            }
            conn.run('ROLLBACK', () => {
              conn.close();
              reject(commitErr);
            });
          } else {
            conn.close();
            resolve(result);
          }
        });
      } catch (error: any) {
        if (error && error.message && (error.message.includes('invalidated') || error.message.includes('TransactionContext') || error.message.includes('conflict'))) {
          globalThis.__duckdbDbPromise = undefined;
        }
        conn.run('ROLLBACK', () => {
          conn.close();
          reject(error);
        });
      }
    });
  });
};

export const initializeDatabase = async (): Promise<void> => {
  const schemaQueries = [
    // --- Sequences ---
    `CREATE SEQUENCE IF NOT EXISTS seq_fedex_imports START 1;`,
    `CREATE SEQUENCE IF NOT EXISTS seq_fedex_billing START 1;`,
    `CREATE SEQUENCE IF NOT EXISTS seq_fedex_allocations START 1;`,
    `CREATE SEQUENCE IF NOT EXISTS seq_inventory_table START 1;`,
    `CREATE SEQUENCE IF NOT EXISTS seq_etsy_imports START 1;`,
    `CREATE SEQUENCE IF NOT EXISTS seq_etsy_allocation_batches START 1;`,

    // --- FedEx Imports Tracking Table ---
    `CREATE TABLE IF NOT EXISTS fedex_imports (
      id INTEGER PRIMARY KEY DEFAULT nextval('seq_fedex_imports'),
      file_name VARCHAR NOT NULL,
      file_hash VARCHAR NOT NULL UNIQUE,
      file_size BIGINT,
      status VARCHAR NOT NULL DEFAULT 'COMPLETED',
      total_rows INTEGER DEFAULT 0,
      imported_rows INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );`,

    // --- Canonical Orders Master Table ---
    `CREATE TABLE IF NOT EXISTS orders (
      order_no VARCHAR PRIMARY KEY,
      sale_date DATE,
      product_description VARCHAR,
      order_source VARCHAR DEFAULT 'ETSY_CSV',
      sales_source VARCHAR DEFAULT 'ETSY_CSV',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // --- FedEx Ingestion Table ---
    `CREATE TABLE IF NOT EXISTS fedex_billing (
      id INTEGER PRIMARY KEY DEFAULT nextval('seq_fedex_billing'),
      billing_row_hash VARCHAR,
      invoice_type VARCHAR,
      invoice_date DATE,
      due_date DATE,
      awb_number VARCHAR NOT NULL,
      order_no VARCHAR,
      country VARCHAR,
      air_waybill_total_amount DECIMAL(15, 2) NOT NULL,
      file_hash VARCHAR,
      shipper_reference_1 VARCHAR,
      parsed_order_no VARCHAR,
      recipient_country VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    
    // --- Backup Audit Table ---
    `CREATE TABLE IF NOT EXISTS backup_history (
      backup_id VARCHAR PRIMARY KEY,
      file_name VARCHAR,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      status VARCHAR NOT NULL,
      source_size BIGINT,
      backup_size BIGINT,
      local_path VARCHAR,
      drive_file_id VARCHAR,
      error_message VARCHAR,
      retry_count INTEGER DEFAULT 0
    );`,

    // --- Sync Metadata ---
    `CREATE TABLE IF NOT EXISTS sync_metadata (
      sync_name VARCHAR PRIMARY KEY,
      last_processed_row INTEGER DEFAULT 0,
      last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR DEFAULT 'COMPLETED'
    );`,

    // --- Inventory Tracking ---
    `CREATE TABLE IF NOT EXISTS inventory_table (
      id INTEGER PRIMARY KEY DEFAULT nextval('seq_inventory_table'),
      order_no VARCHAR NOT NULL,
      material_type VARCHAR,
      category VARCHAR,
      color VARCHAR,
      quantity DOUBLE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_no, material_type, category, color)
    );`,

    // --- Order AWB Mapping (Many-to-Many) ---
    `CREATE TABLE IF NOT EXISTS order_awb_mapping (
      order_no VARCHAR NOT NULL,
      awb_number VARCHAR NOT NULL,
      source VARCHAR DEFAULT 'Shipment API',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (order_no, awb_number)
    );`,

    // --- Order FedEx Allocations ---
    `CREATE TABLE IF NOT EXISTS order_fedex_allocations (
      id INTEGER PRIMARY KEY DEFAULT nextval('seq_fedex_allocations'),
      order_no VARCHAR NOT NULL,
      awb_number VARCHAR NOT NULL,
      allocated_cost DECIMAL(15, 2) NOT NULL,
      air_waybill_total_amount DECIMAL(15, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_no, awb_number)
    );`,
    
    // --- Etsy Import Logs ---
    `CREATE TABLE IF NOT EXISTS etsy_imports (
      id BIGINT DEFAULT nextval('seq_etsy_imports') PRIMARY KEY,
      file_name VARCHAR NOT NULL,
      file_hash VARCHAR NOT NULL UNIQUE,
      file_size BIGINT NOT NULL,
      statement_start_date DATE,
      statement_end_date DATE,
      total_rows INTEGER DEFAULT 0,
      new_rows INTEGER DEFAULT 0,
      duplicate_rows INTEGER DEFAULT 0,
      failed_rows INTEGER DEFAULT 0,
      processing_time_ms BIGINT DEFAULT 0,
      status VARCHAR NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      error_message VARCHAR
    );`,

    // --- Etsy Sales Ledger ---
    `CREATE TABLE IF NOT EXISTS etsy_sales (
      transaction_hash VARCHAR PRIMARY KEY,
      order_no VARCHAR NOT NULL,
      sale_date DATE NOT NULL,
      type VARCHAR DEFAULT 'Sale',
      gross_amount DOUBLE NOT NULL,
      title VARCHAR,
      info VARCHAR,
      product_description VARCHAR,
      quantity INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // --- Etsy Expenses Ledger ---
    `CREATE TABLE IF NOT EXISTS etsy_expenses (
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
    );`,

    // --- Etsy Allocation Batches ---
    `CREATE TABLE IF NOT EXISTS etsy_allocation_batches (
      allocation_batch_id VARCHAR PRIMARY KEY,
      expense_type VARCHAR NOT NULL,
      pool_amount DOUBLE NOT NULL,
      eligible_order_count INTEGER NOT NULL,
      allocated_amount DOUBLE NOT NULL,
      status VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // --- Etsy Order Allocations ---
    `CREATE TABLE IF NOT EXISTS etsy_order_allocations (
      allocation_id VARCHAR PRIMARY KEY,
      allocation_batch_id VARCHAR NOT NULL,
      order_no VARCHAR NOT NULL,
      amount DOUBLE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // --- Baseline Sync Trackers ---
    `INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at, status) 
     VALUES 
       ('fedex_billing', 0, NULL, 'NOT_SYNCED'),
       ('fedex_mapping', 0, NULL, 'PENDING'),
       ('google_sheets_inventory', 0, NULL, 'NOT_SYNCED'),
       ('etsy_statement', 0, NULL, 'NOT_SYNCED')
     ON CONFLICT (sync_name) DO NOTHING;`
  ];

  const conn = await getConnection();
  try {
    // Step 1: Create sequences and tables
    for (let i = 0; i < schemaQueries.length; i++) {
      await new Promise<void>((resolve, reject) => {
        conn.run(schemaQueries[i], (err) => {
          if (err) {
            console.error(`[initializeDatabase] Failed on table query index ${i}:`, schemaQueries[i], err);
            reject(new Error(`Table Query ${i} failed: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
    }

    // Step 2: Ensure any new columns exist on pre-existing tables before views compile
    try {
      await new Promise<void>((resolve) => conn.run(`ALTER TABLE order_awb_mapping ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'Shipment API';`, () => resolve()));
    } catch (e) {}

    try {
      await new Promise<void>((resolve) => conn.run(`ALTER TABLE fedex_billing ADD COLUMN IF NOT EXISTS billing_row_hash VARCHAR;`, () => resolve()));
    } catch (e) {}

    try {
      await new Promise<void>((resolve) => conn.run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source VARCHAR DEFAULT 'ETSY_CSV';`, () => resolve()));
    } catch (e) {}

    try {
      await new Promise<void>((resolve) => conn.run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_source VARCHAR DEFAULT 'ETSY_CSV';`, () => resolve()));
    } catch (e) {}

    // Step 3: Create / Replace Views
    const viewQueries = [
      // --- 1. Order Sales Aggregation View ---
      `CREATE OR REPLACE VIEW v_order_sales AS 
        SELECT order_no, COALESCE(sum(gross_amount), 0) AS sales 
        FROM etsy_sales 
        GROUP BY order_no;`,

      // --- 2. Order Refunds Aggregation View ---
      `CREATE OR REPLACE VIEW v_order_refunds AS 
        SELECT order_no, COALESCE(sum(-(net_amount)), 0) AS refunds 
        FROM etsy_expenses 
        WHERE (expense_type = 'REFUND') 
        GROUP BY order_no;`,

      // --- 3. Order Material Cost Aggregation View ---
      `CREATE OR REPLACE VIEW v_order_material_cost AS 
        SELECT order_no, 
               COALESCE(sum(quantity), 0) AS total_quantity,
               COALESCE(STRING_AGG(DISTINCT NULLIF(TRIM(material_type), ''), ', '), 'N/A') AS material_types,
               COALESCE(sum(CASE WHEN ((upper(material_type) = 'COTTON')) THEN ((quantity * 90)) ELSE (quantity * 100) END), 0) AS material_cost 
        FROM inventory_table 
        GROUP BY order_no;`,

      // --- 4. Order FedEx Cost Aggregation View ---
      `CREATE OR REPLACE VIEW v_order_fedex_cost AS 
        WITH mapped_awbs AS (
          SELECT order_no, awb_number, COALESCE(source, 'Shipment API') AS source 
          FROM order_awb_mapping 
          WHERE awb_number IS NOT NULL AND awb_number != ''
        ),
        order_awb_summary AS (
          SELECT 
            order_no,
            STRING_AGG(DISTINCT awb_number, ', ') AS awb_numbers,
            STRING_AGG(DISTINCT awb_number || ':' || source, ', ') AS awb_sources,
            COUNT(DISTINCT awb_number) AS awb_count
          FROM mapped_awbs
          GROUP BY order_no
        ),
        order_countries AS (
          SELECT 
            m.order_no,
            STRING_AGG(DISTINCT NULLIF(TRIM(COALESCE(b.recipient_country, b.country)), ''), ', ') AS billing_countries
          FROM mapped_awbs m
          LEFT JOIN fedex_billing b ON m.awb_number = b.awb_number
          GROUP BY m.order_no
        ),
        order_alloc_summary AS (
          SELECT 
            order_no,
            COALESCE(SUM(allocated_cost), 0) AS fedex_cost
          FROM order_fedex_allocations
          GROUP BY order_no
        ),
        all_fedex_orders AS (
          SELECT order_no FROM order_awb_summary
          UNION
          SELECT order_no FROM order_alloc_summary
        )
        SELECT 
          o.order_no,
          COALESCE(a.fedex_cost, 0) AS fedex_cost,
          CAST(0 AS DECIMAL(15,2)) AS fedex_duty,
          CAST(0 AS DECIMAL(15,2)) AS fedex_transportation,
          COALESCE(w.awb_numbers, 'N/A') AS awb_numbers,
          COALESCE(w.awb_sources, 'N/A') AS awb_sources,
          COALESCE(w.awb_count, 0) AS awb_count,
          COALESCE(NULLIF(TRIM(oc.billing_countries), ''), 'N/A') AS country,
          CASE
            WHEN COALESCE(a.fedex_cost, 0) > 0 THEN 'MATCHED'
            WHEN w.awb_numbers IS NOT NULL AND w.awb_numbers != 'N/A' THEN 'AWAITING_BILLING'
            ELSE 'UNMATCHED'
          END AS fedex_match_status
        FROM all_fedex_orders o
        LEFT JOIN order_awb_summary w ON o.order_no = w.order_no
        LEFT JOIN order_alloc_summary a ON o.order_no = a.order_no
        LEFT JOIN order_countries oc ON o.order_no = oc.order_no;`,

      // --- 5. Order Product Title Resolution View ---
      `CREATE OR REPLACE VIEW v_order_products AS
        WITH expense_products AS (
          SELECT 
            order_no,
            TRIM(REGEXP_REPLACE(title, '^(Transaction fee|Fee|Credit for transaction fee on):\s*', '', 'i')) AS expense_product_title,
            ROW_NUMBER() OVER (
              PARTITION BY order_no 
              ORDER BY 
                CASE WHEN title ILIKE 'Transaction fee:%' THEN 1 ELSE 2 END,
                LENGTH(title) DESC
            ) as rn
          FROM etsy_expenses
          WHERE order_no IS NOT NULL AND order_no != '' 
            AND title IS NOT NULL AND title != ''
            AND title ILIKE 'Transaction fee:%'
        ),
        unique_expense_products AS (
          SELECT order_no, expense_product_title AS expense_title 
          FROM expense_products 
          WHERE rn = 1
        ),
        sales_products AS (
          SELECT 
            order_no,
            MAX(NULLIF(TRIM(product_description), '')) AS sales_title
          FROM etsy_sales
          WHERE product_description IS NOT NULL 
            AND product_description != '' 
            AND product_description != 'Etsy Order Item'
            AND product_description NOT ILIKE 'Payment for Order%'
            AND product_description NOT ILIKE 'Tax %'
          GROUP BY order_no
        ),
        inventory_products AS (
          SELECT 
            order_no,
            MAX(NULLIF(TRIM(category || ' ' || color || ' (' || material_type || ')'), '')) AS inventory_desc
          FROM inventory_table
          GROUP BY order_no
        ),
        all_product_orders AS (
          SELECT order_no FROM orders
          UNION
          SELECT order_no FROM etsy_sales
          UNION
          SELECT order_no FROM etsy_expenses WHERE order_no IS NOT NULL AND order_no != ''
          UNION
          SELECT order_no FROM inventory_table
          UNION
          SELECT order_no FROM order_fedex_allocations
        )
        SELECT 
          o.order_no,
          COALESCE(
            ep.expense_title,
            CASE 
              WHEN ord.product_description ILIKE 'Tax %' OR ord.product_description ILIKE 'Payment for Order%' OR ord.product_description ILIKE 'TCS%' OR ord.product_description ILIKE 'TDS%' OR ord.product_description ILIKE 'Processing fee%' OR ord.product_description ILIKE 'Regulatory%' OR ord.product_description = 'Etsy Order Item' THEN NULL
              ELSE TRIM(ord.product_description)
            END,
            CASE 
              WHEN s.sales_title ILIKE 'Tax %' OR s.sales_title ILIKE 'Payment for Order%' OR s.sales_title ILIKE 'TCS%' OR s.sales_title ILIKE 'TDS%' OR s.sales_title ILIKE 'Processing fee%' OR s.sales_title ILIKE 'Regulatory%' OR s.sales_title = 'Etsy Order Item' THEN NULL
              ELSE TRIM(s.sales_title)
            END,
            i.inventory_desc, 
            'Etsy Order Item'
          ) AS product_title
        FROM all_product_orders o
        LEFT JOIN orders ord ON o.order_no = ord.order_no
        LEFT JOIN sales_products s ON o.order_no = s.order_no
        LEFT JOIN unique_expense_products ep ON o.order_no = ep.order_no
        LEFT JOIN inventory_products i ON o.order_no = i.order_no;`,

      // --- 6. Direct Order Etsy Expenses View ---
      `CREATE OR REPLACE VIEW v_order_etsy_expenses AS 
        SELECT order_no, 
               COALESCE(sum(CASE WHEN ((expense_type = 'TDS')) THEN (-(net_amount)) ELSE 0 END), 0) AS tds, 
               COALESCE(sum(CASE WHEN ((expense_type = 'TCS')) THEN (-(net_amount)) ELSE 0 END), 0) AS tcs, 
               COALESCE(sum(CASE WHEN ((expense_type = 'TRANSACTION_FEE')) THEN (-(net_amount)) ELSE 0 END), 0) AS transaction_fee, 
               COALESCE(sum(CASE WHEN ((expense_type = 'PROCESSING_FEE')) THEN (-(net_amount)) ELSE 0 END), 0) AS processing_fee, 
               COALESCE(sum(CASE WHEN ((expense_type = 'SALES_TAX')) THEN (-(net_amount)) ELSE 0 END), 0) AS sales_tax, 
               COALESCE(sum(CASE WHEN ((expense_type = 'REGULATORY_FEE')) THEN (-(net_amount)) ELSE 0 END), 0) AS regulatory_fee, 
               COALESCE(sum(CASE WHEN ((expense_type = 'BUYER_FEE')) THEN (-(net_amount)) ELSE 0 END), 0) AS buyer_fee, 
               COALESCE(sum(CASE WHEN ((expense_type = 'OFFSITE_ADS')) THEN (-(net_amount)) ELSE 0 END), 0) AS offsite_ads, 
               COALESCE(sum(-(net_amount)), 0) AS total_order_etsy_expenses 
        FROM etsy_expenses 
        WHERE ((order_no IS NOT NULL) AND (order_no != '') AND (expense_type != 'REFUND') AND (is_allocation = CAST('f' AS BOOLEAN))) 
        GROUP BY order_no;`,

      // --- 7. Proportional Etsy Allocations View ---
      `CREATE OR REPLACE VIEW v_order_etsy_allocations AS 
        SELECT order_no, 
               COALESCE(sum(CASE WHEN ((b.expense_type = 'LISTING_FEE')) THEN (a.amount) ELSE 0 END), 0) AS etsy_listing_expense, 
               COALESCE(sum(CASE WHEN ((b.expense_type = 'ETSY_ADS')) THEN (a.amount) ELSE 0 END), 0) AS etsy_ads_expense, 
               COALESCE(sum(a.amount), 0) AS total_allocated_expenses 
        FROM etsy_order_allocations AS a 
        INNER JOIN etsy_allocation_batches AS b ON ((a.allocation_batch_id = b.allocation_batch_id)) 
        GROUP BY order_no;`,

      // --- 8. Canonical Master Financials View ---
      `CREATE OR REPLACE VIEW v_order_financials AS 
        WITH sales_orders AS (
          SELECT order_no, sale_date, product_description FROM etsy_sales WHERE sale_date IS NOT NULL
          UNION ALL
          SELECT order_no, sale_date, product_description FROM orders WHERE sale_date IS NOT NULL AND sales_source != 'NONE'
        ),
        expense_orders AS (
          SELECT order_no, expense_date AS sale_date, NULL AS product_description FROM etsy_expenses WHERE order_no IS NOT NULL AND order_no != '' AND expense_date IS NOT NULL
        ),
        all_orders AS (
          SELECT order_no, sale_date, product_description FROM sales_orders
          UNION ALL
          SELECT order_no, sale_date, product_description FROM expense_orders
          UNION ALL
          SELECT order_no, NULL AS sale_date, product_description FROM orders WHERE sale_date IS NULL
          UNION ALL
          SELECT order_no, NULL AS sale_date, NULL AS product_description FROM order_awb_mapping
          UNION ALL
          SELECT order_no, NULL AS sale_date, NULL AS product_description FROM order_fedex_allocations
          UNION ALL
          SELECT order_no, NULL AS sale_date, NULL AS product_description FROM inventory_table
        ), 
        unique_orders AS (
          SELECT 
            order_no, 
            MIN(sale_date) AS sale_date, 
            MAX(product_description) AS fallback_product_desc 
          FROM all_orders 
          GROUP BY order_no
        )
        SELECT 
          o.order_no, 
          o.sale_date,
          CASE WHEN o.sale_date IS NOT NULL THEN strftime(o.sale_date, '%b %d %Y') ELSE 'N/A' END AS formatted_sale_date, 
          COALESCE(p.product_title, o.fallback_product_desc, 'Etsy Order Item') AS product_title,
          COALESCE(f.country, 'N/A') AS country,
          s.sales AS sales, 
          COALESCE(r.refunds, 0) AS refunds, 
          (COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) AS net_sales, 
          COALESCE(m.material_cost, 0) AS material_cost, 
          COALESCE(m.total_quantity, 0) AS quantity,
          COALESCE(m.material_types, 'N/A') AS material_type,
          COALESCE(f.fedex_cost, 0) AS fedex_cost, 
          COALESCE(f.fedex_duty, 0) AS fedex_duty, 
          COALESCE(f.fedex_transportation, 0) AS fedex_transportation, 
          COALESCE(f.awb_numbers, 'N/A') AS awb_numbers, 
          COALESCE(f.awb_sources, 'N/A') AS awb_sources, 
          COALESCE(f.fedex_match_status, 'UNMATCHED') AS fedex_match_status, 
          COALESCE(a.etsy_listing_expense, 0) AS etsy_listing_expense, 
          COALESCE(a.etsy_ads_expense, 0) AS etsy_ads_expense, 
          COALESCE(a.total_allocated_expenses, 0) AS total_allocated_expenses, 
          COALESCE(e.tds, 0) AS tds, 
          COALESCE(e.tcs, 0) AS tcs, 
          COALESCE(e.transaction_fee, 0) AS transaction_fee, 
          COALESCE(e.processing_fee, 0) AS processing_fee, 
          COALESCE(e.sales_tax, 0) AS sales_tax, 
          COALESCE(e.regulatory_fee, 0) AS regulatory_fee, 
          COALESCE(e.buyer_fee, 0) AS buyer_fee, 
          COALESCE(e.offsite_ads, 0) AS offsite_ads, 
          COALESCE(e.total_order_etsy_expenses, 0) AS order_etsy_expenses, 
          (COALESCE(e.total_order_etsy_expenses, 0) + COALESCE(a.total_allocated_expenses, 0)) AS etsy_expenses, 
          (((COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0)) + COALESCE(e.total_order_etsy_expenses, 0)) + COALESCE(a.total_allocated_expenses, 0)) AS total_expense, 
          ((COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) - (((COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0)) + COALESCE(e.total_order_etsy_expenses, 0)) + COALESCE(a.total_allocated_expenses, 0))) AS profit, 
          CASE  
            WHEN (((COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) > 0)) 
              THEN ((((COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) - (((COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0)) + COALESCE(e.total_order_etsy_expenses, 0)) + COALESCE(a.total_allocated_expenses, 0))) / (COALESCE(s.sales, 0) - COALESCE(r.refunds, 0))) * 100) 
            WHEN (COALESCE(s.sales, 0) > 0)
              THEN ((((COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) - (((COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0)) + COALESCE(e.total_order_etsy_expenses, 0)) + COALESCE(a.total_allocated_expenses, 0))) / COALESCE(s.sales, 0)) * 100) 
            ELSE NULL 
          END AS margin,
          CASE 
            WHEN COALESCE(r.refunds, 0) >= COALESCE(s.sales, 0) AND COALESCE(s.sales, 0) > 0 THEN 'Refunded'
            WHEN COALESCE(r.refunds, 0) > 0 THEN 'Partially Refunded'
            ELSE NULL
          END AS refund_status
        FROM unique_orders AS o 
        LEFT JOIN v_order_products AS p ON ((o.order_no = p.order_no)) 
        LEFT JOIN v_order_sales AS s ON ((o.order_no = s.order_no)) 
        LEFT JOIN v_order_refunds AS r ON ((o.order_no = r.order_no)) 
        LEFT JOIN v_order_material_cost AS m ON ((o.order_no = m.order_no)) 
        LEFT JOIN v_order_fedex_cost AS f ON ((o.order_no = f.order_no)) 
        LEFT JOIN v_order_etsy_expenses AS e ON ((o.order_no = e.order_no)) 
        LEFT JOIN v_order_etsy_allocations AS a ON ((o.order_no = a.order_no));`
    ];

    for (let j = 0; j < viewQueries.length; j++) {
      await new Promise<void>((resolve, reject) => {
        conn.run(viewQueries[j], (err) => {
          if (err) {
            console.error(`[initializeDatabase] Failed on view query index ${j}:`, viewQueries[j], err);
            reject(new Error(`View Query ${j} failed: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
    }

    // Self-healing migration: Reclassify any auto-renew or listing fee expenses misclassified as OTHER_STORE_EXPENSE
    try {
      await new Promise<void>((resolve) => {
        conn.run(`
          UPDATE etsy_expenses 
          SET expense_type = 'LISTING_FEE' 
          WHERE (expense_type = 'OTHER_STORE_EXPENSE' OR expense_type = 'OTHER_ORDER_EXPENSE')
            AND (
              LOWER(title) LIKE '%listing fee%' OR 
              LOWER(title) LIKE '%auto-renew%' OR 
              LOWER(title) LIKE '%auto renew%' OR 
              LOWER(title) LIKE '%autorenew%' OR 
              LOWER(title) LIKE '%renew expired%' OR 
              LOWER(title) LIKE '%renew sold%' OR 
              LOWER(title) LIKE '%private listing%' OR 
              LOWER(title) LIKE '%multi-quantity%' OR
              LOWER(title) LIKE '%listing renewal%'
            )
            AND LOWER(title) NOT LIKE '%transaction fee%';
        `, () => resolve());
      });

      // Reconcile allocation batches for LISTING_FEE and ETSY_ADS to account for fee credits (SUM(-net_amount))
      const batchRows = await new Promise<any[]>((resolve, reject) => {
        conn.all(`
          SELECT allocation_batch_id, expense_type, pool_amount, eligible_order_count 
          FROM etsy_allocation_batches 
          WHERE expense_type IN ('LISTING_FEE', 'ETSY_ADS')
        `, (err, rows) => err ? reject(err) : resolve(rows || []));
      });

      for (const batch of batchRows) {
        const batchId = batch.allocation_batch_id;
        const expenseType = batch.expense_type;

        // Extract import ID if batch ID follows pattern batch_${importId}_${expenseType}
        const importMatch = batchId.match(/^batch_(\d+)_/);
        const importId = importMatch ? importMatch[1] : null;

        let query = `
          SELECT COALESCE(SUM(-net_amount), 0) as batch_total
          FROM etsy_expenses 
          WHERE expense_type = ?
        `;
        const params: any[] = [expenseType];
        if (importId) {
          query += ` AND (import_reference = ? OR import_reference IS NULL)`;
          params.push(importId);
        }

        const expRows = await new Promise<any[]>((resolve, reject) => {
          conn.all(query, ...params, (err, rows) => err ? reject(err) : resolve(rows || []));
        });

        const actualBatchTotal = Math.round(Number(expRows[0]?.batch_total || 0) * 100) / 100;

        if (actualBatchTotal > 0) {
          const allocOrders = await new Promise<any[]>((resolve, reject) => {
            conn.all(`
              SELECT order_no 
              FROM etsy_order_allocations 
              WHERE allocation_batch_id = ?
              ORDER BY order_no
            `, batchId, (err, rows) => err ? reject(err) : resolve(rows || []));
          });

          if (allocOrders.length > 0) {
            const count = allocOrders.length;
            const allocationPerOrder = Math.floor((actualBatchTotal / count) * 100) / 100;
            const remainder = Math.round((actualBatchTotal - (allocationPerOrder * count)) * 100) / 100;

            await new Promise<void>((resolve) => {
              conn.run(`
                UPDATE etsy_allocation_batches 
                SET pool_amount = ?, allocated_amount = ?, eligible_order_count = ?
                WHERE allocation_batch_id = ?
              `, actualBatchTotal, actualBatchTotal, count, batchId, () => resolve());
            });

            for (let k = 0; k < allocOrders.length; k++) {
              const ordNo = allocOrders[k].order_no;
              const amt = (k === allocOrders.length - 1) 
                ? Math.round((allocationPerOrder + remainder) * 100) / 100 
                : allocationPerOrder;
              
              await new Promise<void>((resolve) => {
                conn.run(`
                  UPDATE etsy_order_allocations 
                  SET amount = ? 
                  WHERE allocation_batch_id = ? AND order_no = ?
                `, amt, batchId, ordNo, () => resolve());
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[initializeDatabase] Self-healing listing fee migration skipped:', e);
    }

    // Clean up any stale/orphaned PROCESSING states left over from crashed or interrupted runs
    try {
      await new Promise<void>((resolve) => conn.run(`UPDATE etsy_imports SET status = 'FAILED', error_message = 'Interrupted processing' WHERE status = 'PROCESSING';`, () => resolve()));
      await new Promise<void>((resolve) => conn.run(`UPDATE fedex_imports SET status = 'FAILED' WHERE status = 'PROCESSING';`, () => resolve()));
    } catch (e) {}
  } finally {
    try { conn.close(); } catch (e) {}
  }
};

export const resetDatabase = async (): Promise<void> => {
  const dropQueries = [
    `DROP VIEW IF EXISTS v_order_financials;`,
    `DROP VIEW IF EXISTS v_order_products;`,
    `DROP VIEW IF EXISTS v_order_etsy_allocations;`,
    `DROP VIEW IF EXISTS v_order_etsy_expenses;`,
    `DROP VIEW IF EXISTS v_order_fedex_cost;`,
    `DROP VIEW IF EXISTS v_order_material_cost;`,
    `DROP VIEW IF EXISTS v_order_refunds;`,
    `DROP VIEW IF EXISTS v_order_sales;`,
    `DROP TABLE IF EXISTS orders;`,
    `DROP TABLE IF EXISTS etsy_order_allocations;`,
    `DROP TABLE IF EXISTS etsy_allocation_batches;`,
    `DROP TABLE IF EXISTS etsy_imports;`,
    `DROP TABLE IF EXISTS etsy_sales;`,
    `DROP TABLE IF EXISTS etsy_expenses;`,
    `DROP TABLE IF EXISTS fedex_imports;`,
    `DROP TABLE IF EXISTS fedex_billing;`,
    `DROP TABLE IF EXISTS inventory_table;`,
    `DROP TABLE IF EXISTS sync_metadata;`,
    `DROP TABLE IF EXISTS order_awb_mapping;`,
    `DROP TABLE IF EXISTS order_fedex_allocations;`,
    `DROP TABLE IF EXISTS backup_history;`,
    `DROP SEQUENCE IF EXISTS seq_fedex_imports;`,
    `DROP SEQUENCE IF EXISTS seq_fedex_billing;`,
    `DROP SEQUENCE IF EXISTS seq_fedex_allocations;`,
    `DROP SEQUENCE IF EXISTS seq_inventory_table;`,
    `DROP SEQUENCE IF EXISTS seq_etsy_imports;`,
    `DROP SEQUENCE IF EXISTS seq_etsy_allocation_batches;`
  ];

  const conn = await getConnection();
  try {
    for (const q of dropQueries) {
      await new Promise<void>((resolve, reject) => {
        conn.run(q, (err) => err ? reject(err) : resolve());
      });
    }
  } finally {
    try { conn.close(); } catch (e) {}
  }

  await initializeDatabase();
};