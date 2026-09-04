import { fetchQuery } from '@/database';
import { formatSalesDate } from '@/utils/normalization';

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
  status: 'SYNCED' | 'NOT_SYNCED' | 'PROCESSING' | 'FAILED' | 'COMPLETED' | 'PENDING' | 'UPLOADED' | 'NOT_UPLOADED';
  lastSyncAt: string | null;
}

export interface SyncStatuses {
  overall: 'SYNCED' | 'PENDING' | 'FAILED' | 'PROCESSING';
  inventory: SyncStatusItem;
  etsy: SyncStatusItem;
  fedex: SyncStatusItem;
  fedexBilling: SyncStatusItem;
  fedexMapping: SyncStatusItem;
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
      totalSales: grossSales,
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
        sales: grossSales,
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

    const dash = await this.getDashboardSummary(from, to);
    const breakdown = await this.getExpenseBreakdown(from, to);
    
    const diffExpenses = Math.abs(dash.totalExpenses - breakdown.totalExpenses);
    if (diffExpenses > 0.01) {
      differences['Dashboard vs Breakdown Expenses'] = diffExpenses;
      success = false;
    }
    
    return { success, differences };
  }

  /**
   * Fetch paginated Etsy orders with full financial details.
   * Search handles both Order Number and connected AWB number per Section 17.
   */
  static async getOrders(
    startDate: string,
    endDate: string,
    limit: number,
    offset: number = 0,
    searchQuery: string = "",
    refundedOnly: boolean = false,
    zeroSalesOnly: boolean = false
  ): Promise<{ data: any[], totalRecords: number }> {
    const hasSearch = searchQuery.trim().length > 0;
    const searchCondition = hasSearch 
      ? `AND (
          CAST(order_no AS VARCHAR) ILIKE ? 
          OR CAST(awb_numbers AS VARCHAR) ILIKE ? 
          OR CAST(order_no AS VARCHAR) IN (
            SELECT CAST(order_no AS VARCHAR) 
            FROM order_awb_mapping 
            WHERE CAST(awb_number AS VARCHAR) ILIKE ?
          )
        )` 
      : "";
    const refundCondition = refundedOnly ? `AND refunds > 0` : "";
    const dateCondition = zeroSalesOnly 
      ? `AND ((sale_date BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)) OR sale_date IS NULL)` 
      : `AND sale_date BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)`;
    const salesCondition = zeroSalesOnly 
      ? `AND (sales IS NULL OR sales = 0)` 
      : `AND ((sales IS NOT NULL AND sales > 0) OR refunds > 0)`;

    const dataQuery = `
      SELECT *
      FROM v_order_financials
      WHERE 1=1
        ${dateCondition}
        ${searchCondition}
        ${refundCondition}
        ${salesCondition}
      ORDER BY (CASE WHEN sale_date IS NULL THEN 1 ELSE 0 END), sale_date DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM v_order_financials
      WHERE 1=1
        ${dateCondition}
        ${searchCondition}
        ${refundCondition}
        ${salesCondition}
    `;

    const dataParams: any[] = [startDate, endDate];
    const countParams: any[] = [startDate, endDate];

    if (hasSearch) {
      const searchValue = `%${searchQuery.trim()}%`;
      dataParams.push(searchValue, searchValue, searchValue);
      countParams.push(searchValue, searchValue, searchValue);
    }

    dataParams.push(Number(limit), Number(offset));

    const [rows, countResult] = await Promise.all([
      fetchQuery<any>(dataQuery, dataParams),
      fetchQuery<any>(countQuery, countParams),
    ]);

    const data = rows.map((row: any) => {
      const hasSales = row.sales !== null && row.sales !== undefined;
      const sales = hasSales ? Number(row.sales) : null;
      const refundAmount = Number(row.refunds ?? 0);
      const netSales = hasSales ? Number(row.net_sales ?? ((sales || 0) - refundAmount)) : null;
      const materialCost = Number(row.material_cost ?? 0);
      const fedexCost = Number(row.fedex_cost ?? 0);
      const etsyExpenses = Number(row.etsy_expenses ?? (Number(row.order_etsy_expenses ?? 0) + Number(row.total_allocated_expenses ?? 0)));
      const listingExpense = Number(row.etsy_listing_expense ?? 0);

      const totalExpense = Number(row.total_expense ?? (materialCost + fedexCost + etsyExpenses));
      const profit = hasSales ? Number(row.profit ?? ((netSales || 0) - totalExpense)) : -totalExpense;
      
      // Margin calculation:
      // Normal/Partial: profit / netSales * 100
      // Fully Refunded (netSales <= 0, sales > 0): profit / sales * 100
      let margin: number | null = null;
      if (netSales !== null && netSales > 0) {
        margin = (profit / netSales) * 100;
      } else if (sales !== null && sales > 0) {
        margin = (profit / sales) * 100;
      }

      let refundStatus: 'Refunded' | 'Partially Refunded' | null = null;
      if (row.refund_status) {
        refundStatus = row.refund_status;
      } else if (sales !== null && refundAmount >= sales && sales > 0) {
        refundStatus = 'Refunded';
      } else if (refundAmount > 0) {
        refundStatus = 'Partially Refunded';
      }

      const awbStr = String(row.awb_numbers ?? 'N/A');

      return {
        orderNo: String(row.order_no ?? ""),
        customerName: "Etsy Buyer",
        productTitle: String(row.product_title || (hasSales ? "Etsy Order Item" : "External Order")),
        country: String(row.country || "N/A"),
        saleDate: row.formatted_sale_date ? String(row.formatted_sale_date) : formatSalesDate(row.sale_date),
        sales,
        netSales,
        materialCost,
        dutyCost: fedexCost,
        fedexCost,
        quantity: Number(row.quantity ?? 0),
        materialType: String(row.material_type || 'N/A'),
        awbNumbers: awbStr,
        awbSources: String(row.awb_sources ?? 'N/A'),
        etsyExpenses,
        totalExpense,
        profit,
        estimatedProfitBeforeShipping: profit,
        margin: margin !== null && !isNaN(margin) ? Number(margin.toFixed(1)) : null,
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
   * Fetch detailed sync statuses for all 4 tracks per Section 24:
   * - Etsy Statement (synced / not synced, last sync timestamp)
   * - FedEx Billing (uploaded / not uploaded, last upload timestamp)
   * - FedEx Mapping (completed / pending / failed, last mapping timestamp)
   * - Inventory Sheet (synced / not synced, last sync timestamp)
   */
  static async getSyncStatuses(): Promise<SyncStatuses> {
    const syncRows = await fetchQuery<any>(`
      SELECT sync_name, last_processed_row, last_sync_at, status 
      FROM sync_metadata
    `);

    const syncMap = new Map<string, any>();
    for (const r of syncRows) {
      syncMap.set(r.sync_name, r);
    }

    const etsyLatest = await fetchQuery<any>(`
      SELECT status, created_at, completed_at 
      FROM etsy_imports 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    // 1. Etsy Status
    const etsyMeta = syncMap.get('etsy_statement');
    let etsyStatus: SyncStatusItem['status'] = 'NOT_SYNCED';
    let etsyDate = etsyMeta?.last_sync_at || null;

    if (etsyLatest && etsyLatest.length > 0) {
      const latest = etsyLatest[0];
      if (latest.status === 'COMPLETED') {
        etsyStatus = 'SYNCED';
        etsyDate = etsyMeta?.last_sync_at || latest.completed_at || etsyDate;
      } else if (latest.status === 'FAILED') {
        etsyStatus = 'FAILED';
        etsyDate = etsyMeta?.last_sync_at || latest.completed_at || latest.created_at || etsyDate;
      } else if (latest.status === 'PROCESSING') {
        // If sync_metadata is marked COMPLETED, or if processing record is older than 5 minutes, resolve state
        const isStale = latest.created_at && (Date.now() - new Date(latest.created_at).getTime() > 5 * 60 * 1000);
        if (etsyMeta?.status === 'COMPLETED' && etsyMeta?.last_sync_at) {
          etsyStatus = 'SYNCED';
          etsyDate = etsyMeta.last_sync_at;
        } else if (isStale) {
          etsyStatus = 'FAILED';
          etsyDate = etsyMeta?.last_sync_at || latest.created_at || etsyDate;
        } else {
          etsyStatus = 'PROCESSING';
          etsyDate = etsyMeta?.last_sync_at || latest.created_at || etsyDate;
        }
      }
    } else if (etsyMeta?.status === 'COMPLETED' || etsyMeta?.status === 'SYNCED') {
      etsyStatus = 'SYNCED';
    } else if (etsyDate) {
      etsyStatus = 'SYNCED';
    }

    // 2. FedEx Billing Status (Uploaded / Not Uploaded)
    const fedexBillingMeta = syncMap.get('fedex_billing');
    const fedexBillingDate = fedexBillingMeta?.last_sync_at || null;
    const fedexBillingStatus: SyncStatusItem['status'] = fedexBillingDate ? 'UPLOADED' : 'NOT_UPLOADED';

    // 3. FedEx Mapping Status (Completed / Pending / Failed)
    const fedexMappingMeta = syncMap.get('fedex_mapping');
    const fedexMappingDate = fedexMappingMeta?.last_sync_at || null;
    let fedexMappingStatus: SyncStatusItem['status'] = 'PENDING';
    if (fedexMappingMeta?.status === 'COMPLETED') {
      fedexMappingStatus = 'COMPLETED';
    } else if (fedexMappingMeta?.status === 'FAILED') {
      fedexMappingStatus = 'FAILED';
    } else if (fedexMappingDate) {
      fedexMappingStatus = 'COMPLETED';
    }

    // 4. Inventory Status
    const inventoryMeta = syncMap.get('google_sheets_inventory');
    const inventoryDate = inventoryMeta?.last_sync_at || null;
    const inventoryStatus: SyncStatusItem['status'] = inventoryDate ? 'SYNCED' : 'NOT_SYNCED';

    // Calculate overall status
    let overall: 'SYNCED' | 'PROCESSING' | 'FAILED' | 'PENDING' = 'PENDING';
    if (etsyStatus === 'FAILED' || fedexMappingStatus === 'FAILED') {
      overall = 'FAILED';
    } else if (etsyStatus === 'PROCESSING') {
      overall = 'PROCESSING';
    } else if (
      etsyStatus === 'SYNCED' && 
      fedexBillingStatus === 'UPLOADED' && 
      fedexMappingStatus === 'COMPLETED' && 
      inventoryStatus === 'SYNCED'
    ) {
      overall = 'SYNCED';
    } else {
      overall = 'PENDING';
    }

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
        status: fedexBillingDate ? 'SYNCED' : 'NOT_SYNCED',
        lastSyncAt: fedexBillingDate ? new Date(fedexBillingDate).toISOString() : null,
      },
      fedexBilling: {
        status: fedexBillingStatus,
        lastSyncAt: fedexBillingDate ? new Date(fedexBillingDate).toISOString() : null,
      },
      fedexMapping: {
        status: fedexMappingStatus,
        lastSyncAt: fedexMappingDate ? new Date(fedexMappingDate).toISOString() : null,
      },
    };
  }

  /**
   * Fetches full details for OrderDetailsModal per Section 18:
   * - summary (financials, sales, refunds, direct NPF, margin)
   * - inventory (material_type, quantity, category, color)
   * - fedexDetails (AWB, total AWB cost, allocated cost)
   * - transactions (Etsy expenses list)
   */
  static async getOrderDetails(orderNo: string): Promise<any> {
    const summaryRows = await fetchQuery<any>(`
      SELECT *
      FROM v_order_financials
      WHERE CAST(order_no AS VARCHAR) = CAST(? AS VARCHAR)
    `, [orderNo]);

    if (!summaryRows || summaryRows.length === 0) {
      return null;
    }

    const s = summaryRows[0];
    const grossSales = Number(s.sales || 0);
    const refundValue = Number(s.refunds || 0);
    const netSales = Number(s.net_sales ?? (grossSales - refundValue));
    const materialCost = Number(s.material_cost || 0);
    const fedexCost = Number(s.fedex_cost || 0);
    const etsyExpenses = Number(s.etsy_expenses || 0);
    const totalExpense = Number(s.total_expense || (materialCost + fedexCost + etsyExpenses));
    const directNpf = Number(s.profit ?? (netSales - totalExpense));

    let margin: number | null = null;
    if (netSales > 0) {
      margin = (directNpf / netSales) * 100;
    } else if (grossSales > 0) {
      margin = (directNpf / grossSales) * 100;
    }

    let refundStatus = s.refund_status || null;
    if (!refundStatus) {
      if (refundValue >= grossSales && grossSales > 0) refundStatus = 'Refunded';
      else if (refundValue > 0) refundStatus = 'Partially Refunded';
    }

    // 1. Inventory Rows
    const inventoryRows = await fetchQuery<any>(`
      SELECT material_type, category, color, quantity
      FROM inventory_table
      WHERE CAST(order_no AS VARCHAR) = CAST(? AS VARCHAR)
    `, [orderNo]);

    // 2. FedEx AWB Details with Source Tracking
    const fedexDetails = await fetchQuery<any>(`
      WITH all_order_awbs AS (
        SELECT order_no, awb_number, source FROM order_awb_mapping WHERE CAST(order_no AS VARCHAR) = CAST(? AS VARCHAR)
        UNION
        SELECT order_no, awb_number, 'Shipment API' as source FROM order_fedex_allocations WHERE CAST(order_no AS VARCHAR) = CAST(? AS VARCHAR)
      )
      SELECT 
        w.awb_number,
        COALESCE(a.allocated_cost, 0) as allocated_cost,
        COALESCE(a.air_waybill_total_amount, b.total_billing, 0) as total_awb_cost,
        COALESCE(w.source, 'Shipment API') as source
      FROM all_order_awbs w
      LEFT JOIN order_fedex_allocations a ON w.order_no = a.order_no AND w.awb_number = a.awb_number
      LEFT JOIN (
        SELECT awb_number, SUM(air_waybill_total_amount) as total_billing
        FROM fedex_billing
        GROUP BY awb_number
      ) b ON w.awb_number = b.awb_number
    `, [orderNo, orderNo]);

    // 3. Etsy Expense Transactions
    const transactions = await fetchQuery<any>(`
      SELECT 
        expense_date as date,
        expense_type,
        title,
        amount,
        net_amount,
        currency,
        listing_id,
        is_allocation,
        import_reference
      FROM etsy_expenses
      WHERE CAST(order_no AS VARCHAR) = CAST(? AS VARCHAR)
      ORDER BY expense_date DESC, created_at DESC
    `, [orderNo]);

    let productTitle = String(s.product_title || 'Etsy Order Item');
    if (!productTitle || productTitle === 'Etsy Order Item' || productTitle.toLowerCase().startsWith('tax') || productTitle.toLowerCase().startsWith('tcs') || productTitle.toLowerCase().startsWith('tds')) {
      const txWithTitle = transactions?.find((t: any) => 
        t.title && t.title.toLowerCase().startsWith('transaction fee:')
      );
      if (txWithTitle) {
        productTitle = txWithTitle.title.replace(/^Transaction fee:\s*/i, '').trim();
      }
    }

    return {
      summary: {
        orderNo: s.order_no,
        productTitle,
        country: s.country || 'N/A',
        saleDate: s.sale_date,
        grossSales,
        refundValue,
        netSales,
        materialCost,
        fedexCost,
        etsyExpenses,
        totalExpense,
        directNpf,
        netProfit: directNpf,
        margin: margin !== null && !isNaN(margin) ? Number(margin.toFixed(1)) : null,
        profitMargin: margin !== null && !isNaN(margin) ? Number(margin.toFixed(1)) : null,
        refundStatus,
        awbNumbers: s.awb_numbers || 'N/A',
        breakdown: {
          materialCost,
          fedexDutyTransportation: fedexCost,
          listingExpense: Number(s.etsy_listing_expense || 0),
          etsyAds: Number(s.etsy_ads_expense || 0),
          offsiteAds: Number(s.offsite_ads || 0),
          buyerFee: Number(s.buyer_fee || 0),
          tds: Number(s.tds || 0),
          tcs: Number(s.tcs || 0),
          transactionFee: Number(s.transaction_fee || 0),
          processingFee: Number(s.processing_fee || 0),
          salesTax: Number(s.sales_tax || 0),
          regulatoryFee: Number(s.regulatory_fee || 0),
          etsyExpenses,
          totalExpense,
        }
      },
      inventory: inventoryRows || [],
      fedexDetails: fedexDetails || [],
      transactions: transactions || []
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
      SELECT 'FedEx Billing' as source, 'synchronized' as action, 'COMPLETED' as status, last_processed_row as rowsProcessed, last_sync_at as timestamp 
      FROM sync_metadata WHERE sync_name = 'fedex_billing' AND last_sync_at IS NOT NULL
      UNION ALL
      SELECT 'FedEx Mapping' as source, 'synchronized' as action, status, last_processed_row as rowsProcessed, last_sync_at as timestamp 
      FROM sync_metadata WHERE sync_name = 'fedex_mapping' AND last_sync_at IS NOT NULL
      UNION ALL
      SELECT 'Inventory Sheet' as source, 'synchronized' as action, 'COMPLETED' as status, 0 as rowsProcessed, last_sync_at as timestamp 
      FROM sync_metadata WHERE sync_name = 'google_sheets_inventory' AND last_sync_at IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;
    return await fetchQuery<any>(query, [limit, offset]);
  }
}
