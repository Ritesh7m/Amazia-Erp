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