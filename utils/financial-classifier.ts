import { ETSY_TRANSACTION_SCOPES } from '@/config/appConfig';

export function classifyEtsyTransaction(type: string, title: string, info: string, hasOrderNo: boolean): { scope: string, category: string } {
  const normType = type.toLowerCase();
  const normTitle = title.toLowerCase();
  const normInfo = info.toLowerCase();
  const combined = `${normType} ${normTitle} ${normInfo}`;

  if (normType.includes('tax') && normTitle.includes('refund to buyer for sales tax')) {
    return { scope: hasOrderNo ? ETSY_TRANSACTION_SCOPES.ORDER : ETSY_TRANSACTION_SCOPES.ETSY, category: 'SALES_TAX' };
  }

  if (normType.includes('sale') || normTitle.includes('payment for order')) {
    return { scope: ETSY_TRANSACTION_SCOPES.SALE, category: 'SALE' };
  }
  
  if (normType.includes('refund') || normTitle.includes('refund')) {
    // Specifically exclude "Share & Save refund" which is an Etsy credit, not a buyer refund.
    if (combined.includes('share & save refund') || combined.includes('share and save refund')) {
      return { scope: ETSY_TRANSACTION_SCOPES.ORDER, category: 'SHARE_AND_SAVE_REFUND' };
    }
    return { scope: ETSY_TRANSACTION_SCOPES.REFUND, category: 'REFUND' };
  }

  if (normType.includes('deposit')) {
    return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: 'DEPOSIT' };
  }

  // Listing Fees
  if (combined.includes('listing fee') || combined.includes('auto-renew sold')) {
    return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: 'LISTING_FEE' };
  }

  // Etsy Ads
  if (combined.includes('etsy ads')) {
    return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: 'ETSY_ADS' };
  }

  // Order-Level Expenses
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

  // Other Store-Level Expenses
  return { scope: ETSY_TRANSACTION_SCOPES.ETSY, category: 'OTHER_STORE_EXPENSE' };
}
