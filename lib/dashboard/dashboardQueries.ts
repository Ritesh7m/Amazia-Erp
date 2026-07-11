// lib/dashboard/dashboardQueries.ts

import { fetchQuery } from '@/database';

// Centralized material cost multiplier
const MATERIAL_COST_RATE = 250;

/**
 * Fetch total sales within date range.
 */
export async function getTotalSales(
  startDate: string,
  endDate: string
): Promise<number> {
  const query = `
    SELECT COALESCE(SUM(net_amt), 0) AS total_sales
    FROM etsy_statement
    WHERE date >= ? AND date <= ?
  `;

  const result = await fetchQuery<{ total_sales: number }>(query, [
    startDate,
    endDate,
  ]);

  return result[0]?.total_sales || 0;
}

/**
 * Fetch total FedEx expenses within date range.
 */
export async function getFedExExpenses(
  startDate: string,
  endDate: string
): Promise<number> {
  const query = `
    SELECT COALESCE(SUM(book_expense_cost), 0) AS total_fedex
    FROM fedex_billing
    WHERE invoice_date >= ? AND invoice_date <= ?
  `;

  const result = await fetchQuery<{ total_fedex: number }>(query, [
    startDate,
    endDate,
  ]);

  return result[0]?.total_fedex || 0;
}

/**
 * Fetch total material expenses within date range.
 */
export async function getMaterialExpenses(
  startDate: string,
  endDate: string
): Promise<number> {
  const query = `
    SELECT COALESCE(SUM(i.quantity * ?), 0) AS total_material_cost
    FROM etsy_statement e
    JOIN inventory_table i
      ON e.order_no = i.order_no
    WHERE e.date >= ? AND e.date <= ?
  `;

  const result = await fetchQuery<{ total_material_cost: number }>(query, [
    MATERIAL_COST_RATE,
    startDate,
    endDate,
  ]);

  return result[0]?.total_material_cost || 0;
}

/**
 * Fetch sync timestamps.
 */
export async function getSyncStatuses() {
  const query = `
    SELECT sync_name, last_sync_at
    FROM sync_metadata
  `;

  const historyQuery = `
    SELECT invoice_type, MAX(created_at) AS last_import_at
    FROM import_history
    WHERE status = 'SUCCESS'
    GROUP BY invoice_type
  `;

  const [syncData, importData] = await Promise.all([
    fetchQuery<{ sync_name: string; last_sync_at: string }>(query),
    fetchQuery<{ invoice_type: string; last_import_at: string }>(historyQuery),
  ]);

  return {
    inventory:
      syncData.find((s) => s.sync_name === 'inventory')?.last_sync_at || null,
    etsy:
      importData.find((i) => i.invoice_type === 'ETSY')?.last_import_at || null,
    fedex:
      importData.find((i) => i.invoice_type === 'FEDEX')?.last_import_at || null,
  };
}

/**
 * Fetch monthly grouped sales.
 */
export async function getMonthlySales(
  startDate: string,
  endDate: string
) {
  const query = `
    SELECT
      strftime(date, '%Y-%m') AS month,
      COALESCE(SUM(net_amt), 0) AS total
    FROM etsy_statement
    WHERE date >= ? AND date <= ?
    GROUP BY strftime(date, '%Y-%m')
    ORDER BY month
  `;

  return await fetchQuery<{ month: string; total: number }>(query, [
    startDate,
    endDate,
  ]);
}

/**
 * Fetch monthly grouped FedEx expenses.
 */
export async function getMonthlyFedEx(
  startDate: string,
  endDate: string
) {
  const query = `
    SELECT
      strftime(invoice_date, '%Y-%m') AS month,
      COALESCE(SUM(book_expense_cost), 0) AS total
    FROM fedex_billing
    WHERE invoice_date >= ? AND invoice_date <= ?
    GROUP BY strftime(invoice_date, '%Y-%m')
    ORDER BY month
  `;

  return await fetchQuery<{ month: string; total: number }>(query, [
    startDate,
    endDate,
  ]);
}

/**
 * Fetch monthly grouped material expenses.
 */
export async function getMonthlyMaterials(
  startDate: string,
  endDate: string
) {
  const query = `
    SELECT
      strftime(e.date, '%Y-%m') AS month,
      COALESCE(SUM(i.quantity * ?), 0) AS total
    FROM etsy_statement e
    JOIN inventory_table i
      ON e.order_no = i.order_no
    WHERE e.date >= ? AND e.date <= ?
    GROUP BY strftime(e.date, '%Y-%m')
    ORDER BY month
  `;

  return await fetchQuery<{ month: string; total: number }>(query, [
    MATERIAL_COST_RATE,
    startDate,
    endDate,
  ]);
}

/**
 * Fetches paginated orders with their material cost joined from inventory.
 */
export async function getOrders(startDate: string, endDate: string, limit: number, offset: number = 0) {
  const query = `
    SELECT 
      e.order_no as orderNo, 
      e.date as saleDate, 
      e.net_amt as sales, 
      COALESCE(SUM(i.quantity * ?), 0) as materialCost
    FROM etsy_statement e
    LEFT JOIN inventory_table i ON e.order_no = i.order_no
    WHERE e.date >= ? AND e.date <= ?
    GROUP BY e.order_no, e.date, e.net_amt
    ORDER BY e.date DESC
    LIMIT ? OFFSET ?
  `;
  
  const rows = await fetchQuery<any>(query, [MATERIAL_COST_RATE, startDate, endDate, limit, offset]);
  
  return rows.map(r => {
    const profit = r.sales - r.materialCost;
    return {
      ...r,
      estimatedProfitBeforeShipping: profit,
      status: profit > 0 ? 'Profitable' : 'Neutral'
    };
  });
}

/**
 * Fetches a unified paginated activity timeline combining file imports and background syncs.
 */
export async function getActivityLogs(limit: number, offset: number = 0) {
  const query = `
    SELECT 'Etsy Statement' as source, 'imported' as action, status, imported_rows as rowsProcessed, created_at as timestamp 
    FROM import_history WHERE invoice_type = 'ETSY'
    UNION ALL
    SELECT 'FedEx Billing' as source, 'imported' as action, status, imported_rows as rowsProcessed, created_at as timestamp 
    FROM import_history WHERE invoice_type = 'FEDEX'
    UNION ALL
    SELECT 'Inventory Sheet' as source, 'synchronized' as action, 'SUCCESS' as status, 0 as rowsProcessed, last_sync_at as timestamp 
    FROM sync_metadata WHERE sync_name = 'inventory' AND last_sync_at IS NOT NULL
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `;
  
  return await fetchQuery<any>(query, [limit, offset]);
}