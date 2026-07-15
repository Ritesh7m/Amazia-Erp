import { NextResponse } from 'next/server';
import { fetchQuery, executePreparedStatement, getConnection } from '@/database'; // Adjust path if needed

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // 1. Get all unique orders currently in your Etsy statement
    const etsyOrders = await fetchQuery<{ order_no: string }>(`
      SELECT DISTINCT CAST(order_no AS VARCHAR) as order_no FROM etsy_statement
    `);

    if (etsyOrders.length === 0) {
      return NextResponse.json({ success: true, message: 'No orders found to sync.' });
    }

    const conn = await getConnection();
    // Using INSERT OR IGNORE so we don't create duplicates if we run this twice
    const insertQuery = `INSERT OR IGNORE INTO order_awb_mapping (order_no, awb_number) VALUES (?, ?)`;
    let mappedCount = 0;

    // 2. Loop through every order and ask the Dummy API for its AWBs
    for (const order of etsyOrders) {
      try {
        // Change the domain/port if you are not running on localhost:3000
        const res = await fetch(`http://localhost:3000/api/shipments/orders/${order.order_no}`);
        
        if (!res.ok) continue;

        const json = await res.json();
        const awbs = json.data?.awbNumbers || [];

        // 3. Save the exact relationship into DuckDB
        for (const awb of awbs) {
          await executePreparedStatement(conn, insertQuery, [order.order_no, awb]);
          mappedCount++;
        }
      } catch (err) {
        console.error(`Failed to sync order ${order.order_no}:`, err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully mapped ${mappedCount} AWB connections to orders in the database.` 
    });

  } catch (error) {
    console.error('Sync Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}