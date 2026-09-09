import type { Connection } from 'duckdb';
import { fetchQuery, executeTransaction, executePreparedStatement } from '@/database';
import { shopifyApi, ShopifyApiItem } from '@/services/shopifyApi';
import { normalizeOrderNumber } from '@/utils/normalization';

export interface ShopifySyncResult {
  success: boolean;
  message: string;
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  duplicateRecords: number;
  failedRecords: number;
  status: 'COMPLETED' | 'FAILED';
  error?: string;
}

/**
 * Deterministically shorten product descriptions to max ~12-15 words.
 */
export function shortenProductDescription(name: string, maxWords: number = 14): string {
  if (!name || !name.trim()) return 'Shopify Order Item';
  const clean = name.trim().replace(/\s+/g, ' ');
  const words = clean.split(' ');
  if (words.length <= maxWords) {
    return clean;
  }
  const shortened = words.slice(0, maxWords).join(' ');
  return shortened.replace(/[\s\-\–\—\:\,\#]+$/, '').trim();
}

/**
 * Parses diverse timestamp formats into SQL standard 'YYYY-MM-DD'.
 * Handles: '8/22/2025', '08/22/2025', '2025-08-22', '2025/08/22', ISO strings.
 */
export function normalizeDateToSql(rawDate: string | null | undefined): string | null {
  if (!rawDate || !rawDate.trim()) return null;
  const str = rawDate.trim();

  // 1. Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. Check M/D/YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 3. Fallback standard Date parsing
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Ignore error and fall through
  }

  return null;
}

export class ShopifySyncService {
  /**
   * Main synchronization routine.
   * Can be triggered by background Cron or manual API route.
   */
  static async runSync(): Promise<ShopifySyncResult> {
    const startTime = Date.now();
    const syncIdentifier = `sync_${Date.now()}`;
    console.log(`[Shopify Sync] ==========================================`);
    console.log(`[Shopify Sync] Shopify Sync Started: ${new Date().toISOString()}`);

    // Step 1: Fetch from external API
    const apiResult = await shopifyApi.fetchSales();
    if (!apiResult.success || !apiResult.data) {
      const errorMessage = apiResult.message || 'Failed to fetch sales from Shopify API';
      console.error(`[Shopify Sync] Sync aborted: ${errorMessage}`);
      
      // Record failed sync attempt
      try {
        const failIso = new Date().toISOString();
        await executeTransaction(async (conn: Connection) => {
          await executePreparedStatement(
            conn,
            `INSERT INTO shopify_imports (sync_identifier, total_records, status, error_message, completed_at)
             VALUES (?, 0, 'FAILED', ?, CAST(? AS TIMESTAMP));`,
            [syncIdentifier, errorMessage, failIso]
          );
          await executePreparedStatement(
            conn,
            `INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at, status)
             VALUES ('shopify_sales', 0, CAST(? AS TIMESTAMP), 'FAILED')
             ON CONFLICT (sync_name) DO UPDATE SET
               last_sync_at = excluded.last_sync_at,
               status = 'FAILED';`,
            [failIso]
          );
        });
      } catch (dbErr) {
        console.error('[Shopify Sync] Failed to record failure state:', dbErr);
      }

      return {
        success: false,
        message: errorMessage,
        totalRecords: 0,
        newRecords: 0,
        updatedRecords: 0,
        duplicateRecords: 0,
        failedRecords: 0,
        status: 'FAILED',
        error: errorMessage
      };
    }

    const rawData = apiResult.data;
    const entries = Object.entries(rawData);
    const totalRecords = entries.length;
    console.log(`[Shopify Sync] API Response Received. Records Received: ${totalRecords}`);

    if (totalRecords === 0) {
      console.log(`[Shopify Sync] API returned empty dataset (0 records). Preserving existing data.`);
      try {
        await executeTransaction(async (conn: Connection) => {
          await executePreparedStatement(
            conn,
            `INSERT INTO shopify_imports (sync_identifier, total_records, status, completed_at)
             VALUES (?, 0, 'COMPLETED', CURRENT_TIMESTAMP);`,
            [syncIdentifier]
          );
          await executePreparedStatement(
            conn,
            `INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at, status)
             VALUES ('shopify_sales', 0, CURRENT_TIMESTAMP, 'COMPLETED')
             ON CONFLICT (sync_name) DO UPDATE SET
               last_sync_at = excluded.last_sync_at,
               status = 'COMPLETED';`,
            []
          );
        });
      } catch (dbErr) {
        console.error('[Shopify Sync] Failed to record empty sync state:', dbErr);
      }

      return {
        success: true,
        message: 'Sync completed with 0 records returned.',
        totalRecords: 0,
        newRecords: 0,
        updatedRecords: 0,
        duplicateRecords: 0,
        failedRecords: 0,
        status: 'COMPLETED'
      };
    }

    // Step 2: Validate and Normalize Records
    interface NormalizedShopifyRecord {
      externalId: string;
      orderNo: string;
      saleDate: string;
      productDescription: string;
      originalProductName: string;
      salesAmount: number;
      usdValue: number;
      currency: string;
      source: string;
    }

    const normalizedRecords: NormalizedShopifyRecord[] = [];
    let failedValidationCount = 0;

    for (const [key, item] of entries) {
      try {
        const externalId = String(key).trim();
        if (!externalId) {
          failedValidationCount++;
          continue;
        }

        const rawOrderNo = item.orderNo || item.order_no || externalId;
        const orderNo = normalizeOrderNumber(rawOrderNo);
        if (!orderNo) {
          failedValidationCount++;
          continue;
        }

        const saleDate = normalizeDateToSql(item.timestamp) || new Date().toISOString().split('T')[0];
        const originalProductName = (item.itemName || item.item_name || 'Shopify Product').trim();
        const productDescription = shortenProductDescription(originalProductName);
        const salesAmount = Number(item.inrValue ?? item.inr_value ?? item.salesAmount ?? 0);
        const usdValue = Number(item.usdValue ?? item.usd_value ?? 0);

        normalizedRecords.push({
          externalId,
          orderNo,
          saleDate,
          productDescription,
          originalProductName,
          salesAmount,
          usdValue,
          currency: 'INR',
          source: 'SHOPIFY'
        });
      } catch (normErr) {
        console.warn(`[Shopify Sync] Validation error for key ${key}:`, normErr);
        failedValidationCount++;
      }
    }

    console.log(`[Shopify Sync] Records Validated: ${normalizedRecords.length} (Failed: ${failedValidationCount})`);

    // Step 3: Transactional Database Ingestion
    let newRecords = 0;
    let updatedRecords = 0;
    let duplicateRecords = 0;
    let importId: number = 0;

    try {
      await executeTransaction(async (conn: Connection) => {
        const nowIso = new Date().toISOString();

        // A. Insert tracking record in shopify_imports
        const importRes = await new Promise<any[]>((resolve, reject) => {
          conn.all(
            `INSERT INTO shopify_imports (sync_identifier, total_records, status, started_at)
             VALUES (?, ?, 'PROCESSING', CAST(? AS TIMESTAMP))
             RETURNING id;`,
            syncIdentifier,
            totalRecords,
            nowIso,
            (err, rows) => err ? reject(err) : resolve(rows || [])
          );
        });
        importId = Number(importRes[0]?.id || 0);

        // B. Fetch existing shopify_sales for idempotency check
        const existingSalesRows = await new Promise<any[]>((resolve, reject) => {
          conn.all(
            `SELECT external_id, order_no, sale_date, sales_amount, product_description, original_product_name, usd_value 
             FROM shopify_sales;`,
            (err, rows) => err ? reject(err) : resolve(rows || [])
          );
        });

        const existingSalesMap = new Map<string, any>();
        for (const row of existingSalesRows) {
          existingSalesMap.set(String(row.external_id), row);
        }

        // C. Process each normalized record
        for (const record of normalizedRecords) {
          const existing = existingSalesMap.get(record.externalId);

          if (!existing) {
            // New Record Insert
            await executePreparedStatement(
              conn,
              `INSERT INTO shopify_sales (
                order_no, external_id, sale_date, product_description, original_product_name, 
                sales_amount, currency, usd_value, source, created_at, updated_at
              ) VALUES (?, ?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, CAST(? AS TIMESTAMP), CAST(? AS TIMESTAMP));`,
              [
                record.orderNo,
                record.externalId,
                record.saleDate,
                record.productDescription,
                record.originalProductName,
                record.salesAmount,
                record.currency,
                record.usdValue,
                record.source,
                nowIso,
                nowIso
              ]
            );
            newRecords++;
          } else {
            // Compare fields to detect if anything changed
            const existingDate = existing.sale_date ? new Date(existing.sale_date).toISOString().split('T')[0] : '';
            const isDifferent = 
              Math.abs(Number(existing.sales_amount) - record.salesAmount) > 0.01 ||
              existingDate !== record.saleDate ||
              existing.product_description !== record.productDescription ||
              existing.order_no !== record.orderNo;

            if (isDifferent) {
              await executePreparedStatement(
                conn,
                `UPDATE shopify_sales 
                 SET order_no = ?, 
                     sale_date = CAST(? AS DATE), 
                     product_description = ?, 
                     original_product_name = ?, 
                     sales_amount = ?, 
                     usd_value = ?, 
                     updated_at = CAST(? AS TIMESTAMP)
                 WHERE external_id = ?;`,
                [
                  record.orderNo,
                  record.saleDate,
                  record.productDescription,
                  record.originalProductName,
                  record.salesAmount,
                  record.usdValue,
                  nowIso,
                  record.externalId
                ]
              );
              updatedRecords++;
            } else {
              duplicateRecords++;
            }
          }

          // D. Upsert Canonical Master `orders` Table
          await executePreparedStatement(
            conn,
            `INSERT INTO orders (order_no, sale_date, product_description, order_source, sales_source)
             VALUES (?, CAST(? AS DATE), ?, 'SHOPIFY', 'SHOPIFY')
             ON CONFLICT (order_no) DO UPDATE SET
               sale_date = COALESCE(orders.sale_date, excluded.sale_date),
               product_description = CASE 
                 WHEN orders.product_description IS NULL 
                   OR orders.product_description = 'External Order' 
                   OR orders.product_description = 'Etsy Order Item'
                 THEN excluded.product_description 
                 ELSE orders.product_description 
               END,
               sales_source = CASE 
                 WHEN orders.sales_source = 'ETSY_CSV' THEN 'ETSY_CSV'
                 ELSE 'SHOPIFY' 
               END,
               order_source = CASE
                 WHEN orders.order_source = 'ETSY_CSV' THEN 'ETSY_CSV'
                 ELSE COALESCE(orders.order_source, 'SHOPIFY')
               END;`,
            [record.orderNo, record.saleDate, record.productDescription]
          );
        }

        const completedIso = new Date().toISOString();

        // E. Finalize tracking record in shopify_imports
        await executePreparedStatement(
          conn,
          `UPDATE shopify_imports 
           SET total_records = ?, 
               new_records = ?, 
               updated_records = ?, 
               duplicate_records = ?, 
               failed_records = ?, 
               status = 'COMPLETED', 
               completed_at = CAST(? AS TIMESTAMP) 
           WHERE id = ?;`,
          [totalRecords, newRecords, updatedRecords, duplicateRecords, failedValidationCount, completedIso, importId]
        );

        // F. Update sync_metadata
        await executePreparedStatement(
          conn,
          `INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at, status)
           VALUES ('shopify_sales', ?, CAST(? AS TIMESTAMP), 'COMPLETED')
           ON CONFLICT (sync_name) DO UPDATE SET
             last_processed_row = excluded.last_processed_row,
             last_sync_at = excluded.last_sync_at,
             status = 'COMPLETED';`,
          [totalRecords, completedIso]
        );
      });
    } catch (dbError: any) {
      console.error('[Shopify Sync] Database transaction failed:', dbError);
      
      try {
        await executeTransaction(async (conn: Connection) => {
          if (importId) {
            await executePreparedStatement(
              conn,
              `UPDATE shopify_imports 
               SET status = 'FAILED', 
                   error_message = ?, 
                   completed_at = CURRENT_TIMESTAMP 
               WHERE id = ?;`,
              [dbError?.message || 'Database transaction failed', importId]
            );
          }
          await executePreparedStatement(
            conn,
            `UPDATE sync_metadata 
             SET status = 'FAILED', 
                 last_sync_at = CURRENT_TIMESTAMP 
             WHERE sync_name = 'shopify_sales';`,
            []
          );
        });
      } catch (cleanupErr) {
        console.error('[Shopify Sync] Failed to record error state:', cleanupErr);
      }

      return {
        success: false,
        message: dbError?.message || 'Transaction failed during Shopify sync',
        totalRecords,
        newRecords: 0,
        updatedRecords: 0,
        duplicateRecords: 0,
        failedRecords: totalRecords,
        status: 'FAILED',
        error: dbError?.message
      };
    }

    // Step 4: Structured Logging per Section 36 of plan.md
    console.log(`[Shopify Sync] -----------------------------`);
    console.log(`[Shopify Sync] Shopify Sync Completed in ${Date.now() - startTime}ms`);
    console.log(`[Shopify Sync] Received:   ${totalRecords}`);
    console.log(`[Shopify Sync] Inserted:   ${newRecords}`);
    console.log(`[Shopify Sync] Updated:    ${updatedRecords}`);
    console.log(`[Shopify Sync] Duplicates: ${duplicateRecords}`);
    console.log(`[Shopify Sync] Failed:     ${failedValidationCount}`);
    console.log(`[Shopify Sync] Status:     COMPLETED`);
    console.log(`[Shopify Sync] ==========================================`);

    return {
      success: true,
      message: `Shopify sync completed successfully. Inserted: ${newRecords}, Updated: ${updatedRecords}, Duplicates: ${duplicateRecords}.`,
      totalRecords,
      newRecords,
      updatedRecords,
      duplicateRecords,
      failedRecords: failedValidationCount,
      status: 'COMPLETED'
    };
  }
}
