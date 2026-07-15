export interface KPIData {
  value: number;
  previousValue: number;
  changePercentage: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface DashboardSummaryResponse {
  success: boolean;
  data?: {
    totalSales: KPIData;
    totalExpenses: KPIData;
    grossProfit: KPIData;
    profitMargin: KPIData;
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
}

export interface ExpenseBreakdownPoint {
  name: string;
  value: number;
  percentage: number;
}

export interface OrderData {
  orderNo: string;
  saleDate: string;
  sales: number;
  materialCost: number;
  dutyCost: number; 
  estimatedProfitBeforeShipping: number; 
  status: 'Profitable' | 'Loss' | 'Neutral';
}

export interface ActivityData {
  id: string;
  type: 'upload' | 'sync' | 'order' | 'system';
  title: string;
  description: string;
  timestamp: string;
}