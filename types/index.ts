export type InvoiceType = 'FedEx Billing' | 'Etsy Statement';

export interface ApiResponse {
  success: boolean;
  message: string;
  totalRows?: number;
  newSales?: number;
  duplicateSales?: number;
  newExpenses?: number;
  duplicateExpenses?: number;
  newListingTransactions?: number;
  duplicateListingTransactions?: number;
  newListingAllocations?: number;
  duplicateListingAllocations?: number;
  importedRows?: number;
  failedRows?: number;
  errors?: any[];
  processingTime?: number;
  reconciliation?: {
    grossSales: number;
    refunds: number;
    netSales: number;
    listingFeeCharges: number;
    listingFeeCredits: number;
    netListingFees: number;
    etsyAds: number;
    etsyLevelPool: number;
    offsiteAds: number;
    orderLevelFees: number;
    orderLevelTaxes: number;
    etsyOperatingExpenses: number;
    etsyOnlyProfit: number;
  };
}

export interface ImportHistoryRecord {
  id?: number;
  file_name: string;
  file_hash: string;
  file_size: number;
  status: 'SUCCESS' | 'FAILED';
  invoice_type: InvoiceType;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  processing_time: number;
  created_at?: Date;
}

export interface FedexRecord {
  id?: number;
  invoice_type: string;
  invoice_date: string;
  due_date: string;
  awb_number: string;
  air_waybill_total_amount: number;
  book_expense_cost: number;
  created_at?: Date;
}

export interface EtsyTransactionRecord {
  transaction_date: string;
  type: string;
  title: string;
  info: string;
  currency: string;
  amount: number;
  fees_taxes: number;
  net_amount: number;
  tax_details: string;
  order_no: string;
  listing_id: string | null;
  transaction_scope: string; // 'SALE', 'REFUND', 'ORDER', 'ETSY', 'IGNORE'
  transaction_category: string;
  transaction_fingerprint: string;
  occurrence_no: number;
  source_row_number: number;
}

export interface EtsyExpenseGroup {
  expense_category: string;
  statement_date_from: string;
  statement_date_to: string;
  source_total: number;
  eligible_order_count: number;
  allocated_total: number;
  allocation_method: string;
}

export interface EtsyExpenseAllocation {
  order_no: string;
  allocated_amount: number;
}