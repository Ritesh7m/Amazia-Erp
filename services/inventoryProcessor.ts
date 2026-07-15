import { RawSheetRow, InventoryRecord } from '@/types/inventory';
import { inventoryRowSchema } from '@/utils/inventoryValidation';

const MATERIAL_COST_MULTIPLIER = 250;

export const processAndAggregateInventory = (
  rawRows: RawSheetRow[]
): { validRecords: InventoryRecord[]; skippedCount: number; maxRowIndex: number } => {
  let skippedCount = 0;
  let maxRowIndex = 0;
  const aggregationMap = new Map<string, InventoryRecord>();

  for (const row of rawRows) {
    if (row.rowIndex > maxRowIndex) {
      maxRowIndex = row.rowIndex;
    }

    // 1. YEAR FILTER: Ignore 2022, 2023, 2024 records immediately
    const dateStr = row.date.toLowerCase();
    if (dateStr.includes('2022') || dateStr.includes('2023') || dateStr.includes('2024')) {
      skippedCount++;
      continue; 
    }

    // 2. STRICT VALIDATION: This drops the invalid names
    const validation = inventoryRowSchema.safeParse(row);
    if (!validation.success) {
      skippedCount++;
      continue;
    }

    // Normalization: Strip everything after "-"
    const normalizedOrderId = row.orderId.split('-')[0].trim();
    const quantity = parseFloat(row.quantity);

    // Business Key for Aggregation
    // FIX: We now group strictly by Order ID so quantities merge into one row
    const hashKey = normalizedOrderId;

    if (aggregationMap.has(hashKey)) {
      const existing = aggregationMap.get(hashKey)!;
      // Add the new quantity to the existing total
      existing.quantity += quantity;
      
      // Note: The material_type, category, and color will simply stay 
      // as whatever the very first item in the order was (e.g., "Cotton", "Lines", "Green").
    } else {
      aggregationMap.set(hashKey, {
        order_no: normalizedOrderId,
        material_type: row.materialType.trim(),
        category: row.category.trim(),
        color: row.color.trim(),
        quantity: quantity,
      });
    }
  }

  return {
    validRecords: Array.from(aggregationMap.values()),
    skippedCount,
    maxRowIndex
  };
};