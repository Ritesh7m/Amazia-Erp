import type { Connection } from 'duckdb';
import { fetchQuery, executeTransaction, executePreparedStatement, getConnection } from '@/database';
import { normalizeAwb, normalizeOrderNumber } from '@/utils/normalization';

export interface TrackingLookupOrderResult {
  order_no: string;
  receipt_id?: string | number;
  has_tracking: boolean;
  tracking_code?: string;
  carrier_name?: string;
  error?: string;
}

export interface TrackingLookupApiResponse {
  success: boolean;
  orders?: TrackingLookupOrderResult[];
  error?: string;
}

export interface TrackingSyncResult {
  success: boolean;
  message: string;
  unmappedCount: number;
  lookupAttempted: number;
  trackingFound: number;
  clubbedOrdersCount: number;
  errors?: string[];
}

export class TrackingLookupService {
  /**
   * Fetches unmapped orders, looks up tracking codes via Apps Script endpoint,
   * stores new mappings, calculates clubbed material costs, and re-allocates FedEx costs.
   */
  static async runSync(): Promise<TrackingSyncResult> {
    const apiUrl = process.env.TRACKING_LOOKUP_API_URL?.trim() ||
      'https://script.google.com/macros/s/AKfycbyYvd4Er24mlYZqhA6DzZfXjy2NyqcyVPHtcJYzh5w3qvqj4ccQ9dXYcD_imlJba5JA/exec';

    console.log(`[Tracking Lookup Service] Starting lookup via ${apiUrl}`);

    // Step 1: Find all unmapped orders
    const unmappedOrdersQuery = `
      WITH all_orders AS (
        SELECT DISTINCT order_no FROM orders WHERE order_no IS NOT NULL AND order_no != ''
        UNION
        SELECT DISTINCT order_no FROM etsy_sales WHERE order_no IS NOT NULL AND order_no != ''
        UNION
        SELECT DISTINCT order_no FROM shopify_sales WHERE order_no IS NOT NULL AND order_no != ''
      )
      SELECT order_no 
      FROM all_orders 
      WHERE order_no NOT IN (
        SELECT DISTINCT order_no 
        FROM order_awb_mapping 
        WHERE awb_number IS NOT NULL AND awb_number != ''
      )
      ORDER BY order_no;
    `;

    const unmappedRows = await fetchQuery<{ order_no: string }>(unmappedOrdersQuery);
    const unmappedOrderNos = unmappedRows.map(r => String(r.order_no)).filter(Boolean);

    console.log(`[Tracking Lookup Service] Found ${unmappedOrderNos.length} unmapped orders.`);

    if (unmappedOrderNos.length === 0) {
      // Recalculate clubbed allocations to ensure integrity
      let clubbedCount = 0;
      await executeTransaction(async (conn) => {
        clubbedCount = await TrackingLookupService.recalculateClubbedAllocations(conn);
        await executePreparedStatement(
          conn,
          `UPDATE sync_metadata 
           SET last_sync_at = CURRENT_TIMESTAMP, status = 'COMPLETED', last_processed_row = 0
           WHERE sync_name = 'tracking_lookup';`,
          []
        );
      });

      return {
        success: true,
        message: 'No unmapped orders found. Clubbed allocations verified.',
        unmappedCount: 0,
        lookupAttempted: 0,
        trackingFound: 0,
        clubbedOrdersCount: clubbedCount
      };
    }

    // Step 2: Batch request to Google Apps Script endpoint (chunks of 100 with concurrency)
    const BATCH_SIZE = 100;
    const batches: string[][] = [];
    for (let i = 0; i < unmappedOrderNos.length; i += BATCH_SIZE) {
      batches.push(unmappedOrderNos.slice(i, i + BATCH_SIZE));
    }

    const foundTrackingMappings: Array<{ orderNo: string; awb: string; carrier: string }> = [];
    const errors: string[] = [];

    // Process up to 3 batches concurrently
    const CONCURRENCY = 3;
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const slice = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        slice.map(async (batch, idx) => {
          const batchIndex = i + idx + 1;
          console.log(`[Tracking Lookup Service] Requesting batch ${batchIndex}/${batches.length} (${batch.length} orders)...`);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderNumbers: batch })
          });

          if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
          }

          const data: TrackingLookupApiResponse = await response.json();
          return data;
        })
      );

      for (const res of results) {
        if (res.status === 'fulfilled') {
          const data = res.value;
          if (data && data.success && Array.isArray(data.orders)) {
            for (const item of data.orders) {
              if (item.has_tracking && item.tracking_code && item.tracking_code.trim()) {
                const cleanAwb = normalizeAwb(item.tracking_code);
                const cleanOrderNo = normalizeOrderNumber(item.order_no || item.receipt_id);
                if (cleanAwb && cleanOrderNo) {
                  foundTrackingMappings.push({
                    orderNo: cleanOrderNo,
                    awb: cleanAwb,
                    carrier: item.carrier_name || 'FedEx'
                  });
                }
              }
            }
          } else if (data && data.error) {
            errors.push(data.error);
          }
        } else {
          console.error(`[Tracking Lookup Service] Batch failed:`, res.reason);
          errors.push(res.reason?.message || 'Network error');
        }
      }
    }

    console.log(`[Tracking Lookup Service] Found ${foundTrackingMappings.length} tracking codes.`);

    // Step 3: Insert new mappings & recalculate clubbed allocations & FedEx allocations
    let clubbedCount = 0;
    await executeTransaction(async (conn) => {
      // 3a. Save new mappings to order_awb_mapping
      for (const mapping of foundTrackingMappings) {
        await executePreparedStatement(
          conn,
          `INSERT INTO order_awb_mapping (order_no, awb_number, source)
           VALUES (?, ?, 'Tracking API')
           ON CONFLICT (order_no, awb_number) DO NOTHING;`,
          [mapping.orderNo, mapping.awb]
        );

        // Ensure order exists in canonical orders table
        await executePreparedStatement(
          conn,
          `INSERT INTO orders (order_no, sale_date, product_description, order_source, sales_source)
           VALUES (?, NULL, 'Shopify Order', 'SHOPIFY', 'NONE')
           ON CONFLICT (order_no) DO NOTHING;`,
          [mapping.orderNo]
        );
      }

      // 3b. Re-allocate FedEx billing costs for all mapped orders
      await TrackingLookupService.reallocateFedexCosts(conn);

      // 3c. Calculate Clubbed Order Material Cost Allocations
      clubbedCount = await TrackingLookupService.recalculateClubbedAllocations(conn);

      // 3d. Update sync_metadata
      await executePreparedStatement(
        conn,
        `UPDATE sync_metadata 
         SET last_sync_at = CURRENT_TIMESTAMP, 
             status = 'COMPLETED', 
             last_processed_row = ?
         WHERE sync_name = 'tracking_lookup';`,
        [foundTrackingMappings.length]
      );
    });

    return {
      success: true,
      message: `Tracking lookup finished. Found ${foundTrackingMappings.length} tracking codes, updated ${clubbedCount} clubbed order allocations.`,
      unmappedCount: unmappedOrderNos.length,
      lookupAttempted: unmappedOrderNos.length,
      trackingFound: foundTrackingMappings.length,
      clubbedOrdersCount: clubbedCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Reallocates FedEx billing costs across all current mapped AWBs without external API dependencies.
   */
  static async reallocateFedexCosts(conn: Connection): Promise<void> {
    // 1. Fetch all billing rows
    const billingRows = await new Promise<any[]>((resolve, reject) => {
      conn.all(
        `SELECT awb_number, air_waybill_total_amount FROM fedex_billing`,
        (err, res) => err ? reject(err) : resolve((res as any) || [])
      );
    });

    if (!billingRows || billingRows.length === 0) return;

    // Aggregate billing by AWB
    const billingByAwb = new Map<string, number>();
    for (const row of billingRows) {
      const awb = normalizeAwb(row.awb_number);
      if (!awb) continue;
      const amt = Number(row.air_waybill_total_amount) || 0;
      billingByAwb.set(awb, (billingByAwb.get(awb) || 0) + amt);
    }

    // 2. Fetch all order AWB mappings
    const mappingRows = await new Promise<any[]>((resolve, reject) => {
      conn.all(
        `SELECT order_no, awb_number FROM order_awb_mapping WHERE awb_number IS NOT NULL AND awb_number != ''`,
        (err, res) => err ? reject(err) : resolve((res as any) || [])
      );
    });

    const awbToOrders = new Map<string, Set<string>>();
    for (const row of mappingRows) {
      const awb = normalizeAwb(row.awb_number);
      const orderNo = normalizeOrderNumber(row.order_no);
      if (!awb || !orderNo) continue;
      if (!awbToOrders.has(awb)) {
        awbToOrders.set(awb, new Set());
      }
      awbToOrders.get(awb)!.add(orderNo);
    }

    // 3. Calculate allocations
    const allocations: Array<{ order_no: string; awb_number: string; allocated_cost: number; air_waybill_total_amount: number }> = [];

    for (const [awb, totalAmount] of billingByAwb.entries()) {
      const totalAwbCost = Math.round(totalAmount * 100) / 100;
      const mappedOrdersSet = awbToOrders.get(awb);
      const mappedOrders = mappedOrdersSet ? Array.from(mappedOrdersSet).sort() : [];
      const numOrders = mappedOrders.length;

      if (numOrders > 0) {
        const standardShare = Math.floor((totalAwbCost / numOrders) * 100) / 100;
        let runningSum = 0;

        for (let i = 0; i < numOrders; i++) {
          const orderNo = mappedOrders[i];
          let share = standardShare;
          if (i === numOrders - 1) {
            share = Math.round((totalAwbCost - runningSum) * 100) / 100;
          }
          allocations.push({
            order_no: orderNo,
            awb_number: awb,
            allocated_cost: share,
            air_waybill_total_amount: totalAwbCost
          });
          runningSum = Math.round((runningSum + share) * 100) / 100;
        }
      }
    }

    // 4. Atomically replace order_fedex_allocations
    await new Promise<void>((resolve, reject) => {
      conn.run(`DELETE FROM order_fedex_allocations;`, (err) => err ? reject(err) : resolve());
    });

    const CHUNK_SIZE = 300;
    for (let i = 0; i < allocations.length; i += CHUNK_SIZE) {
      const chunk = allocations.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
      const params = chunk.flatMap(c => [c.order_no, c.awb_number, c.allocated_cost, c.air_waybill_total_amount]);
      await executePreparedStatement(
        conn,
        `INSERT INTO order_fedex_allocations (order_no, awb_number, allocated_cost, air_waybill_total_amount)
         VALUES ${placeholders};`,
        params
      );
    }
  }

  /**
   * Recalculates material cost allocation for all clubbed orders (AWBs with >= 2 orders mapped).
   */
  static async recalculateClubbedAllocations(conn: Connection): Promise<number> {
    // 1. Fetch all AWB mappings
    const mappings = await new Promise<Array<{ order_no: string; awb_number: string }>>((resolve, reject) => {
      conn.all(
        `SELECT order_no, awb_number FROM order_awb_mapping WHERE awb_number IS NOT NULL AND awb_number != ''`,
        (err, res) => err ? reject(err) : resolve((res as any) || [])
      );
    });

    // Group orders by AWB
    const awbToOrders = new Map<string, Set<string>>();
    for (const m of mappings) {
      const awb = normalizeAwb(m.awb_number);
      const orderNo = normalizeOrderNumber(m.order_no);
      if (!awb || !orderNo) continue;
      if (!awbToOrders.has(awb)) {
        awbToOrders.set(awb, new Set());
      }
      awbToOrders.get(awb)!.add(orderNo);
    }

    // 2. Clear previous clubbed allocations
    await new Promise<void>((resolve, reject) => {
      conn.run(`DELETE FROM order_clubbed_allocations;`, (err) => err ? reject(err) : resolve());
    });

    let totalClubbedOrders = 0;
    const clubbedAllocationsToInsert: Array<{
      order_no: string;
      awb_number: string;
      clubbed_order_count: number;
      allocated_material_cost: number;
      is_clubbed: boolean;
      calculation_method: string;
    }> = [];

    // 3. For each AWB with multiple orders (N >= 2)
    for (const [awb, ordersSet] of awbToOrders.entries()) {
      const orderNos = Array.from(ordersSet);
      if (orderNos.length < 2) {
        continue; // Not a clubbed order
      }

      const N = orderNos.length;

      // Query inventory table for all orders under this AWB
      const placeholders = orderNos.map(() => '?').join(', ');
      const inventoryRows = await new Promise<Array<{ order_no: string; material_cost: number }>>((resolve, reject) => {
        conn.all(
          `SELECT order_no, 
                  COALESCE(SUM(CASE WHEN UPPER(material_type) = 'COTTON' THEN quantity * 90 ELSE quantity * 100 END), 0) AS material_cost
           FROM inventory_table
           WHERE order_no IN (${placeholders})
           GROUP BY order_no`,
          ...orderNos,
          (err: Error | null, res: any) => err ? reject(err) : resolve((res as any) || [])
        );
      });

      const totalInventoryMaterialCost = inventoryRows.reduce((sum, r) => sum + (Number(r.material_cost) || 0), 0);

      if (totalInventoryMaterialCost > 0) {
        // Rule A: Found >= 1 order in inventory DB with material cost -> Split equally across all N orders
        const splitCost = Math.round((totalInventoryMaterialCost / N) * 100) / 100;
        for (const orderNo of orderNos) {
          clubbedAllocationsToInsert.push({
            order_no: orderNo,
            awb_number: awb,
            clubbed_order_count: N,
            allocated_material_cost: splitCost,
            is_clubbed: true,
            calculation_method: 'INVENTORY_SPLIT'
          });
          totalClubbedOrders++;
        }
      } else {
        // Rule B: Found 0 orders in inventory DB -> Material Cost = Sales Amount / 9 (or usd_value * 9)
        const salesRows = await new Promise<Array<{ order_no: string; sales: number; usd_value: number }>>((resolve, reject) => {
          conn.all(
            `SELECT order_no, sales, usd_value 
             FROM v_order_sales 
             WHERE order_no IN (${placeholders})`,
            ...orderNos,
            (err: Error | null, res: any) => err ? reject(err) : resolve((res as any) || [])
          );
        });

        const salesMap = new Map<string, { sales: number; usd_value: number }>();
        for (const sr of salesRows) {
          salesMap.set(sr.order_no, {
            sales: Number(sr.sales) || 0,
            usd_value: Number(sr.usd_value) || 0
          });
        }

        for (const orderNo of orderNos) {
          const s = salesMap.get(orderNo);
          let calcCost = 0;
          if (s && s.usd_value > 0) {
            calcCost = Math.round((s.usd_value * 9.0) * 100) / 100;
          } else if (s && s.sales > 0) {
            calcCost = Math.round((s.sales / 9.0) * 100) / 100;
          }

          clubbedAllocationsToInsert.push({
            order_no: orderNo,
            awb_number: awb,
            clubbed_order_count: N,
            allocated_material_cost: calcCost,
            is_clubbed: true,
            calculation_method: 'SALES_DIV_9'
          });
          totalClubbedOrders++;
        }
      }
    }

    // 4. Batch insert into order_clubbed_allocations
    const CHUNK_SIZE = 200;
    for (let i = 0; i < clubbedAllocationsToInsert.length; i += CHUNK_SIZE) {
      const chunk = clubbedAllocationsToInsert.slice(i, i + CHUNK_SIZE);
      const valPlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const params = chunk.flatMap(c => [
        c.order_no,
        c.awb_number,
        c.clubbed_order_count,
        c.allocated_material_cost,
        c.is_clubbed,
        c.calculation_method
      ]);

      await executePreparedStatement(
        conn,
        `INSERT INTO order_clubbed_allocations (order_no, awb_number, clubbed_order_count, allocated_material_cost, is_clubbed, calculation_method)
         VALUES ${valPlaceholders};`,
        params
      );
    }

    console.log(`[Tracking Lookup Service] Stored ${clubbedAllocationsToInsert.length} clubbed order allocations.`);
    return totalClubbedOrders;
  }
}
