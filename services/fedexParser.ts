import csv from 'csv-parser';
import { Readable } from 'stream';
import crypto from 'crypto';
import { FedexRecord } from '@/types';
import { normalizeAmount, normalizeDate, normalizeAwb, normalizeOrderNumber } from '@/utils/normalization';
import { isScientificNotation } from '@/utils/validation';

const AWB_POSSIBLE_KEYS = [
  'Air Waybill Number',
  'AWB',
  'Tracking Number',
  'Air Waybill',
  'Tracking ID',
  'AWB Number'
];

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

function hasMatchingHeader(headers: string[], possibleKeys: string[]): boolean {
  const cleanPossible = possibleKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return headers.some(h => {
    const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanPossible.includes(cleanH);
  });
}

export const parseFedexCsv = async (buffer: Buffer): Promise<FedexRecord[]> => {
  return new Promise((resolve, reject) => {
    const results: FedexRecord[] = [];
    const stream = Readable.from(buffer);
    let currentRowIndex = 1; // Row 1 is header
    let foundAwbHeader = false;
    let headerReceived = false;
    let validationFailed = false;

    console.log('[FedEx Validation] Checking Air Waybill Number column...');

    const csvParser = csv({
      mapHeaders: ({ header }) => header.trim()
    });

    csvParser.on('headers', (headers: string[]) => {
      headerReceived = true;
      foundAwbHeader = hasMatchingHeader(headers, AWB_POSSIBLE_KEYS);
      if (!foundAwbHeader) {
        validationFailed = true;
        const err = new Error("FedEx CSV rejected: Missing required column 'Air Waybill Number'.");
        console.error('[FedEx Validation] FAILED: Missing required Air Waybill Number column.');
        csvParser.destroy(err);
        return reject(err);
      }
    });

    csvParser.on('data', (data: Record<string, any>) => {
      if (validationFailed) return;
      currentRowIndex++;

      const invoiceType = getCsvField(data, ['Invoice Type', 'Invoice']);
      const invoiceDate = getCsvField(data, ['Invoice Date', 'Date']);
      const dueDate = getCsvField(data, ['Due Date']);
      const awbRaw = getCsvField(data, AWB_POSSIBLE_KEYS);
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

      // Skip empty/blank rows
      if (!invoiceDate && !awbRaw && !totalRaw && !shipperRefRaw) return;

      // Strict scientific notation detection on raw AWB value
      if (isScientificNotation(awbRaw)) {
        validationFailed = true;
        console.error(`[FedEx Validation] FAILED`);
        console.error(`[FedEx Validation] Row: ${currentRowIndex}`);
        console.error(`[FedEx Validation] Raw AWB: ${awbRaw}`);
        console.error(`[FedEx Validation] Reason: scientific notation`);

        const errorMsg = `FedEx CSV rejected: Invalid Air Waybill Number detected at Row ${currentRowIndex}: '${awbRaw}'. Air Waybill Numbers must be complete text values (e.g., 871000000000) and cannot be in scientific notation. Please format the Air Waybill Number column as Text in Excel and re-export the CSV.`;
        const err = new Error(errorMsg);
        csvParser.destroy(err);
        return reject(err);
      }

      const total = normalizeAmount(totalRaw);
      const formattedAwb = normalizeAwb(awbRaw);
      const rawShipperRef = shipperRefRaw ? String(shipperRefRaw).trim() : '';
      const parsedOrderNo = normalizeOrderNumber(rawShipperRef);
      const recipientCountry = countryRaw ? String(countryRaw).trim().toUpperCase() : '';
      const cleanInvType = invoiceType ? String(invoiceType).trim() : '';
      const cleanInvDate = normalizeDate(invoiceDate) || '';
      const cleanDueDate = normalizeDate(dueDate) || '';

      // Deterministic row fingerprint
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
    });

    csvParser.on('end', () => {
      if (validationFailed) return;
      if (!headerReceived) {
        const err = new Error('FedEx CSV rejected: The uploaded file is empty or invalid.');
        return reject(err);
      }
      console.log(`[FedEx Validation] Rows checked: ${results.length}`);
      console.log(`[FedEx Validation] Invalid scientific-notation AWBs: 0`);
      console.log(`[FedEx Validation] Validation passed`);
      resolve(results);
    });

    csvParser.on('error', (error) => {
      if (validationFailed) return;
      reject(error);
    });

    stream.pipe(csvParser);
  });
};