import { NextResponse } from 'next/server';
import { fetchQuery, executePreparedStatement, getConnection } from '@/database';
import { shipmentApi } from '@/services/shipmentApi';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // 1. Read distinct order numbers from etsy_statement
    const etsyOrders = await fetchQuery<{ order_no: string }>(`
      SELECT DISTINCT CAST(order_no AS VARCHAR) as order_no 
      FROM etsy_statement
      WHERE order_no IS NOT NULL AND order_no != ''
    `);

    if (!etsyOrders || etsyOrders.length === 0) {
      return NextResponse.json({
        success: true,
        totalOrders: 0,
        mappedOrders: 0,
        newMappings: 0,
        existingMappings: 0,
        unmappedOrders: 0,
        failedOrders: 0,
        errors: [],
        message: 'No orders found in etsy_statement to sync.',
      });
    }

    const conn = await getConnection();
    
    // Ensure order_awb_mapping table exists
    await conn.run(`
      CREATE TABLE IF NOT EXISTS order_awb_mapping (
        order_no VARCHAR,
        awb_number VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (order_no, awb_number)
      )
    `);

    const totalOrders = etsyOrders.length;
    let mappedOrders = 0;
    let newMappings = 0;
    let existingMappings = 0;
    let unmappedOrders = 0;
    let failedOrders = 0;
    const errors: string[] = [];

    const insertQuery = `INSERT INTO order_awb_mapping (order_no, awb_number, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`;

    // Process orders sequentially so logs are clear and per-request timeouts are isolated
    for (const order of etsyOrders) {
      const orderNo = order.order_no;

      try {
        const result = await shipmentApi.getAwbsByOrder(orderNo);

        if (!result.success) {
          failedOrders++;
          errors.push(result.message || `Order ${orderNo}: Failed to fetch AWBs`);
          continue;
        }

        const awbNumbers = result.data?.awbNumbers || [];

        if (awbNumbers.length === 0) {
          unmappedOrders++;
          continue;
        }

        mappedOrders++;

        for (const awb of awbNumbers) {
          if (!awb) continue;

          // Check if mapping already exists
          const existing = await fetchQuery<{ count: number }>(
            `SELECT COUNT(*) as count FROM order_awb_mapping WHERE order_no = ? AND awb_number = ?`,
            [orderNo, awb]
          );

          if (existing && existing[0] && Number(existing[0].count) > 0) {
            existingMappings++;
          } else {
            await executePreparedStatement(conn, insertQuery, [orderNo, awb]);
            newMappings++;
          }
        }
      } catch (err: any) {
        failedOrders++;
        console.error(`Failed to sync order ${orderNo}:`, err);
        errors.push(`Order ${orderNo}: ${err?.message || 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: failedOrders === 0,
      totalOrders,
      mappedOrders,
      newMappings,
      existingMappings,
      unmappedOrders,
      failedOrders,
      errors,
    });
  } catch (error: any) {
    console.error('Shipment Sync Endpoint Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Shipment service unavailable',
      },
      { status: 500 }
    );
  }
}

// Support GET for status check or manual trigger if needed
export async function GET() {
  return POST();
}