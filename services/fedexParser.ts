import csv from 'csv-parser';
import { Readable } from 'stream';
import { FedexRecord } from '@/types';
import { normalizeAmount, normalizeDate, normalizeAwb, normalizeOrderNumber } from '@/utils/normalization';

/**
 * Searches data fields matching possibleKeys in strict priority order.
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

export const parseFedexCsv = async (buffer: Buffer): Promise<FedexRecord[]> => {
  return new Promise((resolve, reject) => {
    const results: FedexRecord[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('data', (data) => {
        const invoiceType = getCsvField(data, ['Invoice Type', 'Invoice']);
        const invoiceDate = getCsvField(data, ['Invoice Date', 'Date']);
        const dueDate = getCsvField(data, ['Due Date']);
        const awbRaw = getCsvField(data, ['Air Waybill Number', 'AWB', 'Tracking Number', 'Air Waybill', 'Tracking ID']);
        const totalRaw = getCsvField(data, ['Air Waybill Total Amount', 'Total Amount', 'Total Charge', 'Amount Due']);

        const shipperRefRaw = getCsvField(data, [
          'Shipper Reference 1',
          'Shipper Reference',
          'Shipper Ref 1',
          'Shipper Ref',
          'Reference'
        ]);

        const countryRaw = getCsvField(data, [
          'Recipient Address Country/Territory',
          'Recipient Address Country / Territory',
          'Recipient Country',
          'Recipient Country/Territory',
          'Country/Territory',
          'Country'
        ]);

        if (!invoiceDate && !awbRaw && !totalRaw && !shipperRefRaw) return;

        const total = normalizeAmount(totalRaw);
        const formattedAwb = normalizeAwb(awbRaw);
        const rawShipperRef = shipperRefRaw ? String(shipperRefRaw).trim() : '';
        const parsedOrderNo = normalizeOrderNumber(rawShipperRef);
        const recipientCountry = countryRaw ? String(countryRaw).trim().toUpperCase() : '';
        const cleanInvType = invoiceType ? String(invoiceType).trim() : '';
        const cleanInvDate = normalizeDate(invoiceDate) || '';
        const cleanDueDate = normalizeDate(dueDate) || '';

        // Deterministic row fingerprint
        const crypto = require('crypto');
        const rowFingerprint = `${cleanInvType}|${cleanInvDate}|${cleanDueDate}|${formattedAwb}|${rawShipperRef}|${total.toFixed(2)}|${recipientCountry}`;
        const billingRowHash = crypto.createHash('sha256').update(rowFingerprint).digest('hex');

        results.push({
          billing_row_hash: billingRowHash,
          invoice_type: cleanInvType,
          invoice_date: cleanInvDate,
          due_date: cleanDueDate,
          awb_number: formattedAwb,
          order_no: parsedOrderNo,
          country: recipientCountry,
          air_waybill_total_amount: total,
          shipper_reference_1: rawShipperRef,
          parsed_order_no: parsedOrderNo,
          recipient_country: recipientCountry
        });
      })
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};