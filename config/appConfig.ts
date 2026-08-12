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

/**
 * Returns the cost-per-unit for a given material type.
 * Case-insensitive: "cotton", "Cotton", "COTTON" all return the COTTON factor.
 * Any non-Cotton material returns the OTHER factor.
 */
export function getMaterialCostFactor(materialType: string): number {
  const normalized = materialType.trim().toUpperCase();
  return materialCostFactors[normalized] ?? materialCostFactors['OTHER'] ?? 100;
}

/**
 * Calculates the total material cost for a given material type and quantity.
 */
export function getMaterialCost(materialType: string, quantity: number): number {
  return quantity * getMaterialCostFactor(materialType);
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

export const ETSY_EXPENSE_TYPES = {
  LISTING_EXPENSE: 'LISTING_EXPENSE',
  TDS: 'TDS',
  TCS: 'TCS',
  REGULATORY_OPERATING_FEE: 'REGULATORY_OPERATING_FEE',
  TRANSACTION_FEE: 'TRANSACTION_FEE',
  PROCESSING_FEE: 'PROCESSING_FEE',
  SALES_TAX: 'SALES_TAX',
  OTHER_ETSY_EXPENSE: 'OTHER_ETSY_EXPENSE',
} as const;

export type EtsyExpenseType = typeof ETSY_EXPENSE_TYPES[keyof typeof ETSY_EXPENSE_TYPES];

/**
 * Human-readable labels for each expense type (used in dashboard UI).
 */
export const ETSY_EXPENSE_LABELS: Record<EtsyExpenseType, string> = {
  LISTING_EXPENSE: 'Etsy Listing Expense',
  TDS: 'TDS',
  TCS: 'TCS',
  REGULATORY_OPERATING_FEE: 'Regulatory Operating Fee',
  TRANSACTION_FEE: 'Transaction Fee',
  PROCESSING_FEE: 'Processing Fee',
  SALES_TAX: 'Sales Tax',
  OTHER_ETSY_EXPENSE: 'Other Etsy Expense',
};
