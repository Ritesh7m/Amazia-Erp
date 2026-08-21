import type { Connection } from 'duckdb';
import { fetchQuery, executeTransaction, executePreparedStatement } from '@/database';
import { shipmentApi } from '@/services/shipmentApi';

function normalizeAwb(value: any): string {
  if (value == null) return '';
  let str = String(value).trim();
  // Remove accidental '.0' suffix that Excel/CSV parsing might add to numeric strings
  if (str.endsWith('.0')) {
    str = str.slice(0, -2);
  }
  return str;
}

export const syncMappings = async () => {
  try {
    // 1. Fetch relevant billing records
    const billingRecords = await fetchQuery<any>(
      `SELECT awb_number, air_waybill_total_amount, invoice_date FROM fedex_billing`
    );

    if (!billingRecords || billingRecords.length === 0) {
      return { success: false, message: 'No FedEx billing records found to sync.' };
    }

    const fromDateStr = process.env.FEDEX_MAPPING_FROM;
    const toDateStr = process.env.FEDEX_MAPPING_TO;

    if (!fromDateStr || !toDateStr) {
      console.error('[FedEx Mapping Service] Invalid FEDEX_MAPPING_FROM / FEDEX_MAPPING_TO configuration.');
      return { success: false, message: '[FedEx Mapping Service] Invalid FEDEX_MAPPING_FROM / FEDEX_MAPPING_TO configuration.' };
    }

    const fromDateObj = new Date(fromDateStr);
    const toDateObj = new Date(toDateStr);

    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime()) || fromDateObj.getTime() >= toDateObj.getTime()) {
      console.error('[FedEx Mapping Service] Invalid FEDEX_MAPPING_FROM / FEDEX_MAPPING_TO configuration.');
      return { success: false, message: '[FedEx Mapping Service] Invalid FEDEX_MAPPING_FROM / FEDEX_MAPPING_TO configuration.' };
    }

    const awbCosts: Record<string, number> = {};
    const sampleBillingAwbs: string[] = [];

    for (const record of billingRecords) {
      if (record.awb_number) {
        const awbStr = normalizeAwb(record.awb_number);
        awbCosts[awbStr] = Number(record.air_waybill_total_amount) || 0;
        
        if (sampleBillingAwbs.length < 10 && !sampleBillingAwbs.includes(awbStr)) {
          sampleBillingAwbs.push(awbStr);
        }
      }
    }

    console.log(`[FedEx Mapping Service] Configured mapping range:\nfrom = ${fromDateStr}\nto   = ${toDateStr}`);
    console.log(`[FedEx Mapping Service] Requesting shipments from ${fromDateStr} to ${toDateStr}`);
    console.log(`[FedEx Mapping Service] Sample billing AWBs:`, sampleBillingAwbs);

    const shipmentRes = await shipmentApi.getDashboardShipments(fromDateStr, toDateStr);
    
    if (!shipmentRes.success || !shipmentRes.data) {
      console.error(`[FedEx Mapping Service] Failed to fetch shipments: ${shipmentRes.message}`);
      return { success: false, message: shipmentRes.message || 'Failed to fetch shipment mappings.' };
    }

    const { ordersToAWBMappingObj, awbToOrderMappingObj } = shipmentRes.data;

    console.log(`[FedEx Mapping Service] API response keys:`, Object.keys(shipmentRes.data));
    console.log(`[FedEx Mapping Service] ordersToAWBMappingObj count:`, ordersToAWBMappingObj ? Object.keys(ordersToAWBMappingObj).length : 0);
    console.log(`[FedEx Mapping Service] awbToOrderMappingObj count:`, awbToOrderMappingObj ? Object.keys(awbToOrderMappingObj).length : 0);

    // Normalize and validate API responses
    const finalMappings = new Set<string>(); // "orderNo|awbNumber"
    const apiAwbsSet = new Set<string>();
    
    if (ordersToAWBMappingObj) {
      for (const [orderNoRaw, awbsRaw] of Object.entries(ordersToAWBMappingObj)) {
        const orderNo = String(orderNoRaw).trim();
        if (Array.isArray(awbsRaw)) {
          for (const awbRaw of awbsRaw) {
            const awb = normalizeAwb(awbRaw);
            if (awb) {
              finalMappings.add(`${orderNo}|${awb}`);
              apiAwbsSet.add(awb);
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
            const orderNo = String(orderNoRaw).trim();
            finalMappings.add(`${orderNo}|${awb}`);
            apiAwbsSet.add(awb);
          }
        }
      }
    }

    const apiAwbCount = apiAwbsSet.size;
    const sampleApiAwbs = Array.from(apiAwbsSet).slice(0, 10);
    console.log(`[FedEx Mapping Service] Sample API AWBs:`, sampleApiAwbs);

    const mappingRows = Array.from(finalMappings).map(m => {
      const parts = m.split('|');
      return { order_no: parts[0], awb_number: parts[1] };
    });

    // Calculate deterministic allocations
    // awb -> [order_no]
    const awbToMappedOrders: Record<string, string[]> = {};
    for (const row of mappingRows) {
      if (!awbToMappedOrders[row.awb_number]) {
        awbToMappedOrders[row.awb_number] = [];
      }
      awbToMappedOrders[row.awb_number].push(row.order_no);
    }

    const allocations: { order_no: string; awb_number: string; allocated_cost: number }[] = [];
    let reconciliationPassed = true;
    let matchedAwbsCount = 0;
    let unmatchedAwbsCount = 0;
    const sampleUnmatchedAwbs: string[] = [];

    for (const [awb, totalCost] of Object.entries(awbCosts)) {
      const mappedOrders = awbToMappedOrders[awb];
      
      if (!mappedOrders || mappedOrders.length === 0) {
        unmatchedAwbsCount++;
        if (sampleUnmatchedAwbs.length < 10) {
          sampleUnmatchedAwbs.push(awb);
        }
        continue;
      }
      
      matchedAwbsCount++;
      const numOrders = mappedOrders.length;
      
      // Deterministic rounding (e.g., 1000 / 3 = 333.33, 333.33, 333.34)
      const exactDiv = totalCost / numOrders;
      const roundedDiv = Math.round(exactDiv * 100) / 100;
      
      let currentAllocatedSum = 0;
      for (let i = 0; i < numOrders; i++) {
        const orderNo = mappedOrders[i];
        let allocated = roundedDiv;
        
        // For the last order, add the remainder to reconcile exactly
        if (i === numOrders - 1) {
          allocated = Math.round((totalCost - currentAllocatedSum) * 100) / 100;
        }
        
        allocations.push({
          order_no: orderNo,
          awb_number: awb,
          allocated_cost: allocated
        });
        
        currentAllocatedSum += allocated;
      }
      
      // Reconcile
      if (Math.abs(currentAllocatedSum - totalCost) > 0.01) {
        console.error(`[FedEx Mapping Service] RECONCILIATION FAILED for AWB ${awb}: Source=${totalCost}, Allocated=${currentAllocatedSum}`);
        reconciliationPassed = false;
      }
    }

    console.log(`[FedEx Mapping Service] Billing records: ${billingRecords.length}`);
    console.log(`[FedEx Mapping Service] API AWBs: ${apiAwbCount}`);
    console.log(`[FedEx Mapping Service] Matched AWBs: ${matchedAwbsCount}`);
    console.log(`[FedEx Mapping Service] Unmatched AWBs: ${unmatchedAwbsCount}`);
    
    if (unmatchedAwbsCount > 0) {
      console.log(`[FedEx Mapping Service] Sample unmatched AWBs:`, sampleUnmatchedAwbs);
    }

    const responseData = {
      billingRecords: billingRecords.length,
      apiAwbCount,
      matchedAwbs: matchedAwbsCount,
      unmatchedAwbs: unmatchedAwbsCount,
      mappingRows: mappingRows.length,
      newMappings: mappingRows.length,
      duplicateMappings: 0,
      allocatedOrders: allocations.length,
      reconciliationPassed,
      sampleBillingAwbs,
      sampleApiAwbs,
      sampleUnmatchedAwbs
    };

    if (billingRecords.length > 0 && matchedAwbsCount === 0) {
      console.error(`[FedEx Mapping Service] ZERO matched AWBs despite having billing records. Aborting upsert to prevent data corruption.`);
      return { 
        success: false, 
        message: 'Zero AWBs matched between FedEx Billing and Shipment API. Check logs for details.',
        ...responseData
      };
    }

    await executeTransaction(async (conn: Connection) => {
      // Upsert mappings
      const insertMappingQuery = `
        INSERT INTO order_awb_mapping (order_no, awb_number)
        VALUES (?, ?)
        ON CONFLICT (order_no, awb_number) DO NOTHING
      `;

      for (const row of mappingRows) {
        await executePreparedStatement(conn, insertMappingQuery, [row.order_no, row.awb_number]);
      }

      // Upsert allocations
      await executePreparedStatement(conn, `DELETE FROM order_fedex_allocations`, []);
      
      const insertAllocationQuery = `
        INSERT INTO order_fedex_allocations (order_no, awb_number, allocated_cost)
        VALUES (?, ?, ?)
      `;

      for (const alloc of allocations) {
        await executePreparedStatement(conn, insertAllocationQuery, [alloc.order_no, alloc.awb_number, alloc.allocated_cost]);
      }

      // Sync Metadata
      const syncMetaQuery = `
        UPDATE sync_metadata 
        SET last_processed_row = ?, last_sync_at = ?
        WHERE sync_name = 'fedex_billing'
      `;
      await executePreparedStatement(conn, syncMetaQuery, [billingRecords.length, new Date().toISOString()]);
    });

    console.log(`[FedEx Mapping Service] Sync completed successfully.`);

    return {
      success: true,
      ...responseData
    };

  } catch (error: any) {
    console.error('[FedEx Mapping Service] Error during mapping sync:', error);
    return { success: false, message: error?.message || 'Database Error. Transaction rolled back.' };
  }
};
