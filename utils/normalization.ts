import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { 
  ETSY_TRANSACTION_CATEGORIES, 
  ETSY_TRANSACTION_SCOPES, 
  type EtsyTransactionCategory, 
  type EtsyTransactionScope 
} from '@/config/appConfig';

// Extend dayjs to support strict format parsing
dayjs.extend(customParseFormat);

/**
 * Converts formatted currency strings (e.g., "₹4,891.30") to strict numbers (4891.30).
 */
export const normalizeAmount = (amountStr: string | number | undefined): number => {
  if (typeof amountStr === 'number') return amountStr;
  if (!amountStr || typeof amountStr !== 'string') return 0;

  // Strip everything except digits, decimal points, and minus signs
  const cleaned = amountStr.replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
};


/**
 * Normalizes specific CSV date strings to standard 'YYYY-MM-DD' for DuckDB.
 */
export const normalizeDate = (dateStr: string | undefined): string | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  
  // Try FedEx strict format: DD-MMM-YY (e.g., "01-Apr-26")
  const fedexDate = dayjs(trimmed, 'DD-MMM-YY', true);
  if (fedexDate.isValid()) {
    return fedexDate.format('YYYY-MM-DD');
  }

  // Try Etsy strict format: MMMM DD, YYYY (e.g., "June 30, 2026")
  const etsyDate = dayjs(trimmed, 'MMMM DD, YYYY', true);
  if (etsyDate.isValid()) {
    return etsyDate.format('YYYY-MM-DD');
  }

  // Fallback parsing for general cases
  const fallbackDate = dayjs(trimmed);
  if (fallbackDate.isValid()) {
    return fallbackDate.format('YYYY-MM-DD');
  }

  return null;
};

/**
 * Safe order number normalizer per plan.md section 2 & 17:
 * - trim whitespace
 * - treat as string
 * - split only on the FIRST "_" (e.g. "4032990276_1805" -> "4032990276")
 * - take first part as order number
 * - preserve leading zeros if any
 * - never convert to numeric types
 * - if "_" does not exist, use complete trimmed string
 * - if empty/null, return ""
 */
export const normalizeOrderNumber = (raw: string | number | null | undefined): string => {
  if (raw == null) return '';
  let str = String(raw).trim();
  if (!str) return '';
  if (str.startsWith('#')) {
    str = str.substring(1).trim();
  }
  const underscoreIdx = str.indexOf('_');
  if (underscoreIdx === -1) {
    return str;
  }
  return str.substring(0, underscoreIdx).trim();
};

/**
 * Centralized AWB normalizer per plan.md:
 * - convert to string
 * - trim whitespace
 * - preserve exact digits/characters
 * - never convert to JavaScript Number or perform mathematical operations
 * - remove accidental trailing ".0" or surrounding quotes
 * - preserve AWB as strict text
 */
export const normalizeAwb = (raw: any): string => {
  if (raw == null) return '';
  let str = String(raw).trim();
  if (!str) return '';

  // Remove surrounding quotes if present
  str = str.replace(/^["']+|["']+$/g, '').trim();

  // Remove accidental decimal suffix from CSV exports like .0, .00
  str = str.replace(/\.0+$/, '');

  // Strip spaces, dashes, commas
  str = str.replace(/[\s\-_,]/g, '').trim();

  return str;
};

/**
 * Extracts numeric order IDs from strings (e.g., "Payment for Order #4105054431" -> "4105054431")
 * Explicitly avoids matching listing IDs (e.g., "Listing #89001677").
 */
export const extractEtsyOrderNumber = (text: string | undefined): string | null => {
  if (!text || typeof text !== 'string') return null;

  // Explicitly match "Order #1234567890" or "Order 1234567890"
  const orderMatch = text.match(/\border\s*#?\s*(\d{8,12})/i);
  if (orderMatch) return orderMatch[1];

  // If text does NOT contain "Listing", allow matching "#1234567890"
  if (!/listing/i.test(text)) {
    const genericHashMatch = text.match(/#(\d{8,12})/);
    if (genericHashMatch) return genericHashMatch[1];
  }

  return null;
};

/**
 * Extracts Etsy listing IDs from description strings.
 * E.g., "Listing fee: Listing 1234567890" -> "1234567890"
 */
export const extractEtsyListingId = (text: string | undefined): string | null => {
  if (!text || typeof text !== 'string') return null;

  // Match patterns like "Listing 1234567890" or "listing #1234567890"
  const match = text.match(/[Ll]isting\s*#?(\d+)/);
  return match ? match[1] : null;
};

/**
 * Classifies an Etsy transaction into scope and category based on business rules.
 */
export const classifyEtsyTransaction = (
  type: string,
  title: string,
  info: string,
  hasOrderNo: boolean
): { scope: EtsyTransactionScope; category: EtsyTransactionCategory } => {
  const combined = `${type} ${title} ${info}`.toLowerCase();

  // Deposits
  if (type.toLowerCase() === 'deposit' || combined.includes('sent to your payoneer') || combined.includes('deposit')) {
    return { scope: ETSY_TRANSACTION_SCOPES.IGNORE, category: ETSY_TRANSACTION_CATEGORIES.DEPOSIT };
  }

  // Refunds
  if (type.toLowerCase() === 'refund' || combined.includes('refund for order') || combined.includes('partial refund')) {
    return { scope: ETSY_TRANSACTION_SCOPES.REFUND, category: ETSY_TRANSACTION_CATEGORIES.REFUND };
  }
  
  // Sales
  if (type.toLowerCase() === 'sale' || combined.includes('payment for order')) {
    return { scope: ETSY_TRANSACTION_SCOPES.SALE, category: ETSY_TRANSACTION_CATEGORIES.SALE };
  }

  // Etsy Ads
  if (combined.includes('etsy ads')) {
    return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: ETSY_TRANSACTION_CATEGORIES.ETSY_ADS };
  }

  // Offsite Ads
  if (combined.includes('offsite ads')) {
    return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: ETSY_TRANSACTION_CATEGORIES.OFFSITE_ADS };
  }

  // Listing Fee
  if (combined.includes('listing')) {
    return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: ETSY_TRANSACTION_CATEGORIES.LISTING_FEE };
  }

  // Order-level categories
  let category: EtsyTransactionCategory = ETSY_TRANSACTION_CATEGORIES.OTHER_ORDER_EXPENSE;
  
  if (combined.includes('tds') || combined.includes('tax deducted')) category = ETSY_TRANSACTION_CATEGORIES.TDS;
  else if (combined.includes('tcs') || combined.includes('tax collected')) category = ETSY_TRANSACTION_CATEGORIES.TCS;
  else if (combined.includes('regulatory') || combined.includes('operating fee')) category = ETSY_TRANSACTION_CATEGORIES.REGULATORY_FEE;
  else if (combined.includes('processing')) category = ETSY_TRANSACTION_CATEGORIES.PROCESSING_FEE;
  else if (combined.includes('transaction')) category = ETSY_TRANSACTION_CATEGORIES.TRANSACTION_FEE;
  else if (combined.includes('buyer fee')) category = ETSY_TRANSACTION_CATEGORIES.BUYER_FEE;
  else if (combined.includes('sales tax') || combined.includes('tax paid by buyer')) category = ETSY_TRANSACTION_CATEGORIES.SALES_TAX;

  // Determine scope based on presence of order number
  if (hasOrderNo) {
    return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category };
  }

  return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: category === ETSY_TRANSACTION_CATEGORIES.OTHER_ORDER_EXPENSE ? ETSY_TRANSACTION_CATEGORIES.OTHER_ETSY_EXPENSE : category };
};

/**
 * Derives a clean, human-readable product description from Etsy CSV Title and Info fields.
 * Per plan.md Section 4:
 * - Combine Title + Info
 * - Never expose JavaScript Date objects or raw date strings (e.g., "Fri Jul 31 2026 05:30:00 GMT+0530...")
 * - Strip out order numbers or prefixes like "Payment for Order #..."
 * - Never return Tax / Fee strings like "Tax collected at source (TCS)" as product description
 * - Returns a concise, clean product description (fallback: "Etsy Order Item")
 */
export const deriveProductDescription = (title: string | undefined, info: string | undefined): string => {
  const isNonProduct = (str: string): boolean => {
    const s = str.trim().toLowerCase();
    return (
      !s ||
      s.startsWith('tax collected') ||
      s.startsWith('tax deducted') ||
      s.startsWith('sales tax') ||
      s.startsWith('regulatory') ||
      s.startsWith('processing fee') ||
      s.startsWith('listing fee') ||
      s.startsWith('shipping fee') ||
      s.startsWith('buyer fee') ||
      s.startsWith('offsite ads') ||
      s.startsWith('etsy ads') ||
      s.startsWith('deposit') ||
      s.startsWith('payment for order') ||
      s.startsWith('refund for order') ||
      s === 'tcs' ||
      s === 'tds' ||
      s === 'gst' ||
      s === 'vat' ||
      s === 'etsy order item' ||
      /^order\s*#?\d+$/i.test(s)
    );
  };

  const cleanPart = (s: string | undefined): string => {
    if (!s) return '';
    let res = s.trim();
    // Remove raw date / timezone strings
    res = res.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b.*?(GMT[+-]\d{4}|India Standard Time|\b\d{4}\b)/gi, '');
    res = res.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/g, '');
    // Remove "Payment for Order #1234567890" or "Order #1234567890" or "#1234567890"
    res = res.replace(/payment\s+for\s+order\s*#?\s*\d+/gi, '');
    res = res.replace(/order\s*#?\s*\d+/gi, '');
    res = res.replace(/#\d{8,12}\b/g, '');
    // Strip transaction/fee prefixes so real product title is extracted (e.g. "Transaction fee: New Hydrangea PJs...")
    res = res.replace(/^(Transaction fee|Credit for transaction fee on):\s*/i, '');
    // Remove listing prefixes if in info/title
    res = res.replace(/listing\s*#?\s*\d+/gi, '');
    // Clean up multiple hyphens, colons, spaces
    res = res.replace(/^[ -:,|]+|[ -:,|]+$/g, '').trim();

    if (isNonProduct(res)) {
      return '';
    }
    return res;
  };

  const cleanTitle = cleanPart(title);
  const cleanInfo = cleanPart(info);

  if (cleanTitle && cleanInfo) {
    if (cleanTitle.toLowerCase().includes(cleanInfo.toLowerCase())) {
      return cleanTitle;
    }
    if (cleanInfo.toLowerCase().includes(cleanTitle.toLowerCase())) {
      return cleanInfo;
    }
    return `${cleanTitle} - ${cleanInfo}`.slice(0, 120);
  }

  if (cleanTitle) return cleanTitle.slice(0, 120);
  if (cleanInfo) return cleanInfo.slice(0, 120);

  return 'Etsy Order Item';
};

/**
 * Formats date into clean standard format "Jul 31 2026" (per plan.md Section 5 & 20)
 * Never exposes JavaScript Date objects or timezone strings.
 */
export const formatSalesDate = (dateVal: string | Date | null | undefined): string => {
  if (!dateVal) return 'N/A';
  const parsed = dayjs(dateVal);
  if (!parsed.isValid()) return String(dateVal);
  return parsed.format('MMM DD YYYY');
};

/**
 * Generates a deterministic SHA-256 transaction hash based strictly on:
 * Date + Title + Info + Amount + Type
 * with occurrence tracking for identical statement items within the same upload.
 * Per plan.md Section 3 & 14.
 */
export const generateDeterministicTransactionHash = (
  date: string,
  title: string,
  info: string,
  amount: number | string,
  type: string,
  occurrenceNo: number = 1
): string => {
  const normDate = date?.trim() || '';
  const normTitle = title?.trim() || '';
  const normInfo = info?.trim() || '';
  const normAmount = Number(amount || 0).toFixed(2);
  const normType = type?.trim() || '';
  
  const payload = `${normDate}|${normTitle}|${normInfo}|${normAmount}|${normType}|${occurrenceNo}`;
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(payload).digest('hex');
};