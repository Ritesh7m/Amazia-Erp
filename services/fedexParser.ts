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
        // Strict mapping based on requested FedEx columns
        const invoiceType = data['Invoice Type'];
        const invoiceDate = data['Invoice Date'];
        const dueDate = data['Due Date'];
        const awb = data['Air Waybill Number'];
        const amountRaw = data['Air Waybill Total Amount'];

        // Skip completely empty rows
        if (!invoiceType && !awb && !amountRaw) return;

        const amount = normalizeAmount(amountRaw);
        const bookExpenseCost = calculateBookExpenseCost(amount);

        results.push({
          invoice_type: invoiceType ? String(invoiceType).trim() : '',
          invoice_date: normalizeDate(invoiceDate) || '',
          due_date: normalizeDate(dueDate) || '',
          awb_number: awb ? String(awb).trim() : '',
          air_waybill_total_amount: amount,
          book_expense_cost: bookExpenseCost
        });
      })
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};