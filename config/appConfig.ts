// config/appConfig.ts
// Centralized configuration accessor — single source of truth for all business rules.

import configJson from './config.json';

// ─── Material Cost Factors ───────────────────────────────────────────────────
// Maps material type (case-insensitive) to cost per unit quantity.
// Only COTTON has a named factor; every other material maps to OTHER.
// To add future factors, add entries to config.json — never hardcode in SQL or React.

interface MaterialCostFactors {
  [key: string]: number;
}

const materialCostFactors: MaterialCostFactors = configJson.materialCostFactors;

export function getMaterialCostFactor(materialType: string | null | undefined): number | null {
  if (!materialType || materialType.trim() === '') {
    return null; // UNASSIGNED
  }
  const normalized = materialType.trim().toUpperCase();
  if (normalized === 'COTTON') {
    return materialCostFactors['COTTON'] ?? 90;
  }
  return materialCostFactors['OTHER'] ?? 100;
}

export function getMaterialCost(materialType: string, quantity: number): number | null {
  const factor = getMaterialCostFactor(materialType);
  if (factor === null) return null;
  return quantity * factor;
}

/**
 * Returns all configured material cost factors (for building SQL CASE expressions).
 */
export function getAllMaterialCostFactors(): MaterialCostFactors {
  return { ...materialCostFactors };
}

// ─── Inventory Limits ────────────────────────────────────────────────────────

export function getMaxQuantityPerOrder(): number {
  return configJson.inventory.maxQuantityPerOrder;
}

// ─── Dashboard Config ────────────────────────────────────────────────────────

export function getDashboardConfig() {
  return configJson.dashboard;
}

// ─── Etsy Expense Types ──────────────────────────────────────────────────────
// Centralized enum of all recognized Etsy expense categories.
// Used in parser classification, database storage, and dashboard display.

export const ETSY_TRANSACTION_SCOPES = {
  SALE: 'SALE',
  REFUND: 'REFUND',
  ORDER: 'ORDER',
  ETSY: 'ETSY',
  IGNORE: 'IGNORE',
} as const;

export type EtsyTransactionScope = typeof ETSY_TRANSACTION_SCOPES[keyof typeof ETSY_TRANSACTION_SCOPES];

export const ETSY_TRANSACTION_CATEGORIES = {
  SALE: 'SALE',
  REFUND: 'REFUND',
  DEPOSIT: 'DEPOSIT',
  LISTING_FEE: 'LISTING_FEE',
  ETSY_ADS: 'ETSY_ADS',
  OFFSITE_ADS: 'OFFSITE_ADS',
  TDS: 'TDS',
  TCS: 'TCS',
  REGULATORY_FEE: 'REGULATORY_FEE',
  TRANSACTION_FEE: 'TRANSACTION_FEE',
  PROCESSING_FEE: 'PROCESSING_FEE',
  SALES_TAX: 'SALES_TAX',
  BUYER_FEE: 'BUYER_FEE',
  OTHER_ORDER_EXPENSE: 'OTHER_ORDER_EXPENSE',
  OTHER_ETSY_EXPENSE: 'OTHER_ETSY_EXPENSE',
} as const;

export type EtsyTransactionCategory = typeof ETSY_TRANSACTION_CATEGORIES[keyof typeof ETSY_TRANSACTION_CATEGORIES];

export const ETSY_EXPENSE_LABELS: Record<string, string> = {
  LISTING_FEE: 'Etsy Listing Expense',
  ETSY_ADS: 'Etsy Ads',
  OFFSITE_ADS: 'Offsite Ads',
  REFUND: 'Refund',
  TDS: 'TDS',
  TCS: 'TCS',
  REGULATORY_FEE: 'Regulatory Operating Fee',
  TRANSACTION_FEE: 'Transaction Fee',
  PROCESSING_FEE: 'Processing Fee',
  SALES_TAX: 'Sales Tax',
  BUYER_FEE: 'Buyer Fee',
  OTHER_ORDER_EXPENSE: 'Other Order Expense',
  OTHER_ETSY_EXPENSE: 'Other Etsy Expense',
};
