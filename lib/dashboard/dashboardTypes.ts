export interface KPIData {
  value: number;
  previousValue: number;
  changePercentage: number | null;
  trend: 'up' | 'down' | 'neutral';
  isPercentagePoint?: boolean;
}

export interface DashboardSummaryResponse {
  success: boolean;
  data?: {
    totalSales: KPIData;
    totalExpenses: KPIData;
    grossProfit: KPIData;
    profitMargin: KPIData;
    refundValue: KPIData;
  };
  error?: string;
}

export interface SyncStatusResponse {
  success: boolean;
  data?: {
    inventory: string | null;
    etsy: string | null;
    fedex: string | null;
  };
  error?: string;
}

export interface ChartDataPoint {
  month: string;
  sales: number;
  expenses: number;
  profit: number;
  margin: number;
  listingExpenses?: number;
  refunds?: number;
}

export interface ExpenseBreakdownPoint {
  name: string;
  value: number;
  percentage: number;
}

export interface ExpenseBreakdown {
  materialCost: number;
  fedexDutyTransportation: number;
  listingExpense: number;
  tds: number;
  tcs: number;
  transactionFee: number;
  processingFee: number;
  salesTax: number;
  regulatoryFee: number;
  etsyExpenses: number;
  totalExpense: number;
}

export interface OrderData {
  orderNo: string;
  productTitle?: string;
  quantity?: number;
  materialType?: string;
  country?: string;
  saleDate: string;
  sales: number;
  netSales?: number;
  materialCost: number;
  dutyCost: number;
  fedexCost?: number;
  awbNumbers?: string;
  awbSources?: string;
  totalExpense: number;
  estimatedProfitBeforeShipping: number;
  margin: number | null;
  status: 'Profitable' | 'Loss' | 'Neutral';
  expenseBreakdown: ExpenseBreakdown;
  refundStatus?: 'Refunded' | 'Partially Refunded' | null;
  refundAmount?: number;
}

export interface ActivityData {
  id: string;
  type: 'upload' | 'sync' | 'order' | 'system';
  title: string;
  description: string;
  timestamp: string;
}