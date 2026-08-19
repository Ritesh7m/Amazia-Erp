import { executeTransaction, initializeDatabase } from './database/index';
import type { Connection } from 'duckdb';

async function resetDb() {
  console.log('Resetting DB...');
  await executeTransaction(async (conn: Connection) => {
    const query = (q: string) => new Promise<void>((resolve, reject) => {
      conn.run(q, (err) => err ? reject(err) : resolve());
    });
    
    await query('DROP TABLE IF EXISTS etsy_sales;');
    await query('DROP TABLE IF EXISTS etsy_expenses;');
    await query('DROP TABLE IF EXISTS etsy_imports;');
    await query('DROP TABLE IF EXISTS etsy_allocation_batches;');
    await query('DROP TABLE IF EXISTS etsy_order_allocations;');
    await query('DROP TABLE IF EXISTS etsy_statement;');
    await query('DROP TABLE IF EXISTS order_listing_allocations;');
    
    await query('DROP VIEW IF EXISTS v_order_sales;');
    await query('DROP VIEW IF EXISTS v_order_refunds;');
    await query('DROP VIEW IF EXISTS v_order_etsy_expenses;');
    await query('DROP VIEW IF EXISTS v_order_etsy_allocations;');
    await query('DROP VIEW IF EXISTS v_order_financials;');
  });
  
  console.log('Initializing DB...');
  await initializeDatabase();
  console.log('DB Reset Complete.');
  process.exit(0);
}

resetDb().catch(console.error);
