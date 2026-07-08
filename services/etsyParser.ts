import csv from 'csv-parser';
import { Readable } from 'stream';
import { EtsyRecord } from '@/types';
import { normalizeAmount, normalizeDate, extractEtsyOrderNumber } from '@/utils/normalization';

export const parseEtsyCsv = async (buffer: Buffer): Promise<EtsyRecord[]> => {
  return new Promise((resolve, reject) => {
    const results: EtsyRecord[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => {
        const type = data['Type'] ? String(data['Type']).trim() : '';

        // Strict CSV Filter: ONLY import Sale rows
        if (type !== 'Sale') return;

        const dateRaw = data['Date'];
        const title = data['Title'];
        const netRaw = data['Net'];

        const orderNo = extractEtsyOrderNumber(title);

        results.push({
          order_no: orderNo || '',
          date: normalizeDate(dateRaw) || '',
          type: type,
          net_amt: normalizeAmount(netRaw)
        });
      })
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};