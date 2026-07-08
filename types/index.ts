export type InvoiceType = 'FedEx Billing' | 'Etsy Statement';

export interface ApiResponse {
  success: boolean;
  message: string;
  totalRows?: number;
  importedRows?: number;
  failedRows?: number;
  processingTime?: number;
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

export interface EtsyRecord {
  id?: number;
  order_no: string;
  date: string;
  type: string;
  net_amt: number;
  created_at?: Date;
}