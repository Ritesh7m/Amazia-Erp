//services\fedexParser.ts
import csv from 'csv-parser';
import { Readable } from 'stream';
import { FedexRecord } from '@/types';
import { normalizeAmount, normalizeDate, calculateBookExpenseCost } from '@/utils/normalization';

export const parseFedexCsv = async (buffer: Buffer): Promise<FedexRecord[]> => {
  return new Promise((resolve, reject) => {
    const results: FedexRecord[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => {
        const invoiceType = data['Invoice Type'];
        const invoiceDate = data['Invoice Date'];
        const dueDate = data['Due Date'];
        const awb = data['Air Waybill Number'];
        const amountRaw = data['Air Waybill Total Amount'];

        if (!invoiceType && !awb && !amountRaw) return;

        const amount = normalizeAmount(amountRaw);
        const bookExpenseCost = calculateBookExpenseCost(amount);

        // Fix Excel's scientific notation corruption (converts "8.90E+11" back to "890000000000")
        let formattedAwb = awb ? String(awb).trim() : '';
        if (formattedAwb.toUpperCase().includes('E')) {
          formattedAwb = Number(formattedAwb).toLocaleString('fullwide', { useGrouping: false });
        }

        results.push({
          invoice_type: invoiceType ? String(invoiceType).trim() : '',
          invoice_date: normalizeDate(invoiceDate) || '',
          due_date: normalizeDate(dueDate) || '',
          awb_number: formattedAwb,
          air_waybill_total_amount: amount,
          book_expense_cost: bookExpenseCost
        });
      })
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};