// services/listingAllocation.ts
// Handles the allocation of Etsy-level expenses (like Listing Fees and Etsy Ads) equally among eligible orders.

import type { Connection } from 'duckdb';
import { executePreparedStatement } from '@/database';
import { EtsyTransactionRecord } from '@/types';
import { ETSY_TRANSACTION_SCOPES } from '@/config/appConfig';

/**
 * Allocates Etsy-level expenses equally among eligible orders (newly imported sales).
 * Eligible orders are sales from the current upload that have NEVER received an allocation.
 * 
 * Runs WITHIN an existing transaction — does not manage its own transaction.
 */
export async function allocateEtsyLevelExpenses(
  conn: Connection,
  importId: number,
  newTransactions: EtsyTransactionRecord[],
  uniqueSaleOrderNos: string[]
): Promise<{ groups: number; allocations: number }> {
  // 1. Filter out ETSY scope transactions
  const etsyLevelTx = newTransactions.filter(t => t.transaction_scope === ETSY_TRANSACTION_SCOPES.ETSY && t.transaction_category !== 'DEPOSIT');
  
  if (etsyLevelTx.length === 0 || uniqueSaleOrderNos.length === 0) {
    return { groups: 0, allocations: 0 };
  }

  // 2. Find eligible orders (those that have NEVER been allocated before)
  const orderList = uniqueSaleOrderNos.map(o => `'${o.replace(/'/g, "''")}'`).join(',');
  const previouslyAllocatedQuery = `
    SELECT DISTINCT order_no 
    FROM etsy_order_allocations 
    WHERE order_no IN (${orderList})
  `;
  const previouslyAllocated = await new Promise<any[]>((resolve, reject) => {
    conn.all(previouslyAllocatedQuery, (err: any, rows: any) => err ? reject(err) : resolve(rows || []));
  });
  const previouslyAllocatedSet = new Set(previouslyAllocated.map(r => r.order_no));
  
  const eligibleOrders = uniqueSaleOrderNos.filter(orderNo => !previouslyAllocatedSet.has(orderNo)).sort();

  // 3. Group by category
  const groupsByCategory = new Map<string, { totalAmount: number; minDate: string; maxDate: string }>();
  
  for (const tx of etsyLevelTx) {
    const amt = tx.net_amount !== undefined ? tx.net_amount : (tx.amount || 0);
    const cat = tx.transaction_category;
    
    if (!groupsByCategory.has(cat)) {
      groupsByCategory.set(cat, { totalAmount: 0, minDate: tx.transaction_date, maxDate: tx.transaction_date });
    }
    const group = groupsByCategory.get(cat)!;
    group.totalAmount += amt;
    if (tx.transaction_date < group.minDate) group.minDate = tx.transaction_date;
    if (tx.transaction_date > group.maxDate) group.maxDate = tx.transaction_date;
  }

  let allocationsCreated = 0;

  for (const [category, groupData] of groupsByCategory.entries()) {
    // Pool amount is the absolute value of the total net amount, representing the total expense.
    const poolAmount = Math.abs(groupData.totalAmount); 
    if (poolAmount === 0 || eligibleOrders.length === 0) continue;

    const allocationBatchId = `batch_${importId}_${category}`;
    
    // Create batch
    const batchInsertQuery = `
      INSERT INTO etsy_allocation_batches (
        allocation_batch_id, expense_type, pool_amount, eligible_order_count, allocated_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    await executePreparedStatement(conn, batchInsertQuery, [
      allocationBatchId, category, poolAmount, eligibleOrders.length, poolAmount, 'COMPLETED'
    ]);

    // Calculate exact split
    const allocationPerOrder = Math.floor((poolAmount / eligibleOrders.length) * 100) / 100;
    let remainder = Math.round((poolAmount - (allocationPerOrder * eligibleOrders.length)) * 100) / 100;

    const CHUNK_SIZE = 1000;
    for (let i = 0; i < eligibleOrders.length; i += CHUNK_SIZE) {
      const chunk = eligibleOrders.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(',');
      
      const values = chunk.flatMap((orderNo, idx) => {
        let amount = allocationPerOrder;
        // Assign remainder to the very last order
        if (i + idx === eligibleOrders.length - 1) {
          amount = Math.round((amount + remainder) * 100) / 100;
        }
        const allocationId = `${allocationBatchId}_${orderNo}`;
        return [allocationId, allocationBatchId, orderNo, amount];
      });

      const allocInsertQuery = `
        INSERT INTO etsy_order_allocations (allocation_id, allocation_batch_id, order_no, amount)
        VALUES ${placeholders}
      `;
      
      await executePreparedStatement(conn, allocInsertQuery, values);
      allocationsCreated += chunk.length;
    }
  }

  return { groups: groupsByCategory.size, allocations: allocationsCreated };
}
