import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { ETSY_EXPENSE_TYPES, type EtsyExpenseType } from '@/config/appConfig';

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
 * Applies the precise formula: book_expense_cost = amount - ((amount / 118) * 100)
 */
export const calculateBookExpenseCost = (amount: number): number => {
  const cost = amount - ((amount / 118) * 100);
  // Round to 2 decimal places for financial accuracy
  return Number(cost.toFixed(2));
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
 * Classifies an Etsy transaction into an expense type based on its description/title.
 * Uses case-insensitive matching on the combined description text.
 */
export const classifyEtsyExpense = (
  type: string,
  title: string,
  info: string
): EtsyExpenseType => {
  // Combine all text fields for matching, case-insensitive
  const combined = `${type} ${title} ${info}`.toLowerCase();

  // Order matters: match specific tax/fee types before general ones
  if (combined.includes('tds') || combined.includes('tax deducted')) return ETSY_EXPENSE_TYPES.TDS;
  if (combined.includes('tcs') || combined.includes('tax collected')) return ETSY_EXPENSE_TYPES.TCS;
  if (combined.includes('regulatory') || combined.includes('operating fee')) return ETSY_EXPENSE_TYPES.REGULATORY_OPERATING_FEE;
  if (combined.includes('processing')) return ETSY_EXPENSE_TYPES.PROCESSING_FEE;
  if (combined.includes('transaction')) return ETSY_EXPENSE_TYPES.TRANSACTION_FEE;
  if (combined.includes('sales tax') || combined.includes('tax paid by buyer')) return ETSY_EXPENSE_TYPES.SALES_TAX;
  if (combined.includes('listing')) return ETSY_EXPENSE_TYPES.LISTING_EXPENSE;

  return ETSY_EXPENSE_TYPES.OTHER_ETSY_EXPENSE;
};