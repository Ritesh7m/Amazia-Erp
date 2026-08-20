import { NextResponse } from 'next/server';
import { initializeDatabase, executeTransaction } from '@/database';

export async function GET() {
  try {
    // Drop the table to force recreation with the correct schema
    await executeTransaction(async (conn) => {
      await new Promise<void>((resolve, reject) => {
        conn.run(`DROP TABLE IF EXISTS fedex_billing`, (err) => {
          if (err) reject(err); else resolve();
        });
      });
    });

    await initializeDatabase();
    
    await executeTransaction(async (conn) => {
      // Ensure inventory table unique constraint
      await new Promise<void>((resolve, reject) => {
        conn.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_unique ON inventory_table(order_no, material_type, category, color)`, (err) => {
          if (err) reject(err); else resolve();
        });
      });
      // Ensure order awb mapping unique constraint
      await new Promise<void>((resolve, reject) => {
        conn.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_order_awb ON order_awb_mapping(order_no, awb_number)`, (err) => {
          if (err) reject(err); else resolve();
        });
      });
    });
    
    return NextResponse.json({ success: true, message: 'Migrations and views updated' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
