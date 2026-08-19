import type duckdb from 'duckdb'; 
import path from 'path';

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
        const duckdbModule = eval(`require('duckdb')`);
        const dbPath = path.join(process.cwd(), 'database', 'AmaziaERP.db');
        const db = new duckdbModule.Database(dbPath, (err: any) => {
          if (err) {
            globalThis.__duckdbDbPromise = undefined;
            reject(err);
          } else {
            resolve(db);
          }
        });
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
  return Promise.resolve();
};

const executeQuery = async (query: string): Promise<void> => {
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
            if (commitErr.message && commitErr.message.includes('invalidated because of a previous fatal error')) {
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
        if (error && error.message && error.message.includes('invalidated because of a previous fatal error')) {
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
    `CREATE SEQUENCE IF NOT EXISTS seq_import_history;`,
    `CREATE TABLE IF NOT EXISTS import_history (
      id INTEGER DEFAULT nextval('seq_import_history') PRIMARY KEY,
      file_name VARCHAR, file_hash VARCHAR UNIQUE, file_size INTEGER, status VARCHAR,
      invoice_type VARCHAR, total_rows INTEGER, imported_rows INTEGER, failed_rows INTEGER,
      processing_time INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    
    `CREATE SEQUENCE IF NOT EXISTS seq_fedex_billing;`,
    `CREATE TABLE IF NOT EXISTS fedex_billing (
      id INTEGER DEFAULT nextval('seq_fedex_billing') PRIMARY KEY,
      invoice_type VARCHAR, invoice_date DATE, due_date DATE, awb_number VARCHAR,
      air_waybill_total_amount DECIMAL(15, 2), book_expense_cost DECIMAL(15, 2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    
    `CREATE SEQUENCE IF NOT EXISTS seq_etsy_statement;`,
    `CREATE TABLE IF NOT EXISTS etsy_statement (
      id INTEGER DEFAULT nextval('seq_etsy_statement') PRIMARY KEY,
      order_no VARCHAR, date DATE, type VARCHAR, net_amt DECIMAL(15, 2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_no, date, net_amt, type)
    );`,

    // --- Inventory Sync Tables ---
    `CREATE TABLE IF NOT EXISTS sync_metadata (
      sync_name VARCHAR PRIMARY KEY,
      last_processed_row INTEGER,
      last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE SEQUENCE IF NOT EXISTS seq_inventory_table;`,
    `CREATE TABLE IF NOT EXISTS inventory_table (
      id BIGINT DEFAULT nextval('seq_inventory_table') PRIMARY KEY,
      order_no VARCHAR,
      material_type VARCHAR,
      category VARCHAR,
      color VARCHAR,
      quantity DOUBLE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_no, material_type, category, color)
    );`,

    // Initialize the sync trackers safely with NULL timestamps
    `INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at) 
     VALUES 
       ('etsy_statement', 0, NULL),
       ('fedex_billing', 0, NULL),
       ('google_sheets_inventory', 0, NULL)
     ON CONFLICT (sync_name) DO NOTHING;`,

    // Legacy tables removed.

    // --- Order AWB Mapping Table ---
    `CREATE TABLE IF NOT EXISTS order_awb_mapping (
      order_no VARCHAR,
      awb_number VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (order_no, awb_number)
    );`,
    
    // --- New Architecture Tables ---
    
    `CREATE SEQUENCE IF NOT EXISTS seq_etsy_imports;`,
    `CREATE TABLE IF NOT EXISTS etsy_imports (
      id BIGINT DEFAULT nextval('seq_etsy_imports') PRIMARY KEY,
      file_name VARCHAR,
      file_hash VARCHAR UNIQUE,
      file_size INTEGER,
      statement_start_date DATE,
      statement_end_date DATE,
      total_rows INTEGER,
      new_rows INTEGER,
      duplicate_rows INTEGER,
      failed_rows INTEGER,
      processing_time_ms INTEGER,
      status VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS etsy_sales (
      transaction_hash VARCHAR PRIMARY KEY,
      order_no VARCHAR NOT NULL,
      sale_date DATE NOT NULL,
      type VARCHAR DEFAULT 'Sale',
      gross_amount DOUBLE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

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

    `CREATE TABLE IF NOT EXISTS etsy_allocation_batches (
      allocation_batch_id VARCHAR PRIMARY KEY,
      allocation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expense_type VARCHAR NOT NULL,
      pool_amount DOUBLE NOT NULL,
      eligible_order_count INTEGER NOT NULL,
      allocated_amount DOUBLE NOT NULL,
      status VARCHAR NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS etsy_order_allocations (
      allocation_id VARCHAR PRIMARY KEY,
      allocation_batch_id VARCHAR NOT NULL,
      order_no VARCHAR NOT NULL,
      amount DOUBLE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
    
    // --- Order Financial Views ---
    
    `CREATE OR REPLACE VIEW v_order_sales AS
      SELECT order_no, COALESCE(SUM(gross_amount), 0) AS sales
      FROM etsy_sales
      GROUP BY order_no;`,

    `CREATE OR REPLACE VIEW v_order_refunds AS
      SELECT order_no, COALESCE(SUM(-net_amount), 0) AS refunds
      FROM etsy_expenses
      WHERE expense_type = 'REFUND'
      GROUP BY order_no;`,

    `CREATE OR REPLACE VIEW v_order_etsy_expenses AS
      SELECT order_no, 
             COALESCE(SUM(CASE WHEN expense_type = 'TDS' THEN -net_amount ELSE 0 END), 0) AS tds,
             COALESCE(SUM(CASE WHEN expense_type = 'TCS' THEN -net_amount ELSE 0 END), 0) AS tcs,
             COALESCE(SUM(CASE WHEN expense_type = 'TRANSACTION_FEE' THEN -net_amount ELSE 0 END), 0) AS transaction_fee,
             COALESCE(SUM(CASE WHEN expense_type = 'PROCESSING_FEE' THEN -net_amount ELSE 0 END), 0) AS processing_fee,
             COALESCE(SUM(CASE WHEN expense_type = 'SALES_TAX' THEN -net_amount ELSE 0 END), 0) AS sales_tax,
             COALESCE(SUM(CASE WHEN expense_type = 'REGULATORY_FEE' THEN -net_amount ELSE 0 END), 0) AS regulatory_fee,
             COALESCE(SUM(CASE WHEN expense_type = 'BUYER_FEE' THEN -net_amount ELSE 0 END), 0) AS buyer_fee,
             COALESCE(SUM(CASE WHEN expense_type = 'OFFSITE_ADS' THEN -net_amount ELSE 0 END), 0) AS offsite_ads,
             COALESCE(SUM(-net_amount), 0) AS total_order_etsy_expenses
      FROM etsy_expenses
      WHERE order_no IS NOT NULL AND order_no != '' AND expense_type != 'REFUND' AND is_allocation = FALSE
      GROUP BY order_no;`,

    `CREATE OR REPLACE VIEW v_order_etsy_allocations AS
      SELECT order_no, 
             COALESCE(SUM(CASE WHEN b.expense_type = 'LISTING_FEE' THEN a.amount ELSE 0 END), 0) AS etsy_listing_expense,
             COALESCE(SUM(CASE WHEN b.expense_type = 'ETSY_ADS' THEN a.amount ELSE 0 END), 0) AS etsy_ads_expense,
             COALESCE(SUM(a.amount), 0) AS total_allocated_expenses
      FROM etsy_order_allocations a
      JOIN etsy_allocation_batches b ON a.allocation_batch_id = b.allocation_batch_id
      GROUP BY order_no;`,

    `CREATE OR REPLACE VIEW v_order_material_cost AS
      SELECT order_no,
             COALESCE(SUM(
               CASE 
                 WHEN UPPER(material_type) = 'COTTON' THEN quantity * 90 
                 ELSE quantity * 100 
               END
             ), 0) AS material_cost
      FROM inventory_table
      GROUP BY order_no;`,

    `CREATE OR REPLACE VIEW v_order_fedex_cost AS
      WITH awb_order_counts AS (
        SELECT awb_number, COUNT(DISTINCT order_no) as total_orders_in_awb
        FROM order_awb_mapping
        GROUP BY awb_number
      )
      SELECT 
        m.order_no,
        SUM(f.air_waybill_total_amount / c.total_orders_in_awb) as fedex_cost,
        STRING_AGG(DISTINCT m.awb_number, ', ') as awb_numbers
      FROM order_awb_mapping m
      JOIN fedex_billing f ON TRIM(CAST(m.awb_number AS VARCHAR)) = TRIM(CAST(f.awb_number AS VARCHAR))
      JOIN awb_order_counts c ON TRIM(CAST(m.awb_number AS VARCHAR)) = TRIM(CAST(c.awb_number AS VARCHAR))
      GROUP BY m.order_no;`,

    `CREATE OR REPLACE VIEW v_order_financials AS
      WITH all_orders AS (
        SELECT order_no, sale_date FROM etsy_sales
        UNION ALL
        SELECT order_no, expense_date as sale_date FROM etsy_expenses WHERE order_no IS NOT NULL AND order_no != ''
      ),
      unique_orders AS (
        SELECT order_no, MIN(sale_date) as sale_date FROM all_orders GROUP BY order_no
      )
      SELECT 
        o.order_no,
        o.sale_date,
        COALESCE(s.sales, 0) AS sales,
        COALESCE(r.refunds, 0) AS refunds,
        COALESCE(m.material_cost, 0) AS material_cost,
        COALESCE(f.fedex_cost, 0) AS fedex_cost,
        COALESCE(f.awb_numbers, 'N/A') AS awb_numbers,
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
        (COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0) + COALESCE(e.total_order_etsy_expenses, 0) + COALESCE(a.total_allocated_expenses, 0)) AS total_expense,
        (COALESCE(s.sales, 0) - COALESCE(r.refunds, 0) - (COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0) + COALESCE(e.total_order_etsy_expenses, 0) + COALESCE(a.total_allocated_expenses, 0))) AS profit,
        CASE 
          WHEN (COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) > 0 THEN (((COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) - (COALESCE(m.material_cost, 0) + COALESCE(f.fedex_cost, 0) + COALESCE(e.total_order_etsy_expenses, 0) + COALESCE(a.total_allocated_expenses, 0))) / (COALESCE(s.sales, 0) - COALESCE(r.refunds, 0))) * 100
          ELSE 0
        END AS margin,
        (COALESCE(s.sales, 0) - COALESCE(r.refunds, 0)) AS net_sales
      FROM unique_orders o
      LEFT JOIN v_order_sales s ON o.order_no = s.order_no
      LEFT JOIN v_order_refunds r ON o.order_no = r.order_no
      LEFT JOIN v_order_material_cost m ON o.order_no = m.order_no
      LEFT JOIN v_order_fedex_cost f ON o.order_no = f.order_no
      LEFT JOIN v_order_etsy_expenses e ON o.order_no = e.order_no
      LEFT JOIN v_order_etsy_allocations a ON o.order_no = a.order_no;`
  ];

  for (const query of schemaQueries) {
    await executeQuery(query);
  }
};