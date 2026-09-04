import type { Connection } from 'duckdb';
import { fetchQuery, executeTransaction, executePreparedStatement, getConnection } from '@/database';
import { shipmentApi } from '@/services/shipmentApi';
import { normalizeAwb, normalizeOrderNumber } from '@/utils/normalization';

export interface ReconciliationStats {
  billingRecords: number;
  csvMappings: number;
  apiMappings: number;
  combinedMappings: number;
  matchedBillingAwbs: number;
  unmatchedBillingAwbs: number;
  allocationRows: number;
  reconciliationPassed: boolean;
}

export interface FedExDiagnostics extends ReconciliationStats {
  totalBillingRecords: number;
  totalUniqueBillingAwbs: number;
  totalOrderAwbMappings: number;
  totalUniqueMappingAwbs: number;
  matchedByAwbCount: number;
  unmatchedCount: number;
  totalAllocatedOrders: number;
  totalAllocatedAmount: number;
  sampleUnmatchedAwbs: string[];
  conflicts: Array<{
    awb: string;
    expectedCost: number;
    allocatedCost: number;
    diff: number;
  }>;
}

export interface SyncMappingResult {
  success: boolean;
  message: string;
  billingRecords?: number;
  csvMappings?: number;
  apiMappings?: number;
  combinedMappings?: number;
  matchedBillingAwbs?: number;
  unmatchedBillingAwbs?: number;
  allocationRows?: number;
  reconciliationPassed?: boolean;
  diagnostics?: FedExDiagnostics;
  [key: string]: any;
}

/**
 * Core mapping and allocation engine.
 * Can run within an existing transaction connection or initiate a new transaction.
 */
export const runMappingAndAllocation = async (conn: Connection): Promise<SyncMappingResult> => {
  // 1. Validate date range configuration per Section 4 & 7
  const fromDateStr = process.env.FEDEX_MAPPING_FROM?.trim();
  const toDateStr = process.env.FEDEX_MAPPING_TO?.trim();

  if (!fromDateStr || !toDateStr) {
    throw new Error('Configuration error: FEDEX_MAPPING_FROM and FEDEX_MAPPING_TO environment variables must be defined.');
  }

  console.log(`[FedEx Mapping Service] Requesting shipments from ${fromDateStr} to ${toDateStr}`);

  // 2. Fetch all current billing records
  const billingRows = await new Promise<any[]>((resolve, reject) => {
    conn.all(
      `SELECT id, awb_number, air_waybill_total_amount, order_no, country, shipper_reference_1, parsed_order_no, recipient_country 
       FROM fedex_billing`,
      (err, res) => err ? reject(err) : resolve(res || [])
    );
  });

  if (!billingRows || billingRows.length === 0) {
    return {
      success: false,
      message: 'No FedEx billing records found in database to map.'
    };
  }

  // 3. Extract mappings from Source 1 (FedEx Billing CSV)
  // Key: "order_no|awb_number"
  const csvMappings = new Map<string, { orderNo: string; awb: string }>();
  for (const row of billingRows) {
    const awb = normalizeAwb(row.awb_number);
    let orderNo = row.order_no ? normalizeOrderNumber(row.order_no) : '';
    if (!orderNo && row.parsed_order_no) {
      orderNo = normalizeOrderNumber(row.parsed_order_no);
    }
    if (!orderNo && row.shipper_reference_1) {
      orderNo = normalizeOrderNumber(row.shipper_reference_1);
    }
    if (awb && orderNo) {
      const key = `${orderNo}|${awb}`;
      if (!csvMappings.has(key)) {
        csvMappings.set(key, { orderNo, awb });
      }
    }
  }

  // 4. Fetch mappings from Source 2 (Shipment API)
  const apiMappings = new Map<string, { orderNo: string; awb: string }>();
  try {
    const shipmentRes = await shipmentApi.getDashboardShipments(fromDateStr, toDateStr);
    if (shipmentRes.success && shipmentRes.data) {
      const { ordersToAWBMappingObj, awbToOrderMappingObj } = shipmentRes.data;

      if (ordersToAWBMappingObj) {
        for (const [orderNoRaw, awbsRaw] of Object.entries(ordersToAWBMappingObj)) {
          const orderNo = normalizeOrderNumber(orderNoRaw);
          if (orderNo && Array.isArray(awbsRaw)) {
            for (const awbRaw of awbsRaw) {
              const awb = normalizeAwb(awbRaw);
              if (awb) {
                const key = `${orderNo}|${awb}`;
                apiMappings.set(key, { orderNo, awb });
              }
            }
          }
        }
      }

      if (awbToOrderMappingObj) {
        for (const [awbRaw, ordersRaw] of Object.entries(awbToOrderMappingObj)) {
          const awb = normalizeAwb(awbRaw);
          if (awb && Array.isArray(ordersRaw)) {
            for (const orderNoRaw of ordersRaw) {
              const orderNo = normalizeOrderNumber(orderNoRaw);
              if (orderNo) {
                const key = `${orderNo}|${awb}`;
                apiMappings.set(key, { orderNo, awb });
              }
            }
          }
        }
      }
    } else {
      console.warn(`[FedEx Mapping Service] External shipment API fetch returned unsuccessful: ${shipmentRes.message}`);
    }
  } catch (apiErr: any) {
    console.warn(`[FedEx Mapping Service] External shipment API fetch failed, proceeding with CSV mappings: ${apiErr?.message}`);
  }

  // 5. Combine and Deduplicate (Source 1 + Source 2) with explicit Source Tracking
  const combinedMappings = new Map<string, { orderNo: string; awb: string; source: string }>();
  for (const [k, v] of csvMappings.entries()) {
    const isAlsoInApi = apiMappings.has(k);
    combinedMappings.set(k, {
      ...v,
      source: isAlsoInApi ? 'Shipment API & FedEx CSV' : 'FedEx Billing CSV'
    });
  }
  for (const [k, v] of apiMappings.entries()) {
    if (!combinedMappings.has(k)) {
      combinedMappings.set(k, {
        ...v,
        source: 'Shipment API'
      });
    }
  }

  // 6. Atomically replace order_awb_mapping
  await new Promise<void>((resolve, reject) => {
    conn.run(`DELETE FROM order_awb_mapping;`, (err) => err ? reject(err) : resolve());
  });

  const mappingValues = Array.from(combinedMappings.values());
  const CHUNK_SIZE = 300;

  for (let i = 0; i < mappingValues.length; i += CHUNK_SIZE) {
    const chunk = mappingValues.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '(?, ?, ?)').join(', ');
    const params = chunk.flatMap(c => [c.orderNo, c.awb, c.source]);
    await executePreparedStatement(
      conn,
      `INSERT INTO order_awb_mapping (order_no, awb_number, source)
       VALUES ${placeholders};`,
      params
    );
  }

  // 6b. Ensure external orders exist in the canonical `orders` master table
  // Deduplicate orders first so no duplicate keys in the same batch insert
  const uniqueExternalOrders = new Map<string, string>();
  for (const { orderNo, source } of combinedMappings.values()) {
    if (!uniqueExternalOrders.has(orderNo)) {
      uniqueExternalOrders.set(orderNo, source);
    }
  }

  const orderEntries = Array.from(uniqueExternalOrders.entries());
  for (let i = 0; i < orderEntries.length; i += CHUNK_SIZE) {
    const chunk = orderEntries.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '(?, NULL, \'External Order\', ?, \'NONE\')').join(', ');
    const params = chunk.flatMap(([orderNo, source]) => [orderNo, source]);
    await executePreparedStatement(
      conn,
      `INSERT INTO orders (order_no, sale_date, product_description, order_source, sales_source)
       VALUES ${placeholders}
       ON CONFLICT (order_no) DO NOTHING;`,
      params
    );
  }

  // Build lookup: awb -> Set<orderNo>
  const awbToOrders = new Map<string, Set<string>>();
  for (const { orderNo, awb } of combinedMappings.values()) {
    if (!awbToOrders.has(awb)) {
      awbToOrders.set(awb, new Set());
    }
    awbToOrders.get(awb)!.add(orderNo);
  }

  // 7. Aggregate billing records by AWB
  interface AwbBillingAgg {
    awb: string;
    totalAmount: number;
    rowsCount: number;
  }
  const billingByAwb = new Map<string, AwbBillingAgg>();

  for (const row of billingRows) {
    const awb = normalizeAwb(row.awb_number);
    if (!awb) continue;
    const amount = Number(row.air_waybill_total_amount) || 0;

    if (!billingByAwb.has(awb)) {
      billingByAwb.set(awb, { awb, totalAmount: 0, rowsCount: 0 });
    }
    const agg = billingByAwb.get(awb)!;
    agg.totalAmount += amount;
    agg.rowsCount += 1;
  }

  // 8. Cost Allocation Engine (Section 9, 10, 11)
  interface AllocationItem {
    order_no: string;
    awb_number: string;
    allocated_cost: number;
    air_waybill_total_amount: number;
  }

  const allocations: AllocationItem[] = [];
  const conflicts: Array<{ awb: string; expectedCost: number; allocatedCost: number; diff: number }> = [];
  const sampleUnmatchedAwbs: string[] = [];
  let matchedBillingAwbs = 0;
  let unmatchedBillingAwbs = 0;
  let totalAllocatedAmount = 0;

  for (const [awb, billing] of billingByAwb.entries()) {
    const totalAwbCost = Math.round(billing.totalAmount * 100) / 100;
    const mappedOrdersSet = awbToOrders.get(awb);
    const mappedOrders = mappedOrdersSet ? Array.from(mappedOrdersSet).sort() : [];
    const numOrders = mappedOrders.length;

    if (numOrders > 0) {
      matchedBillingAwbs++;
      // Equal split with deterministic remainder penny on the last order
      const standardShare = Math.floor((totalAwbCost / numOrders) * 100) / 100;
      let runningSum = 0;

      for (let i = 0; i < numOrders; i++) {
        const orderNo = mappedOrders[i];
        let share = standardShare;
        if (i === numOrders - 1) {
          // Remainder penny goes to final order
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

      totalAllocatedAmount += runningSum;

      // Validation check: Sum of allocations must equal AWB total within 0.01 tolerance
      const diff = Math.abs(runningSum - totalAwbCost);
      if (diff > 0.01) {
        console.error(`[FedEx Allocation Error] AWB ${awb}: Sum of allocations (${runningSum}) != Total cost (${totalAwbCost})`);
        conflicts.push({
          awb,
          expectedCost: totalAwbCost,
          allocatedCost: runningSum,
          diff
        });
      }
    } else {
      unmatchedBillingAwbs++;
      if (sampleUnmatchedAwbs.length < 10) {
        sampleUnmatchedAwbs.push(awb);
      }
    }
  }

  const reconciliationPassed = conflicts.length === 0;

  if (!reconciliationPassed) {
    console.error(`[FedEx Allocation] Reconciliation failed for ${conflicts.length} AWBs.`);
  }

  // 9. Atomically replace order_fedex_allocations
  await new Promise<void>((resolve, reject) => {
    conn.run(`DELETE FROM order_fedex_allocations;`, (err) => err ? reject(err) : resolve());
  });

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

  // 10. Update sync_metadata for fedex_mapping
  const syncStatus = reconciliationPassed ? 'COMPLETED' : 'FAILED';
  const now = new Date();
  const updateSyncMetaQuery = `
    INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at, status)
    VALUES ('fedex_mapping', ?, ?, ?)
    ON CONFLICT (sync_name) DO UPDATE SET
      last_processed_row = ?,
      last_sync_at = ?,
      status = ?;
  `;
  await executePreparedStatement(conn, updateSyncMetaQuery, [
    allocations.length,
    now,
    syncStatus,
    allocations.length,
    now,
    syncStatus
  ]);

  const uniqueAllocatedOrders = new Set(allocations.map(a => a.order_no));

  const diagnostics: FedExDiagnostics = {
    billingRecords: billingRows.length,
    csvMappings: csvMappings.size,
    apiMappings: apiMappings.size,
    combinedMappings: combinedMappings.size,
    matchedBillingAwbs,
    unmatchedBillingAwbs,
    allocationRows: allocations.length,
    reconciliationPassed,
    totalBillingRecords: billingRows.length,
    totalUniqueBillingAwbs: billingByAwb.size,
    totalOrderAwbMappings: combinedMappings.size,
    totalUniqueMappingAwbs: awbToOrders.size,
    matchedByAwbCount: matchedBillingAwbs,
    unmatchedCount: unmatchedBillingAwbs,
    totalAllocatedOrders: uniqueAllocatedOrders.size,
    totalAllocatedAmount: Math.round(totalAllocatedAmount * 100) / 100,
    sampleUnmatchedAwbs,
    conflicts
  };

  console.log(`[FedEx Mapping] Completed. Billing records: ${billingRows.length}, Combined mappings: ${combinedMappings.size}, Matched AWBs: ${matchedBillingAwbs}, Unmatched AWBs: ${unmatchedBillingAwbs}, Allocations: ${allocations.length}`);

  return {
    success: true,
    billingRecords: billingRows.length,
    csvMappings: csvMappings.size,
    apiMappings: apiMappings.size,
    combinedMappings: combinedMappings.size,
    matchedBillingAwbs,
    unmatchedBillingAwbs,
    allocationRows: allocations.length,
    reconciliationPassed,
    message: `FedEx mapping and allocation complete. ${allocations.length} allocations created across ${uniqueAllocatedOrders.size} orders.`,
    diagnostics
  };
};

/**
 * Public function to sync mappings and allocations.
 */
export const syncMappings = async (): Promise<SyncMappingResult> => {
  const conn = await getConnection();
  try {
    return await runMappingAndAllocation(conn);
  } finally {
    try { conn.close(); } catch (e) {}
  }
};

/**
 * Public diagnostics query for GET /api/fedex/status.
 */
export const getFedExDiagnostics = async (): Promise<FedExDiagnostics> => {
  const billingRes = await fetchQuery<{ total: number; unique_awbs: number }>(`
    SELECT COUNT(*) as total, COUNT(DISTINCT awb_number) as unique_awbs FROM fedex_billing
  `);
  const mappingRes = await fetchQuery<{ total: number; unique_awbs: number }>(`
    SELECT COUNT(*) as total, COUNT(DISTINCT awb_number) as unique_awbs FROM order_awb_mapping
  `);
  const allocRes = await fetchQuery<{
    total_allocations: number;
    total_orders: number;
    total_cost: number;
    unique_awbs: number;
  }>(`
    SELECT 
      COUNT(*) as total_allocations,
      COUNT(DISTINCT order_no) as total_orders,
      COALESCE(SUM(allocated_cost), 0) as total_cost,
      COUNT(DISTINCT awb_number) as unique_awbs
    FROM order_fedex_allocations
  `);

  const billingTotal = Number(billingRes[0]?.total || 0);
  const billingAwbs = Number(billingRes[0]?.unique_awbs || 0);
  const mappingTotal = Number(mappingRes[0]?.total || 0);
  const mappingAwbs = Number(mappingRes[0]?.unique_awbs || 0);

  const totalAllocations = Number(allocRes[0]?.total_allocations || 0);
  const allocatedOrders = Number(allocRes[0]?.total_orders || 0);
  const allocatedAmount = Number(allocRes[0]?.total_cost || 0);
  const allocatedAwbs = Number(allocRes[0]?.unique_awbs || 0);

  const unmatchedAwbs = Math.max(0, billingAwbs - allocatedAwbs);

  return {
    billingRecords: billingTotal,
    csvMappings: mappingTotal,
    apiMappings: 0,
    combinedMappings: mappingTotal,
    matchedBillingAwbs: allocatedAwbs,
    unmatchedBillingAwbs: unmatchedAwbs,
    allocationRows: totalAllocations,
    reconciliationPassed: true,
    totalBillingRecords: billingTotal,
    totalUniqueBillingAwbs: billingAwbs,
    totalOrderAwbMappings: mappingTotal,
    totalUniqueMappingAwbs: mappingAwbs,
    matchedByAwbCount: allocatedAwbs,
    unmatchedCount: unmatchedAwbs,
    totalAllocatedOrders: allocatedOrders,
    totalAllocatedAmount: Math.round(allocatedAmount * 100) / 100,
    sampleUnmatchedAwbs: [],
    conflicts: []
  };
};
