// lib/dashboard/dashboardQueries.ts

import { fetchQuery } from "@/database";
import { getAllMaterialCostFactors } from "@/config/appConfig";

// ─── Material Cost SQL Helper ──────────────────────────────────────────────
// Builds a SQL CASE expression from centralized config, never hardcoded.
// Result: CASE WHEN UPPER(i.material_type) = 'COTTON' THEN i.quantity * 90 ELSE i.quantity * 100 END

function buildMaterialCostExpr(quantityCol: string = 'i.quantity', materialCol: string = 'i.material_type'): string {
  const factors = getAllMaterialCostFactors();
  const otherRate = factors['OTHER'] ?? 100;

  const cases = Object.entries(factors)
    .filter(([key]) => key !== 'OTHER')
    .map(([key, rate]) => `WHEN UPPER(${materialCol}) = '${key}' THEN ${quantityCol} * ${rate}`)
    .join(' ');

  return `CASE ${cases} ELSE ${quantityCol} * ${otherRate} END`;
}

/* ==========================================================================
   1. HIGH-LEVEL AGGREGATE TOTALS
   ========================================================================== */

/**
 * Fetch total sales within date range.
 */
export async function getTotalSales(
  startDate: string,
  endDate: string,
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
 * Fetch total FedEx expenses (Fractional Allocated Cost based on Etsy Orders)
 */
export async function getFedExExpenses(
  startDate: string,
  endDate: string,
): Promise<number> {
  const query = `
    WITH awb_order_counts AS (
      -- 1. Count how many orders are inside each AWB
      SELECT awb_number, COUNT(DISTINCT order_no) as total_orders_in_awb
      FROM order_awb_mapping
      GROUP BY awb_number
    ),
    allocated_fedex AS (
      -- 2. Divide the AWB cost by the number of orders
      SELECT 
        m.order_no,
        SUM(f.air_waybill_total_amount / c.total_orders_in_awb) as allocated_cost
      FROM order_awb_mapping m
      JOIN fedex_billing f ON m.awb_number = f.awb_number
      JOIN awb_order_counts c ON m.awb_number = c.awb_number
      GROUP BY m.order_no
    )
    -- 3. Sum up the allocated costs ONLY for the orders sold in this date range
    SELECT COALESCE(SUM(af.allocated_cost), 0) AS total_fedex
    FROM etsy_statement e
    LEFT JOIN allocated_fedex af ON CAST(e.order_no AS VARCHAR) = CAST(af.order_no AS VARCHAR)
    WHERE TRY_CAST(e.date AS DATE) >= CAST(? AS DATE) 
      AND TRY_CAST(e.date AS DATE) <= CAST(? AS DATE)
  `;

  const result = await fetchQuery<{ total_fedex: number }>(query, [
    startDate,
    endDate,
  ]);
  return result[0]?.total_fedex || 0;
}

/**
 * Fetch total material expenses within date range using per-material cost factors.
 */
export async function getMaterialExpenses(
  startDate: string,
  endDate: string,
): Promise<number> {
  const costExpr = buildMaterialCostExpr();
  const query = `
    SELECT COALESCE(SUM(${costExpr}), 0) AS total_material_cost
    FROM etsy_statement e
    JOIN inventory_table i ON e.order_no = i.order_no
    WHERE e.date >= ? AND e.date <= ?
  `;
  const result = await fetchQuery<{ total_material_cost: number }>(query, [
    startDate,
    endDate,
  ]);
  return result[0]?.total_material_cost || 0;
}

/**
 * Fetch total Etsy expenses within date range.
 */
export async function getEtsyExpenses(
  startDate: string,
  endDate: string,
): Promise<number> {
  const query = `
    SELECT COALESCE(SUM(ex.expense_amount), 0) AS total_etsy_expenses
    FROM etsy_expenses ex
    JOIN etsy_statement e ON CAST(ex.order_no AS VARCHAR) = CAST(e.order_no AS VARCHAR)
    WHERE TRY_CAST(e.date AS DATE) >= CAST(? AS DATE) 
      AND TRY_CAST(e.date AS DATE) <= CAST(? AS DATE)
  `;
  const result = await fetchQuery<{ total_etsy_expenses: number }>(query, [
    startDate,
    endDate,
  ]);
  return result[0]?.total_etsy_expenses || 0;
}

/* ==========================================================================
   2. MONTHLY GROUPINGS (FOR CHARTS)
   ========================================================================== */

/**
 * Fetch monthly grouped sales.
 */
export async function getMonthlySales(startDate: string, endDate: string) {
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
 * Fetch monthly grouped FedEx expenses (Fractional Cost aligned to the Sale Month)
 */
export async function getMonthlyFedEx(startDate: string, endDate: string) {
  const query = `
    WITH awb_order_counts AS (
      SELECT awb_number, COUNT(DISTINCT order_no) as total_orders_in_awb
      FROM order_awb_mapping
      GROUP BY awb_number
    ),
    allocated_fedex AS (
      SELECT 
        m.order_no,
        SUM(f.air_waybill_total_amount / c.total_orders_in_awb) as allocated_cost
      FROM order_awb_mapping m
      JOIN fedex_billing f ON m.awb_number = f.awb_number
      JOIN awb_order_counts c ON m.awb_number = c.awb_number
      GROUP BY m.order_no
    )
    -- Group the costs by the ETSY SALE DATE, not the FedEx invoice date!
    SELECT
      strftime(TRY_CAST(e.date AS DATE), '%Y-%m') AS month,
      COALESCE(SUM(af.allocated_cost), 0) AS total
    FROM etsy_statement e
    LEFT JOIN allocated_fedex af ON CAST(e.order_no AS VARCHAR) = CAST(af.order_no AS VARCHAR)
    WHERE TRY_CAST(e.date AS DATE) >= CAST(? AS DATE) 
      AND TRY_CAST(e.date AS DATE) <= CAST(? AS DATE)
    GROUP BY strftime(TRY_CAST(e.date AS DATE), '%Y-%m')
    ORDER BY month
  `;

  return await fetchQuery<{ month: string; total: number }>(query, [
    startDate,
    endDate,
  ]);
}

/**
 * Fetch monthly grouped material expenses using per-material cost factors.
 */
export async function getMonthlyMaterials(startDate: string, endDate: string) {
  const costExpr = buildMaterialCostExpr();
  const query = `
    SELECT
      strftime(e.date, '%Y-%m') AS month,
      COALESCE(SUM(${costExpr}), 0) AS total
    FROM etsy_statement e
    JOIN inventory_table i ON e.order_no = i.order_no
    WHERE e.date >= ? AND e.date <= ?
    GROUP BY strftime(e.date, '%Y-%m')
    ORDER BY month
  `;
  return await fetchQuery<{ month: string; total: number }>(query, [
    startDate,
    endDate,
  ]);
}

/**
 * Fetch monthly grouped Etsy expenses.
 */
export async function getMonthlyEtsyExpenses(startDate: string, endDate: string) {
  const query = `
    SELECT
      strftime(TRY_CAST(e.date AS DATE), '%Y-%m') AS month,
      COALESCE(SUM(ex.expense_amount), 0) AS total
    FROM etsy_expenses ex
    JOIN etsy_statement e ON CAST(ex.order_no AS VARCHAR) = CAST(e.order_no AS VARCHAR)
    WHERE TRY_CAST(e.date AS DATE) >= CAST(? AS DATE) 
      AND TRY_CAST(e.date AS DATE) <= CAST(? AS DATE)
    GROUP BY strftime(TRY_CAST(e.date AS DATE), '%Y-%m')
    ORDER BY month
  `;
  return await fetchQuery<{ month: string; total: number }>(query, [
    startDate,
    endDate,
  ]);
}

/* ==========================================================================
   3. COMPLEX CALCULATIONS (FRACTIONAL COSTS)
   ========================================================================== */

/**
 * Calculates perfectly fractional FedEx costs and maps them to the exact Sale Date.
 */
export async function getFractionalOrderCosts(
  startDate: string,
  endDate: string,
) {
  const costExpr = buildMaterialCostExpr();
  const query = `
    WITH awb_order_counts AS (
      SELECT awb_number, COUNT(DISTINCT order_no) as order_count
      FROM order_awb_mapping
      GROUP BY awb_number
    ),
    fractional_fedex AS (
      SELECT 
        m.order_no,
        SUM(f.air_waybill_total_amount / c.order_count) as allocated_duty_cost
      FROM order_awb_mapping m
      JOIN fedex_billing f ON m.awb_number = f.awb_number
      JOIN awb_order_counts c ON m.awb_number = c.awb_number
      GROUP BY m.order_no
    )
    SELECT 
      e.date AS sale_date,
      e.order_no,
      e.net_amt AS sales,
      COALESCE(SUM(${costExpr}), 0) AS material_cost,
      COALESCE(ff.allocated_duty_cost, 0) AS duty_cost
    FROM etsy_statement e
    LEFT JOIN inventory_table i ON e.order_no = i.order_no
    LEFT JOIN fractional_fedex ff ON e.order_no = ff.order_no
    WHERE e.date >= ? AND e.date <= ?
    GROUP BY e.date, e.order_no, e.net_amt, ff.allocated_duty_cost
  `;
  return await fetchQuery<any>(query, [startDate, endDate]);
}

/* ==========================================================================
   4. TABLE DATA & PAGINATION
   ========================================================================== */

/**
 * Fetch paginated Etsy orders with per-material costs, fractional FedEx costs,
 * and Etsy expense breakdown.
 */
export async function getOrders(
  startDate: string,
  endDate: string,
  limit: number,
  offset: number = 0,
  searchQuery: string = "",
) {
  const hasSearch = searchQuery.trim().length > 0;
  const searchCondition = hasSearch
    ? `AND CAST(e.order_no AS VARCHAR) ILIKE ?`
    : "";

  const costExpr = buildMaterialCostExpr();

  const dataQuery = `
    WITH awb_order_counts AS (
      SELECT awb_number, COUNT(DISTINCT order_no) as total_orders_in_awb
      FROM order_awb_mapping
      GROUP BY awb_number
    ),
    allocated_fedex AS (
      SELECT 
        m.order_no,
        STRING_AGG(DISTINCT m.awb_number, ', ') as awb_numbers,
        SUM(f.air_waybill_total_amount / c.total_orders_in_awb) as allocated_duty_cost,
        SUM(f.book_expense_cost / c.total_orders_in_awb) as allocated_book_expense
      FROM order_awb_mapping m
      JOIN fedex_billing f ON m.awb_number = f.awb_number
      JOIN awb_order_counts c ON m.awb_number = c.awb_number
      GROUP BY m.order_no
    ),
    order_etsy_expenses AS (
      SELECT 
        order_no,
        COALESCE(SUM(CASE WHEN expense_type = 'LISTING_EXPENSE' THEN expense_amount ELSE 0 END), 0) AS listing_expense,
        COALESCE(SUM(CASE WHEN expense_type = 'TDS' THEN expense_amount ELSE 0 END), 0) AS tds,
        COALESCE(SUM(CASE WHEN expense_type = 'TCS' THEN expense_amount ELSE 0 END), 0) AS tcs,
        COALESCE(SUM(CASE WHEN expense_type = 'TRANSACTION_FEE' THEN expense_amount ELSE 0 END), 0) AS transaction_fee,
        COALESCE(SUM(CASE WHEN expense_type = 'PROCESSING_FEE' THEN expense_amount ELSE 0 END), 0) AS processing_fee,
        COALESCE(SUM(CASE WHEN expense_type = 'SALES_TAX' THEN expense_amount ELSE 0 END), 0) AS sales_tax,
        COALESCE(SUM(CASE WHEN expense_type = 'REGULATORY_OPERATING_FEE' THEN expense_amount ELSE 0 END), 0) AS regulatory_fee,
        COALESCE(SUM(CASE WHEN expense_type = 'OTHER_ETSY_EXPENSE' THEN expense_amount ELSE 0 END), 0) AS other_etsy_expense,
        COALESCE(SUM(expense_amount), 0) AS total_etsy_expense
      FROM etsy_expenses
      GROUP BY order_no
    )
    SELECT
      CAST(e.order_no AS VARCHAR) AS order_no,
      CAST(e.date AS VARCHAR) AS sale_date,
      COALESCE(TRY_CAST(REPLACE(CAST(e.net_amt AS VARCHAR), ',', '') AS DOUBLE), 0) AS sales,
      COALESCE(SUM(${costExpr}), 0) AS material_cost,
      COALESCE(af.allocated_duty_cost, 0) AS duty_cost,
      COALESCE(af.allocated_book_expense, 0) AS book_expense,
      COALESCE(MAX(af.awb_numbers), 'N/A') AS awb_numbers,
      COALESCE(oex.listing_expense, 0) AS listing_expense,
      COALESCE(oex.tds, 0) AS tds,
      COALESCE(oex.tcs, 0) AS tcs,
      COALESCE(oex.transaction_fee, 0) AS transaction_fee,
      COALESCE(oex.processing_fee, 0) AS processing_fee,
      COALESCE(oex.sales_tax, 0) AS sales_tax,
      COALESCE(oex.regulatory_fee, 0) AS regulatory_fee,
      COALESCE(oex.other_etsy_expense, 0) AS other_etsy_expense,
      COALESCE(oex.total_etsy_expense, 0) AS total_etsy_expense
    FROM etsy_statement e
    LEFT JOIN inventory_table i ON CAST(i.order_no AS VARCHAR) LIKE CAST(e.order_no AS VARCHAR) || '%'
    LEFT JOIN allocated_fedex af ON CAST(e.order_no AS VARCHAR) = CAST(af.order_no AS VARCHAR)
    LEFT JOIN order_etsy_expenses oex ON CAST(e.order_no AS VARCHAR) = CAST(oex.order_no AS VARCHAR)
    WHERE TRY_CAST(e.date AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
      ${searchCondition}
    GROUP BY e.order_no, e.date, e.net_amt, af.allocated_duty_cost, af.allocated_book_expense,
             oex.listing_expense, oex.tds, oex.tcs, oex.transaction_fee, oex.processing_fee,
             oex.sales_tax, oex.regulatory_fee, oex.other_etsy_expense, oex.total_etsy_expense
    ORDER BY TRY_CAST(e.date AS DATE) DESC
    LIMIT ? OFFSET ?
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT CAST(e.order_no AS VARCHAR)) AS total
    FROM etsy_statement e
    WHERE TRY_CAST(e.date AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
      ${searchCondition}
  `;

  const dataParams: unknown[] = [startDate, endDate];
  const countParams: unknown[] = [startDate, endDate];

  if (hasSearch) {
    const searchValue = `%${searchQuery.trim()}%`;
    dataParams.push(searchValue);
    countParams.push(searchValue);
  }

  dataParams.push(Number(limit), Number(offset));

  try {
    const [rows, countResult] = await Promise.all([
      fetchQuery<any>(dataQuery, dataParams),
      fetchQuery<any>(countQuery, countParams),
    ]);

    const data = rows.map((row: any) => {
      const sales = Number(row.sales ?? 0);
      const materialCost = Number(row.material_cost ?? 0);
      const dutyCost = Number(row.duty_cost ?? 0);
      const bookExpense = Number(row.book_expense ?? 0);
      const totalEtsyExpense = Number(row.total_etsy_expense ?? 0);

      // Updated formula: Net Profit = Sales - Material Cost - FedEx - Etsy Expenses
      const totalExpense = materialCost + dutyCost + totalEtsyExpense;
      const profit = sales - totalExpense;
      // Safe margin: handle zero sales
      const margin = sales > 0 ? Number(((profit / sales) * 100).toFixed(1)) : 0;

      return {
        orderNo: String(row.order_no ?? ""),
        customerName: "Etsy Buyer",
        saleDate: String(row.sale_date ?? ""),
        sales,
        materialCost,
        dutyCost,
        bookExpense,
        awbNumbers: String(row.awb_numbers ?? "N/A"),
        totalExpense,
        estimatedProfitBeforeShipping: profit,
        margin,
        status: profit > 0 ? "Profitable" : profit < 0 ? "Loss" : "Neutral",
        // Expense breakdown (from backend, not duplicated in React)
        expenseBreakdown: {
          materialCost,
          fedexDutyTransportation: dutyCost,
          listingExpense: Number(row.listing_expense ?? 0),
          tds: Number(row.tds ?? 0),
          tcs: Number(row.tcs ?? 0),
          transactionFee: Number(row.transaction_fee ?? 0),
          processingFee: Number(row.processing_fee ?? 0),
          salesTax: Number(row.sales_tax ?? 0),
          regulatoryFee: Number(row.regulatory_fee ?? 0),
          otherEtsyExpense: Number(row.other_etsy_expense ?? 0),
          totalExpense,
        },
      };
    });

    return {
      data,
      totalRecords: Number(countResult[0]?.total ?? 0),
    };
  } catch (error) {
    console.error("GET ORDERS DATABASE ERROR:", error);
    throw error;
  }
}

/* ==========================================================================
   5. EXPENSE BREAKDOWN (Aggregate for pie chart)
   ========================================================================== */

/**
 * Fetch aggregated expense breakdown by category for a date range.
 */
export async function getExpenseBreakdownByCategory(startDate: string, endDate: string) {
  const query = `
    SELECT 
      expense_type,
      COALESCE(SUM(expense_amount), 0) AS total
    FROM etsy_expenses ex
    LEFT JOIN etsy_statement e ON CAST(ex.order_no AS VARCHAR) = CAST(e.order_no AS VARCHAR)
    WHERE (TRY_CAST(e.date AS DATE) >= CAST(? AS DATE) AND TRY_CAST(e.date AS DATE) <= CAST(? AS DATE))
       OR ex.order_no IS NULL OR ex.order_no = ''
    GROUP BY expense_type
  `;
  return await fetchQuery<{ expense_type: string; total: number }>(query, [startDate, endDate]);
}

/**
 * Fetch single order expense breakdown directly from DuckDB database.
 */
export async function getOrderExpenseBreakdown(orderNo: string) {
  const costExpr = buildMaterialCostExpr();
  const query = `
    WITH awb_order_counts AS (
      SELECT awb_number, COUNT(DISTINCT order_no) as total_orders_in_awb
      FROM order_awb_mapping
      GROUP BY awb_number
    ),
    allocated_fedex AS (
      SELECT 
        m.order_no,
        SUM(f.air_waybill_total_amount / c.total_orders_in_awb) as allocated_duty_cost
      FROM order_awb_mapping m
      JOIN fedex_billing f ON m.awb_number = f.awb_number
      JOIN awb_order_counts c ON m.awb_number = c.awb_number
      WHERE CAST(m.order_no AS VARCHAR) = ?
      GROUP BY m.order_no
    ),
    order_etsy_expenses AS (
      SELECT 
        order_no,
        COALESCE(SUM(CASE WHEN expense_type = 'LISTING_EXPENSE' THEN expense_amount ELSE 0 END), 0) AS listing_expense,
        COALESCE(SUM(CASE WHEN expense_type = 'TDS' THEN expense_amount ELSE 0 END), 0) AS tds,
        COALESCE(SUM(CASE WHEN expense_type = 'TCS' THEN expense_amount ELSE 0 END), 0) AS tcs,
        COALESCE(SUM(CASE WHEN expense_type = 'TRANSACTION_FEE' THEN expense_amount ELSE 0 END), 0) AS transaction_fee,
        COALESCE(SUM(CASE WHEN expense_type = 'PROCESSING_FEE' THEN expense_amount ELSE 0 END), 0) AS processing_fee,
        COALESCE(SUM(CASE WHEN expense_type = 'SALES_TAX' THEN expense_amount ELSE 0 END), 0) AS sales_tax,
        COALESCE(SUM(CASE WHEN expense_type = 'REGULATORY_OPERATING_FEE' THEN expense_amount ELSE 0 END), 0) AS regulatory_fee,
        COALESCE(SUM(CASE WHEN expense_type = 'OTHER_ETSY_EXPENSE' THEN expense_amount ELSE 0 END), 0) AS other_etsy_expense,
        COALESCE(SUM(expense_amount), 0) AS total_etsy_expense
      FROM etsy_expenses
      WHERE CAST(order_no AS VARCHAR) = ?
      GROUP BY order_no
    ),
    material_cost_calc AS (
      SELECT COALESCE(SUM(${costExpr}), 0) AS material_cost
      FROM inventory_table i
      WHERE CAST(i.order_no AS VARCHAR) LIKE ? || '%'
    )
    SELECT
      COALESCE(mc.material_cost, 0) AS material_cost,
      COALESCE(af.allocated_duty_cost, 0) AS fedex_expense,
      COALESCE(oex.listing_expense, 0) AS listing_expense,
      COALESCE(oex.tds, 0) AS tds,
      COALESCE(oex.tcs, 0) AS tcs,
      COALESCE(oex.transaction_fee, 0) AS transaction_fee,
      COALESCE(oex.processing_fee, 0) AS processing_fee,
      COALESCE(oex.sales_tax, 0) AS sales_tax,
      COALESCE(oex.regulatory_fee, 0) AS regulatory_fee,
      COALESCE(oex.other_etsy_expense, 0) AS other_etsy_expense
    FROM material_cost_calc mc
    LEFT JOIN allocated_fedex af ON 1=1
    LEFT JOIN order_etsy_expenses oex ON 1=1
  `;

  const rows = await fetchQuery<any>(query, [orderNo, orderNo, orderNo]);
  const row = rows[0] || {};

  const materialCost = Number(row.material_cost ?? 0);
  const fedexExpense = Number(row.fedex_expense ?? 0);
  const listingExpense = Number(row.listing_expense ?? 0);
  const tds = Number(row.tds ?? 0);
  const tcs = Number(row.tcs ?? 0);
  const transactionFee = Number(row.transaction_fee ?? 0);
  const processingFee = Number(row.processing_fee ?? 0);
  const salesTax = Number(row.sales_tax ?? 0);
  const regulatoryFee = Number(row.regulatory_fee ?? 0);
  const otherEtsyExpense = Number(row.other_etsy_expense ?? 0);

  const totalExpense = materialCost + fedexExpense + listingExpense + tds + tcs + transactionFee + processingFee + salesTax + regulatoryFee + otherEtsyExpense;

  return {
    materialCost,
    fedexExpense,
    fedexDutyTransportation: fedexExpense,
    listingExpense,
    tds,
    tcs,
    transactionFee,
    processingFee,
    salesTax,
    regulatoryFee,
    otherEtsyExpense,
    totalExpense,
  };
}

/* ==========================================================================
   6. SYNC TIMESTAMPS & LOGS
   ========================================================================== */

/**
 * Fetch detailed sync statuses for various providers.
 */
export async function getSyncStatuses() {
  const query = `SELECT sync_name, last_sync_at FROM sync_metadata`;
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
      syncData.find((s) => s.sync_name === "inventory")?.last_sync_at || null,
    etsy:
      importData.find((i) => i.invoice_type === "ETSY")?.last_import_at || null,
    fedex:
      importData.find((i) => i.invoice_type === "FEDEX")?.last_import_at ||
      null,
  };
}

/**
 * Fetch simple sync timestamps based on database upload time (created_at).
 */
export async function getSyncDates() {
  try {
    const etsy = await fetchQuery<any>(
      'SELECT MAX(created_at) as "lastUpload" FROM etsy_statement',
    ).catch(() => []);
    const fedex = await fetchQuery<any>(
      'SELECT MAX(created_at) as "lastUpload" FROM fedex_billing',
    ).catch(() => []);
    const inventory = await fetchQuery<any>(
      'SELECT MAX(created_at) as "lastUpload" FROM inventory_table',
    ).catch(() => []);

    const extractDate = (result: any[]) => {
      if (!result || !result[0]) return null;
      return (
        result[0].lastUpload ||
        result[0].lastupload ||
        result[0].LASTUPLOAD ||
        null
      );
    };

    return {
      etsy: extractDate(etsy),
      fedex: extractDate(fedex),
      inventory: extractDate(inventory),
    };
  } catch (error) {
    return { etsy: null, fedex: null, inventory: null };
  }
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
