import { NextResponse } from 'next/server';
import { executeTransaction, fetchQuery } from '@/database';
import type { Connection } from 'duckdb';

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await executeTransaction(async (conn: Connection) => {
      // Drop all data from the new Etsy tables
      const query = (q: string) => new Promise<void>((resolve, reject) => {
        conn.run(q, (err) => err ? reject(err) : resolve());
      });

      await query('DELETE FROM etsy_expense_allocations;');
      await query('DELETE FROM etsy_expense_groups;');
      await query('DELETE FROM etsy_transactions;');
      await query('DELETE FROM etsy_imports;');
      
      // Legacy tables just in case
      await query('DELETE FROM etsy_listing_allocations;');
      await query('DELETE FROM etsy_expenses;');
      await query('DELETE FROM etsy_statement;');
    });

    return NextResponse.json({ success: true, message: 'Etsy data successfully reset.' });
  } catch (error: any) {
    console.error('Error resetting Etsy data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
