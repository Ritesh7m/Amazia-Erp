import type duckdb from 'duckdb'; 
import path from 'path';

declare global {
  var __duckdbDb: duckdb.Database | undefined;
}

const getDbInstance = (): duckdb.Database => {
  if (!globalThis.__duckdbDb) {
    const duckdbModule = eval(`require('duckdb')`);
    
    const dbPath = path.join(process.cwd(), 'database', 'AmaziaERP.db');
    globalThis.__duckdbDb = new duckdbModule.Database(dbPath);
  }
  return globalThis.__duckdbDb!;  
};

export const getConnection = async (): Promise<duckdb.Connection> => {
  return new Promise((resolve, reject) => {
    try {
      const db = getDbInstance();
      resolve(db.connect());
    } catch (error) {
      reject(error);
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
      if (err) reject(err);
      else resolve();
    });
  });
};

export const fetchQuery = async <T>(query: string, params: any[] = []): Promise<T[]> => {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    conn.all(query, ...params, (err: Error | null, res: any) => {
      if (err) reject(err);
      else resolve(res as T[]);
    });
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
      if (beginErr) return reject(beginErr);

      try {
        const result = await callback(conn);
        
        conn.run('COMMIT', (commitErr: Error | null) => {
          if (commitErr) {
            conn.run('ROLLBACK');
            reject(commitErr);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        conn.run('ROLLBACK', () => {
          reject(error);
        });
      }
    });
  });
};

export const initializeDatabase = async (): Promise<void> => {
  const schemaQueries = [
    // --- Existing Tables ---
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    // --- NEW: Inventory Sync Tables ---
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
      material_cost DOUBLE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_no, material_type, category, color)
    );`,

    // Initialize the inventory sync tracker at row 1 if it doesn't already exist
    `INSERT INTO sync_metadata (sync_name, last_processed_row) 
     VALUES ('inventory', 1) 
     ON CONFLICT (sync_name) DO NOTHING;`
  ];

  for (const query of schemaQueries) {
    await executeQuery(query);
  }
};