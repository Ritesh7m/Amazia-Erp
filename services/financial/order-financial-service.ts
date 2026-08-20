import { fetchQuery } from '@/database';

export interface DashboardSummary {
  totalSales: number;
  totalExpenses: number;
  refundValue: number;
  netProfit: number;
  profitMargin: number;
}

export interface MonthlyPerformance {
  month: string;
  sales: number;
  refunds: number;
  expenses: number;
  profit: number;
  margin: number;
  materialCost: number;
  fedexCost: number;
  etsyListingExpense: number;
  etsyExpenses: number;
}

export interface ExpenseBreakdown {
  materialCost: number;
  fedexDutyTransportation: number;
  etsyListingExpense: number;
  etsyExpenses: number;
  totalExpenses: number;
}

export interface OrderFinancial {
  orderNo: string;
  saleDate: string;
  sales: number;
  refunds: number;
  materialCost: number;
  fedexCost: number;
  etsyListingExpense: number;
  etsyExpenses: number;
  totalExpense: number;
  profit: number;
  margin: number;
}

export interface SyncStatusItem {
  status: 'SYNCED' | 'NOT_SYNCED' | 'PROCESSING' | 'FAILED';
  lastSyncAt: string | null;
}

export interface SyncStatuses {
  overall: 'SYNCED' | 'PENDING';
  inventory: SyncStatusItem;
  etsy: SyncStatusItem;
  fedex: SyncStatusItem;
}

export class OrderFinancialService {
  /**
   * Generates summary KPIs.
   */
  static async getDashboardSummary(from: string, to: string): Promise<DashboardSummary> {
    const query = `
      SELECT 
        COALESCE(SUM(sales), 0) as total_sales,
        COALESCE(SUM(refunds), 0) as total_refunds,
        COALESCE(SUM(total_expense), 0) as total_expenses
      FROM v_order_financials
      WHERE sale_date >= ? AND sale_date <= ?
    `;
    const result = await fetchQuery<any>(query, [from, to]);
    const row = result[0] || {};
    
    const grossSales = Number(row.total_sales) || 0;
    const refunds = Number(row.total_refunds) || 0;
    const totalExpenses = Number(row.total_expenses) || 0;
    
    const netSales = grossSales - refunds;
    const netProfit = netSales - totalExpenses;
    const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
    
    return {
      totalSales: netSales,
      totalExpenses,
      refundValue: refunds,
      netProfit,
      profitMargin
    };
  }

  /**
   * Generates monthly performance data.
   */
  static async getPerformance(from: string, to: string): Promise<MonthlyPerformance[]> {
    const query = `
      SELECT 
        strftime(sale_date, '%Y-%m') as month,
        COALESCE(SUM(sales), 0) as sales,
        COALESCE(SUM(refunds), 0) as refunds,
        COALESCE(SUM(total_expense), 0) as expenses,
        COALESCE(SUM(material_cost), 0) as material_cost,
        COALESCE(SUM(fedex_cost), 0) as fedex_cost,
        COALESCE(SUM(etsy_listing_expense), 0) as etsy_listing_expense,
        COALESCE(SUM(order_etsy_expenses + etsy_ads_expense), 0) as etsy_expenses
      FROM v_order_financials
      WHERE sale_date >= ? AND sale_date <= ?
      GROUP BY month
      ORDER BY month
    `;
    const rows = await fetchQuery<any>(query, [from, to]);
    
    return rows.map(r => {
      const grossSales = Number(r.sales) || 0;
      const refunds = Number(r.refunds) || 0;
      const expenses = Number(r.expenses) || 0;
      const netSales = grossSales - refunds;
      const profit = netSales - expenses;
      const margin = netSales > 0 ? (profit / netSales) * 100 : 0;
      
      return {
        month: r.month,
        sales: netSales,
        refunds,
        expenses,
        profit,
        margin: Number(margin.toFixed(1)),
        materialCost: Number(r.material_cost) || 0,
        fedexCost: Number(r.fedex_cost) || 0,
        etsyListingExpense: Number(r.etsy_listing_expense) || 0,
        etsyExpenses: Number(r.etsy_expenses) || 0,
      };
    });
  }

  /**
   * Generates expense breakdown for pie charts.
   */
  static async getExpenseBreakdown(from: string, to: string): Promise<any> {
    const query = `
      SELECT 
        COALESCE(SUM(material_cost), 0) as material_cost,
        COALESCE(SUM(fedex_cost), 0) as fedex_cost,
        COALESCE(SUM(etsy_listing_expense), 0) as etsy_listing_expense,
        COALESCE(SUM(etsy_ads_expense), 0) as etsy_ads_expense,
        COALESCE(SUM(offsite_ads), 0) as offsite_ads,
        COALESCE(SUM(order_etsy_expenses + total_allocated_expenses - etsy_listing_expense - etsy_ads_expense - offsite_ads), 0) as other_etsy_expenses,
        COALESCE(SUM(total_expense), 0) as total_expenses
      FROM v_order_financials
      WHERE sale_date >= ? AND sale_date <= ?
    `;
    const result = await fetchQuery<any>(query, [from, to]);
    const row = result[0] || {};
    
    return {
      materialCost: Number(row.material_cost) || 0,
      fedexDutyTransportation: Number(row.fedex_cost) || 0,
      etsyListingExpense: Number(row.etsy_listing_expense) || 0,
      etsyAds: Number(row.etsy_ads_expense) || 0,
      offsiteAds: Number(row.offsite_ads) || 0,
      otherEtsyExpenses: Number(row.other_etsy_expenses) || 0,
      totalExpenses: Number(row.total_expenses) || 0
    };
  }

  /**
   * Gets specific details for one order.
   */
  static async getOrderExpenseBreakdown(orderNo: string): Promise<any> {
    const query = `
      SELECT *
      FROM v_order_financials
      WHERE order_no = ?
    `;
    const result = await fetchQuery<any>(query, [orderNo]);
    const row = result[0] || {};
    
    return {
      materialCost: Number(row.material_cost) || 0,
      fedexDutyTransportation: Number(row.fedex_cost) || 0,
      etsyListingExpense: Number(row.etsy_listing_expense) || 0,
      etsyAds: Number(row.etsy_ads_expense) || 0,
      offsiteAds: Number(row.offsite_ads) || 0,
      buyerFee: Number(row.buyer_fee) || 0,
      tds: Number(row.tds) || 0,
      tcs: Number(row.tcs) || 0,
      transactionFee: Number(row.transaction_fee) || 0,
      processingFee: Number(row.processing_fee) || 0,
      salesTax: Number(row.sales_tax) || 0,
      regulatoryFee: Number(row.regulatory_fee) || 0,
      etsyExpenses: Number(row.etsy_expenses) || 0,
      totalExpense: Number(row.total_expense) || 0
    };
  }
  
  /**
   * Reconciles financials across layers.
   */
  static async reconcileFinancials(from: string, to: string): Promise<{ success: boolean; differences: any }> {
    const differences: any = {};
    let success = true;

    // 1. Dashboard vs Order Total Expenses
    const dash = await this.getDashboardSummary(from, to);
    const breakdown = await this.getExpenseBreakdown(from, to);
    
    const diffExpenses = Math.abs(dash.totalExpenses - breakdown.totalExpenses);
    if (diffExpenses > 0.01) {
      differences['Dashboard vs Breakdown Expenses'] = diffExpenses;
      success = false;
    }
    
    // We could add raw vs allocated checks here if needed, comparing etsy_transactions vs etsy_listing_allocations
    // But this depends heavily on exact requirements.
    
    
    return { success, differences };
  }

  /**
   * Fetch paginated Etsy orders with full financial details.
   */
  static async getOrders(
    startDate: string,
    endDate: string,
    limit: number,
    offset: number = 0,
    searchQuery: string = "",
    refundedOnly: boolean = false
  ): Promise<{ data: any[], totalRecords: number }> {
    const hasSearch = searchQuery.trim().length > 0;
    const searchCondition = hasSearch ? `AND CAST(order_no AS VARCHAR) ILIKE ?` : "";
    const refundCondition = refundedOnly ? `AND refunds > 0` : "";

    const dataQuery = `
      SELECT *
      FROM v_order_financials
      WHERE sale_date BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
        ${searchCondition}
        ${refundCondition}
      ORDER BY sale_date DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM v_order_financials
      WHERE sale_date BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
        ${searchCondition}
        ${refundCondition}
    `;

    const dataParams: any[] = [startDate, endDate];
    const countParams: any[] = [startDate, endDate];

    if (hasSearch) {
      const searchValue = `%${searchQuery.trim()}%`;
      dataParams.push(searchValue);
      countParams.push(searchValue);
    }

    dataParams.push(Number(limit), Number(offset));

    const [rows, countResult] = await Promise.all([
      fetchQuery<any>(dataQuery, dataParams),
      fetchQuery<any>(countQuery, countParams),
    ]);

    const data = rows.map((row: any) => {
      const sales = Number(row.sales ?? 0);
      const netSales = Number(row.net_sales ?? 0);
      const materialCost = Number(row.material_cost ?? 0);
      const fedexCost = Number(row.fedex_cost ?? 0);
      const etsyExpenses = Number(row.order_etsy_expenses ?? 0);
      const listingExpense = Number(row.etsy_listing_expense ?? 0);

      const totalExpense = Number(row.total_expense ?? 0);
      const profit = Number(row.profit ?? 0);
      const margin = Number(row.margin ?? 0);
      
      const refundAmount = Number(row.refunds ?? 0);
      let refundStatus = null;
      if (refundAmount >= sales && sales > 0) refundStatus = 'Refunded';
      else if (refundAmount > 0) refundStatus = 'Partially Refunded';

      return {
        orderNo: String(row.order_no ?? ""),
        customerName: "Etsy Buyer",
        saleDate: String(row.sale_date ?? ""),
        sales,
        materialCost,
        dutyCost: fedexCost,
        awbNumbers: String(row.awb_numbers ?? "N/A"),
        totalExpense,
        estimatedProfitBeforeShipping: profit,
        margin,
        status: profit > 0 ? "Profitable" : profit < 0 ? "Loss" : "Neutral",
        refundStatus,
        refundAmount,
        expenseBreakdown: {
          materialCost,
          fedexDutyTransportation: fedexCost,
          listingExpense,
          etsyAds: Number(row.etsy_ads_expense ?? 0),
          offsiteAds: Number(row.offsite_ads ?? 0),
          buyerFee: Number(row.buyer_fee ?? 0),
          tds: Number(row.tds ?? 0),
          tcs: Number(row.tcs ?? 0),
          transactionFee: Number(row.transaction_fee ?? 0),
          processingFee: Number(row.processing_fee ?? 0),
          salesTax: Number(row.sales_tax ?? 0),
          regulatoryFee: Number(row.regulatory_fee ?? 0),
          etsyExpenses,
          totalExpense,
        },
      };
    });

    return {
      data,
      totalRecords: Number(countResult[0]?.total ?? 0),
    };
  }



  /**
   * Fetch detailed sync statuses for various providers.
   */
  static async getSyncStatuses(): Promise<SyncStatuses> {
    const etsySuccess = await fetchQuery<any>(`SELECT MAX(created_at) AS last_sync_at FROM etsy_imports WHERE status = 'SUCCESS'`);
    const fedexSuccess = await fetchQuery<any>(`SELECT MAX(created_at) AS last_sync_at FROM import_history WHERE invoice_type = 'FEDEX' AND status = 'SUCCESS'`);
    
    // Also fetch from sync_metadata as fallback
    const syncMetaEtsy = await fetchQuery<any>(`SELECT last_sync_at FROM sync_metadata WHERE sync_name = 'etsy'`);
    const syncMetaFedex = await fetchQuery<any>(`SELECT last_sync_at FROM sync_metadata WHERE sync_name = 'fedex_billing'`);
    const inventoryQuery = await fetchQuery<any>(`SELECT last_sync_at FROM sync_metadata WHERE sync_name = 'google_sheets_inventory'`);

    const etsyLatest = await fetchQuery<any>(`SELECT status FROM etsy_imports ORDER BY created_at DESC LIMIT 1`);
    const fedexLatest = await fetchQuery<any>(`SELECT status FROM import_history WHERE invoice_type = 'FEDEX' ORDER BY created_at DESC LIMIT 1`);

    const inventoryDate = inventoryQuery[0]?.last_sync_at || null;
    const etsyDate = etsySuccess[0]?.last_sync_at || syncMetaEtsy[0]?.last_sync_at || null;
    const fedexDate = fedexSuccess[0]?.last_sync_at || syncMetaFedex[0]?.last_sync_at || null;

    const etsyLatestStatus = etsyLatest[0]?.status;
    const fedexLatestStatus = fedexLatest[0]?.status;

    let etsyStatus: SyncStatusItem['status'] = 'NOT_SYNCED';
    if (etsyLatestStatus === 'PROCESSING') etsyStatus = 'PROCESSING';
    else if (etsyLatestStatus === 'FAILED') etsyStatus = 'FAILED';
    else if (etsyDate) etsyStatus = 'SYNCED';

    let fedexStatus: SyncStatusItem['status'] = 'NOT_SYNCED';
    if (fedexLatestStatus === 'PROCESSING') fedexStatus = 'PROCESSING';
    else if (fedexLatestStatus === 'FAILED') fedexStatus = 'FAILED';
    else if (fedexDate) fedexStatus = 'SYNCED';

    let inventoryStatus: SyncStatusItem['status'] = inventoryDate ? 'SYNCED' : 'NOT_SYNCED';

    const overall = (etsyDate && fedexDate && inventoryDate) ? 'SYNCED' : 'PENDING';

    return {
      overall,
      inventory: {
        status: inventoryStatus,
        lastSyncAt: inventoryDate ? new Date(inventoryDate).toISOString() : null,
      },
      etsy: {
        status: etsyStatus,
        lastSyncAt: etsyDate ? new Date(etsyDate).toISOString() : null,
      },
      fedex: {
        status: fedexStatus,
        lastSyncAt: fedexDate ? new Date(fedexDate).toISOString() : null,
      },
    };
  }

  /**
   * Fetches a unified paginated activity timeline combining file imports and background syncs.
   */
  static async getActivityLogs(limit: number, offset: number = 0) {
    const query = `
      SELECT 'Etsy Statement' as source, 'imported' as action, status, COALESCE(new_rows, 0) as rowsProcessed, created_at as timestamp 
      FROM etsy_imports 
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
}
