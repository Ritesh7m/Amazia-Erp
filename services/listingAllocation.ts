// services/listingAllocation.ts
// Handles the allocation of Etsy listing fees equally among eligible orders.

import type { Connection } from 'duckdb';
import { executePreparedStatement, fetchQuery } from '@/database';
import { EtsyExpenseRecord } from '@/types';
import { ETSY_EXPENSE_TYPES } from '@/config/appConfig';

/**
 * Allocates listing expenses equally among eligible orders that have not
 * previously received a listing allocation.
 * 
 * Runs WITHIN an existing transaction — does not manage its own transaction.
 * 
 * @param conn - Active DuckDB connection within a transaction
 * @param expenseRecords - All expense records from the current import
 * @param saleOrderNos - All order numbers from sale records in this import batch
 * @param importReference - Unique identifier for this import (file hash)
 */
export async function allocateListingExpenses(
  conn: Connection,
  expenseRecords: EtsyExpenseRecord[],
  saleOrderNos: string[],
  importReference: string
): Promise<EtsyExpenseRecord[]> {
  // 1. Sum all LISTING_EXPENSE amounts from this batch
  const listingExpenses = expenseRecords.filter(
    e => e.expense_type === ETSY_EXPENSE_TYPES.LISTING_EXPENSE
  );

  const totalListingExpense = listingExpenses.reduce(
    (sum, e) => sum + e.expense_amount, 0
  );

  if (totalListingExpense <= 0 || saleOrderNos.length === 0) {
    return [];
  }

  // 2. Find which of these orders already have listing allocations
  const uniqueOrderNos = [...new Set(saleOrderNos.filter(o => o.length > 0))];
  
  if (uniqueOrderNos.length === 0) {
    return [];
  }

  // Build parameterized query for existing allocations using active connection
  const placeholders = uniqueOrderNos.map(() => '?').join(', ');
  const existingAllocations = await new Promise<{ order_no: string }[]>((resolve, reject) => {
    conn.all(
      `SELECT DISTINCT order_no FROM etsy_listing_allocations WHERE order_no IN (${placeholders})`,
      ...uniqueOrderNos,
      (err: Error | null, res: any) => {
        if (err) reject(err);
        else resolve((res || []) as { order_no: string }[]);
      }
    );
  });

  const alreadyAllocatedSet = new Set(existingAllocations.map(r => String(r.order_no)));

  // 3. Exclude previously-allocated orders
  const eligibleOrders = uniqueOrderNos.filter(o => !alreadyAllocatedSet.has(o));

  if (eligibleOrders.length === 0) {
    return [];
  }

  // 4. Divide equally among eligible orders
  const allocationPerOrder = Number((totalListingExpense / eligibleOrders.length).toFixed(2));

  // 5. Insert allocation records
  const allocationRecords: EtsyExpenseRecord[] = [];

  for (const orderNo of eligibleOrders) {
    // Record the allocation tracking
    await executePreparedStatement(conn,
      `INSERT INTO etsy_listing_allocations (order_no, allocation_amount, import_reference)
       VALUES (?, ?, ?)
       ON CONFLICT (order_no, import_reference) DO NOTHING`,
      [orderNo, allocationPerOrder, importReference]
    );

    // Create expense record for the allocated listing cost
    allocationRecords.push({
      order_no: orderNo,
      expense_type: ETSY_EXPENSE_TYPES.LISTING_EXPENSE,
      expense_amount: allocationPerOrder,
      source_transaction_type: 'Allocation',
      source_description: `Listing fee allocation: ₹${totalListingExpense} / ${eligibleOrders.length} orders`,
      listing_id: null,
      import_reference: importReference,
    });
  }

  return allocationRecords;
}
