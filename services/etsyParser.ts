import csv from 'csv-parser';
import { Readable } from 'stream';
import { EtsyRecord, EtsyExpenseRecord } from '@/types';
import { 
  normalizeAmount, normalizeDate, extractEtsyOrderNumber,
  extractEtsyListingId, classifyEtsyExpense 
} from '@/utils/normalization';
import { ETSY_EXPENSE_TYPES } from '@/config/appConfig';

export interface EtsyParseResult {
  saleRecords: EtsyRecord[];
  expenseRecords: EtsyExpenseRecord[];
}

function getCsvField(data: Record<string, any>, possibleKeys: string[]): string {
  const normKeys = possibleKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const [key, val] of Object.entries(data)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normKeys.includes(cleanKey)) {
      return val !== undefined && val !== null ? String(val).trim() : '';
    }
  }
  return '';
}

export const parseEtsyCsv = async (buffer: Buffer, importReference: string): Promise<EtsyParseResult> => {
  return new Promise((resolve, reject) => {
    const saleRecords: EtsyRecord[] = [];
    const expenseRecords: EtsyExpenseRecord[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => {
        const type = getCsvField(data, ['Type', 'Transaction Type', 'Kind']);
        const title = getCsvField(data, ['Title', 'Description', 'Details']);
        const info = getCsvField(data, ['Info', 'Details', 'Notes']);
        const dateRaw = getCsvField(data, ['Date', 'Transaction Date', 'Posted Date']);
        const netRaw = getCsvField(data, ['Net', 'Amount', 'Net Amount', 'Fees & Taxes', 'Net (INR)', 'Net (USD)']);

        if (!type && !title) return;

        const normalizedDate = normalizeDate(dateRaw) || '';
        const rawAmount = normalizeAmount(netRaw);
        const lowerType = type.toLowerCase();
        const lowerTitle = title.toLowerCase();

        // ─── SALE ROWS ─────────────────────────────────────────────────
        // Payment for order or type 'Sale' with positive sales amount
        if (lowerType === 'sale' || (lowerTitle.includes('payment for order') && rawAmount > 0)) {
          const orderNo = extractEtsyOrderNumber(title) || extractEtsyOrderNumber(info) || '';

          saleRecords.push({
            order_no: orderNo,
            date: normalizedDate,
            type: 'Sale',
            net_amt: rawAmount,
          });
          return;
        }

        // ─── EXPENSE ROWS ──────────────────────────────────────────────
        // All fees, taxes, refunds, listing costs, or negative amount transactions
        const isExpenseType = ['fee', 'tax', 'refund', 'listing', 'transaction', 'shipping', 'regulatory', 'processing'].some(t => lowerType.includes(t));
        const isExpenseTitle = ['fee', 'tax', 'tds', 'tcs', 'regulatory', 'processing', 'transaction', 'listing'].some(t => lowerTitle.includes(t));

        if (isExpenseType || isExpenseTitle || rawAmount < 0) {
          const expenseType = classifyEtsyExpense(type, title, info);
          
          // Extract order number (e.g., "TDS for Order #4103047120")
          const orderNo = extractEtsyOrderNumber(title) || extractEtsyOrderNumber(info) || '';
          
          // Extract listing ID for listing fees
          const listingId = (expenseType === ETSY_EXPENSE_TYPES.LISTING_EXPENSE || lowerTitle.includes('listing'))
            ? (extractEtsyListingId(title) || extractEtsyListingId(info))
            : null;

          // Etsy negative amounts (e.g., ₹-21) become positive expense amounts (₹21)
          const expenseAmount = Math.abs(rawAmount);

          if (expenseAmount > 0) {
            expenseRecords.push({
              order_no: orderNo,
              expense_type: expenseType,
              expense_amount: expenseAmount,
              source_transaction_type: type || 'Expense',
              source_description: `${title}${info ? ' | ' + info : ''}`.substring(0, 500),
              listing_id: listingId,
              import_reference: importReference,
            });
          }
        }
      })
      .on('end', () => resolve({ saleRecords, expenseRecords }))
      .on('error', (error) => reject(error));
  });
};