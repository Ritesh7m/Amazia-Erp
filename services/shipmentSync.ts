import { fetchQuery, executePreparedStatement, getConnection } from '../database/index';
import { shipmentApi } from './shipmentApi';
import type { Connection } from 'duckdb';

export async function syncShipmentMappings() {
  console.log('[Shipment Sync] Starting shipment mapping sync...');
  
  try {
    const orders = await fetchQuery<{ order_no: string }>(`
      SELECT DISTINCT order_no FROM etsy_transactions 
      WHERE order_no IS NOT NULL AND order_no != ''
    `);
    
    if (!orders || orders.length === 0) {
      console.log('[Shipment Sync] No orders found to sync.');
      return;
    }

    console.log(`[Shipment Sync] Found ${orders.length} unique orders. Fetching AWBs...`);

    const conn = await getConnection();
    
    let mappedCount = 0;
    
    for (const { order_no } of orders) {
      if (!order_no) continue;
      
      const result = await shipmentApi.getAwbsByOrder(order_no);
      
      if (result.success && result.data && result.data.awbNumbers.length > 0) {
        for (const awb of result.data.awbNumbers) {
          try {
            await executePreparedStatement(conn, 
              `INSERT INTO order_awb_mapping (order_no, awb_number) 
               VALUES (?, ?) 
               ON CONFLICT (order_no, awb_number) DO NOTHING`,
              [order_no, awb]
            );
            mappedCount++;
          } catch (e: any) {
            console.error(`[Shipment Sync] Error inserting mapping for order ${order_no}:`, e.message);
          }
        }
      }
      
      // Small delay to prevent rate limits
      await new Promise(res => setTimeout(res, 50));
    }
    
    console.log(`[Shipment Sync] Sync completed. Added/verified ${mappedCount} mappings.`);
  } catch (error: any) {
    console.error('[Shipment Sync] Fatal error during sync:', error.message);
  }
}

if (require.main === module) {
  syncShipmentMappings()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
