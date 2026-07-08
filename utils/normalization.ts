import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

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
 */
export const extractEtsyOrderNumber = (text: string | undefined): string | null => {
  if (!text || typeof text !== 'string') return null;
  
  const match = text.match(/#(\d+)/);
  return match ? match[1] : null;
};