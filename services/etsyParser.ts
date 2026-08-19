import csv from 'csv-parser';
import { Readable } from 'stream';
import { EtsyTransactionRecord } from '@/types';
import { 
  normalizeAmount, normalizeDate, extractEtsyOrderNumber,
  extractEtsyListingId 
} from '@/utils/normalization';
import { classifyEtsyTransaction } from '@/utils/financial-classifier';
import crypto from 'crypto';

export interface EtsyParseResult {
  transactionRecords: EtsyTransactionRecord[];
}

/**
 * Searches data fields matching possibleKeys in strict priority order.
 * Ignores empty strings and '--' dash placeholders.
 */
function getCsvField(data: Record<string, any>, possibleKeys: string[]): string {
  const dataMap = new Map<string, any>();
  for (const [k, v] of Object.entries(data)) {
    dataMap.set(k.toLowerCase().replace(/[^a-z0-9]/g, ''), v);
  }

  for (const key of possibleKeys) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (dataMap.has(cleanKey)) {
      const val = dataMap.get(cleanKey);
      if (val !== undefined && val !== null) {
        const strVal = String(val).trim();
        if (strVal !== '' && strVal !== '--') {
          return strVal;
        }
      }
    }
  }
  return '';
}

function generateTransactionHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export const parseEtsyCsv = async (buffer: Buffer): Promise<EtsyParseResult> => {
  return new Promise((resolve, reject) => {
    const transactionRecords: EtsyTransactionRecord[] = [];
    const stream = Readable.from(buffer);
    const hashOccurrence = new Map<string, number>();
    let rowNumber = 0;

    stream
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => {
        rowNumber++;
        const type = getCsvField(data, ['Type', 'Transaction Type', 'Kind']);
        const title = getCsvField(data, ['Title', 'Description', 'Details']);
        const info = getCsvField(data, ['Info', 'Details', 'Notes']);
        const dateRaw = getCsvField(data, ['Date', 'Transaction Date', 'Posted Date']);

        const feeRaw = getCsvField(data, ['Fees & Taxes', 'Fees & Taxes (INR)', 'Fees & Taxes (USD)', 'Fees', 'Fee']);
        const netRaw = getCsvField(data, ['Net', 'Net Amount', 'Net (INR)', 'Net (USD)']);
        const amountRaw = getCsvField(data, ['Amount', 'Gross', 'Gross Amount']);
        const currency = getCsvField(data, ['Currency', 'Curr']) || 'INR';
        const taxDetails = getCsvField(data, ['Tax Details', 'Tax']);

        if (!type && !title) return;

        const normalizedDate = normalizeDate(dateRaw) || '';
        const parsedFeeAmount = normalizeAmount(feeRaw);
        const parsedNetAmount = normalizeAmount(netRaw);
        const parsedAmount = normalizeAmount(amountRaw);

        const orderNo = extractEtsyOrderNumber(title) || extractEtsyOrderNumber(info) || '';
        
        const { scope, category } = classifyEtsyTransaction(type, title, info, !!orderNo);

        const listingId = (scope === 'ETSY' || title.toLowerCase().includes('listing'))
            ? (extractEtsyListingId(title) || extractEtsyListingId(info))
            : null;

        const normType = type.trim();
        const normTitle = title.trim();
        const normInfo = info.trim();
        const normCurrency = currency.trim().toUpperCase();
        const normTaxDetails = taxDetails.trim();
        
        // Transaction Fingerprint for deduplication
        const transactionHashData = `${normalizedDate}|${normType}|${normTitle}|${normInfo}|${normCurrency}|${parsedAmount}|${parsedFeeAmount}|${parsedNetAmount}|${normTaxDetails}`;
        const baseTransactionFingerprint = generateTransactionHash(transactionHashData);
        
        const occurrenceNo = (hashOccurrence.get(baseTransactionFingerprint) || 0) + 1;
        hashOccurrence.set(baseTransactionFingerprint, occurrenceNo);
        
        const transactionFingerprint = generateTransactionHash(`${baseTransactionFingerprint}|${occurrenceNo}`);
        
        transactionRecords.push({
          transaction_date: normalizedDate,
          type: normType,
          title: normTitle,
          info: normInfo,
          currency: normCurrency,
          amount: parsedAmount,
          fees_taxes: parsedFeeAmount,
          net_amount: parsedNetAmount,
          tax_details: normTaxDetails,
          order_no: orderNo,
          listing_id: listingId,
          transaction_scope: scope,
          transaction_category: category,
          transaction_fingerprint: transactionFingerprint,
          occurrence_no: occurrenceNo,
          source_row_number: rowNumber
        });
      })
      .on('end', () => resolve({ transactionRecords }))
      .on('error', (error) => reject(error));
  });
};