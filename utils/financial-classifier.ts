import { ETSY_TRANSACTION_SCOPES } from '@/config/appConfig';

export function classifyEtsyTransaction(type: string, title: string, info: string, hasOrderNo: boolean): { scope: string, category: string } {
  const normType = type.toLowerCase().trim();
  const normTitle = title.toLowerCase().trim();
  const normInfo = info.toLowerCase().trim();
  const combined = `${normType} ${normTitle} ${normInfo}`;

  // 1. Sales Tax Refund
  if (normType.includes('tax') && normTitle.includes('refund to buyer for sales tax')) {
    return { scope: hasOrderNo ? ETSY_TRANSACTION_SCOPES.ORDER : ETSY_TRANSACTION_SCOPES.ETSY, category: 'SALES_TAX' };
  }

  // 2. Refunds
  if (normType === 'refund' || normType.includes('refund') || normTitle.startsWith('refund for order')) {
    // Specifically exclude "Share & Save refund" which is an Etsy credit, not a buyer refund.
    if (combined.includes('share & save refund') || combined.includes('share and save refund')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'SHARE_AND_SAVE_REFUND' };
    }
    return { scope: ETSY_TRANSACTION_SCOPES.REFUND, category: 'REFUND' };
  }

  // 3. Sales (ONLY actual Sale type or pure payment for order when type is not a fee/tax/refund/deposit)
  if (normType === 'sale' || normType.includes('sale') || (normType === '' && normTitle.startsWith('payment for order'))) {
    if (normType !== 'sale' && (combined.includes('sales tax') || combined.includes('tax paid by buyer'))) {
      return { scope: hasOrderNo ? ETSY_TRANSACTION_SCOPES.ORDER : ETSY_TRANSACTION_SCOPES.ETSY, category: 'SALES_TAX' };
    }
    return { scope: ETSY_TRANSACTION_SCOPES.SALE, category: 'SALE' };
  }

  // 4. Deposits / Transfers
  if (normType.includes('deposit')) {
    return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: 'DEPOSIT' };
  }

  // 5. Listing Fees & Renewals (captures listing fee, auto-renew sold, auto-renew expired, renew expired, private listing, multi-quantity, etc.)
  const isListingFee = 
    normType === 'listing' ||
    normType === 'listing fee' ||
    normTitle.includes('listing fee') ||
    normTitle.includes('auto-renew') ||
    normTitle.includes('auto renew') ||
    normTitle.includes('autorenew') ||
    normTitle.includes('renew expired') ||
    normTitle.includes('renew sold') ||
    normTitle.includes('renewal fee') ||
    normTitle.includes('listing renewal') ||
    normTitle.includes('private listing') ||
    normTitle.includes('multi-quantity') ||
    normTitle.includes('multi quantity') ||
    (normType.includes('fee') && (normTitle.startsWith('listing') || normTitle.startsWith('renew') || normTitle.startsWith('auto-renew') || normTitle.startsWith('auto renew')));

  if (isListingFee && !normTitle.includes('transaction fee')) {
    return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: 'LISTING_FEE' };
  }

  // 6. Etsy Ads
  if (combined.includes('etsy ads')) {
    return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: 'ETSY_ADS' };
  }

  // 7. Order-Level Expenses
  if (hasOrderNo) {
    if (combined.includes('tax collected at source') || combined.includes('tcs')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'TCS' };
    }
    if (combined.includes('tax deducted at source') || combined.includes('tds')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'TDS' };
    }
    if (combined.includes('transaction fee')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'TRANSACTION_FEE' };
    }
    if (combined.includes('processing fee')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'PROCESSING_FEE' };
    }
    if (combined.includes('sales tax') || combined.includes('tax paid by buyer')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'SALES_TAX' };
    }
    if (combined.includes('regulatory operating fee')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'REGULATORY_FEE' };
    }
    if (combined.includes('buyer fee') || combined.includes('retail delivery fee')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'BUYER_FEE' };
    }
    if (combined.includes('offsite ads')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'OFFSITE_ADS' };
    }

    return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'OTHER_ORDER_EXPENSE' };
  }

  // 8. Other Store-Level Expenses
  return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: 'OTHER_STORE_EXPENSE' };
}
