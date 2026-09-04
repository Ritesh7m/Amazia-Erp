import type { Connection } from 'duckdb';
import { parseEtsyCsv } from '@/services/etsyParser';
import { allocateEtsyLevelExpenses } from '@/services/listingAllocation';
import { generateFileHash } from '@/utils/crypto';
import { fetchQuery, executeTransaction, executePreparedStatement, getConnection } from '@/database';
import { ApiResponse, EtsyTransactionRecord } from '@/types';
import { SUPPORTED_INVOICE_TYPES, HTTP_STATUS } from '@/constants';
import { ETSY_TRANSACTION_SCOPES } from '@/config/appConfig';

interface ImportResult {
  status: number;
  data: ApiResponse;
}

export const processEtsyImport = async (
  fileBuffer: Buffer,
  fileName: string,
  fileSize: number
): Promise<ImportResult> => {
  const startTime = Date.now();
  const fileHash = generateFileHash(fileBuffer);
  console.log(`[Etsy Sync] Starting CSV processing: ${fileName} (${fileSize} bytes)`);

  try {
    const { transactionRecords } = await parseEtsyCsv(fileBuffer);
    console.log(`[Etsy Sync] Transactions parsed: ${transactionRecords.length}`);

    if (transactionRecords.length === 0) {
      console.warn(`[Etsy Sync] No valid Etsy records found in file.`);
      return {
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        data: { success: false, message: 'No valid Etsy records found in the uploaded file.' }
      };
    }

    // 1. Idempotency Check
    const existing = await fetchQuery<any>(
      `SELECT id, status, total_rows FROM etsy_imports WHERE file_hash = ?`,
      [fileHash]
    );

    if (existing && existing.length > 0 && existing[0].status === 'COMPLETED') {
      console.log(`[Etsy Sync] File already imported with status COMPLETED. Returning idempotent success.`);
      return {
        status: HTTP_STATUS.CONFLICT,
        data: { success: true, message: 'This file has already been successfully imported.' }
      };
    }

    console.log(`[Etsy Sync] Status → PROCESSING`);

    let resultData: ApiResponse = { success: false, message: '' };

    await executeTransaction(async (conn: Connection) => {
      // Step A: Insert or Update etsy_imports tracking record
      let importId: number;
      const nowIso = new Date().toISOString();
      if (existing && existing.length > 0) {
        importId = Number(existing[0].id);
        const updateProcessingQuery = `
          UPDATE etsy_imports 
          SET file_name = ?, file_size = ?, status = 'PROCESSING', total_rows = ?, created_at = ? 
          WHERE id = ?
        `;
        await executePreparedStatement(conn, updateProcessingQuery, [
          fileName, fileSize, transactionRecords.length, nowIso, importId
        ]);
      } else {
        const importInsertQuery = `
          INSERT INTO etsy_imports (
            file_name, file_hash, file_size, status, total_rows, new_rows, duplicate_rows, failed_rows, processing_time_ms, created_at
          ) VALUES (?, ?, ?, 'PROCESSING', ?, 0, 0, 0, 0, ?) RETURNING id;
        `;
        const importRes = await new Promise<any[]>((resolve, reject) => {
          conn.all(importInsertQuery, fileName, fileHash, fileSize, transactionRecords.length, nowIso, (err: any, rows: any) =>
            err ? reject(err) : resolve(rows || [])
          );
        });
        importId = Number(importRes[0]?.id);
      }

      // Step B: Set sync_metadata to PROCESSING
      const syncMetaProcessingQuery = `
        INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at, status)
        VALUES ('etsy_statement', ?, ?, 'PROCESSING')
        ON CONFLICT (sync_name)
        DO UPDATE SET
          last_processed_row = excluded.last_processed_row,
          last_sync_at = excluded.last_sync_at,
          status = excluded.status;
      `;
      await executePreparedStatement(conn, syncMetaProcessingQuery, [transactionRecords.length, nowIso]);

      // Step C: Insert Transactions in chunks
      let insertedCount = 0;
      const CHUNK_SIZE = 500;
      const newTransactions: EtsyTransactionRecord[] = [];
      
      for (let i = 0; i < transactionRecords.length; i += CHUNK_SIZE) {
        const chunk = transactionRecords.slice(i, i + CHUNK_SIZE);
        
        // Handle Sales
        const salesChunk = chunk.filter(tx => tx.transaction_category === 'SALE' && tx.order_no);
        if (salesChunk.length > 0) {
          // 2a. Insert Canonical Orders
          const orderPlaceholders = salesChunk.map(() => '(?, ?, ?)').join(',');
          const orderValues = salesChunk.flatMap(tx => [
            tx.order_no,
            tx.transaction_date,
            tx.product_description || 'Etsy Order Item'
          ]);
          const ordersInsertQuery = `
            INSERT INTO orders (order_no, sale_date, product_description)
            VALUES ${orderPlaceholders}
            ON CONFLICT (order_no) DO UPDATE SET
              product_description = COALESCE(NULLIF(excluded.product_description, 'Etsy Order Item'), orders.product_description)
          `;
          await new Promise<void>((resolve, reject) => {
            conn.run(ordersInsertQuery, ...orderValues, (err: any) => err ? reject(err) : resolve());
          });

          // 2b. Insert Sales Records
          const salesPlaceholders = salesChunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
          const salesValues = salesChunk.flatMap(tx => [
            tx.transaction_fingerprint,
            tx.order_no,
            tx.transaction_date,
            'Sale',
            tx.amount,
            tx.title || null,
            tx.info || null,
            tx.product_description || null,
            tx.quantity || 1
          ]);
          
          const salesInsertQuery = `
            INSERT INTO etsy_sales (
              transaction_hash, order_no, sale_date, type, gross_amount, title, info, product_description, quantity
            ) VALUES ${salesPlaceholders}
            ON CONFLICT (transaction_hash) DO NOTHING
            RETURNING transaction_hash
          `;
          
          const insertedSales = await new Promise<any[]>((resolve, reject) => {
            conn.all(salesInsertQuery, ...salesValues, (err: any, rows: any) => err ? reject(err) : resolve(rows || []));
          });
          
          insertedCount += insertedSales.length;
          const insertedSalesSet = new Set(insertedSales.map(r => r.transaction_hash));
          newTransactions.push(...salesChunk.filter(tx => insertedSalesSet.has(tx.transaction_fingerprint)));
        }

        // Handle Expenses / Refunds
        const expenseChunk = chunk.filter(tx => tx.transaction_category !== 'SALE');
        if (expenseChunk.length > 0) {
          const expensePlaceholders = expenseChunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
          const expenseValues = expenseChunk.flatMap(tx => [
            tx.transaction_fingerprint, tx.order_no || null, tx.transaction_date, tx.transaction_category,
            tx.title, tx.info, tx.currency, tx.amount, tx.fees_taxes, tx.net_amount, tx.tax_details,
            tx.listing_id, false, importId.toString(), null
          ]);
          
          const expenseInsertQuery = `
            INSERT INTO etsy_expenses (
              transaction_hash, order_no, expense_date, expense_type, title, info,
              currency, amount, fees_taxes, net_amount, tax_details, listing_id, is_allocation, import_reference, source_transaction_hash
            ) VALUES ${expensePlaceholders}
            ON CONFLICT (transaction_hash) DO NOTHING
            RETURNING transaction_hash
          `;
          
          const insertedExpenses = await new Promise<any[]>((resolve, reject) => {
            conn.all(expenseInsertQuery, ...expenseValues, (err: any, rows: any) => err ? reject(err) : resolve(rows || []));
          });
          
          insertedCount += insertedExpenses.length;
          const insertedExpenseSet = new Set(insertedExpenses.map(r => r.transaction_hash));
          newTransactions.push(...expenseChunk.filter(tx => insertedExpenseSet.has(tx.transaction_fingerprint)));

          // Update product_description on orders if found from expense
          for (const tx of expenseChunk) {
            if (tx.order_no && tx.product_description && tx.product_description !== 'Etsy Order Item' && !tx.product_description.toLowerCase().startsWith('tax')) {
              await new Promise<void>((resolve) => {
                conn.run(
                  `UPDATE orders SET product_description = ? WHERE order_no = ? AND (product_description IS NULL OR product_description = 'Etsy Order Item' OR product_description ILIKE 'Tax %' OR product_description ILIKE 'TCS%' OR product_description ILIKE 'TDS%' OR product_description ILIKE 'Processing fee%' OR product_description ILIKE 'Payment for Order%')`,
                  tx.product_description,
                  tx.order_no,
                  () => resolve()
                );
              });
            }
          }
        }
      }

      console.log(`[Etsy Sync] Inserted ${insertedCount} new transactions.`);

      // Step D: Allocate Etsy-Level Expenses (Listing Fees & Ads)
      const newSales = newTransactions.filter(t => t.transaction_category === 'SALE' && t.order_no);
      const uniqueSaleOrderNos = [...new Set(newSales.map(t => t.order_no))];

      const { groups, allocations } = await allocateEtsyLevelExpenses(
        conn, importId, newTransactions, uniqueSaleOrderNos
      );
      console.log(`[Etsy Sync] Allocations completed: ${allocations} allocation items.`);

      // Step E: Update Import Record to COMPLETED
      const processingTime = Date.now() - startTime;
      const duplicateRows = transactionRecords.length - insertedCount;
      const completedIso = new Date().toISOString();
      const finalUpdateQuery = `
        UPDATE etsy_imports 
        SET status = 'COMPLETED', completed_at = ?, total_rows = ?, new_rows = ?, duplicate_rows = ?, failed_rows = ?, processing_time_ms = ?
        WHERE id = ?
      `;
      await executePreparedStatement(conn, finalUpdateQuery, [
        completedIso, transactionRecords.length, insertedCount, duplicateRows, 0, processingTime, importId
      ]);
      
      // Step F: Update sync_metadata to COMPLETED
      const syncMetaQuery = `
        INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at, status) 
        VALUES ('etsy_statement', ?, ?, 'COMPLETED') 
        ON CONFLICT (sync_name) 
        DO UPDATE SET 
            last_processed_row = excluded.last_processed_row, 
            last_sync_at = excluded.last_sync_at,
            status = excluded.status;
      `;
      await executePreparedStatement(conn, syncMetaQuery, [transactionRecords.length, completedIso]);

      const grossSales = transactionRecords.filter(t => t.transaction_category === 'SALE').reduce((sum, t) => sum + (t.amount || 0), 0);
      const refunds = transactionRecords.filter(t => t.transaction_category === 'REFUND').reduce((sum, t) => sum + -(t.net_amount || 0), 0);
      const netSales = grossSales - refunds;
      
      const listingFeeCharges = transactionRecords.filter(t => t.transaction_category === 'LISTING_FEE' && (t.net_amount || 0) < 0).reduce((sum, t) => sum + -(t.net_amount || 0), 0);
      const listingFeeCredits = transactionRecords.filter(t => t.transaction_category === 'LISTING_FEE' && (t.net_amount || 0) > 0).reduce((sum, t) => sum + (t.net_amount || 0), 0);
      const netListingFees = transactionRecords.filter(t => t.transaction_category === 'LISTING_FEE').reduce((sum, t) => sum + -(t.net_amount || 0), 0);
      const etsyAds = transactionRecords.filter(t => t.transaction_category === 'ETSY_ADS').reduce((sum, t) => sum + -(t.net_amount || 0), 0);
      
      const etsyLevelPool = netListingFees + etsyAds;
      const offsiteAds = transactionRecords.filter(t => t.transaction_category === 'OFFSITE_ADS').reduce((sum, t) => sum + -(t.net_amount || 0), 0);
      const orderLevelFees = transactionRecords.filter(t => ['TRANSACTION_FEE', 'PROCESSING_FEE', 'REGULATORY_FEE', 'BUYER_FEE', 'OTHER_ORDER_EXPENSE', 'SHARE_AND_SAVE_REFUND'].includes(t.transaction_category)).reduce((sum, t) => sum + -(t.net_amount || 0), 0);
      const orderLevelTaxes = transactionRecords.filter(t => ['TCS', 'TDS', 'SALES_TAX'].includes(t.transaction_category)).reduce((sum, t) => sum + -(t.net_amount || 0), 0);
      
      const etsyOperatingExpenses = netListingFees + etsyAds + offsiteAds + orderLevelFees + orderLevelTaxes;
      const etsyOnlyProfit = netSales - etsyOperatingExpenses;

      resultData = {
        success: true,
        message: insertedCount === 0 ? "No new records imported. Existing records were skipped." : "Import completed successfully.",
        totalRows: transactionRecords.length,
        importedRows: insertedCount,
        newSales: newSales.length,
        newExpenses: newTransactions.length - newSales.length,
        duplicateSales: transactionRecords.filter(t => t.transaction_category === 'SALE').length - newSales.length,
        duplicateExpenses: (transactionRecords.length - transactionRecords.filter(t => t.transaction_category === 'SALE').length) - (newTransactions.length - newSales.length),
        newListingTransactions: newTransactions.filter(t => t.transaction_category === 'LISTING_FEE').length,
        duplicateListingTransactions: transactionRecords.filter(t => t.transaction_category === 'LISTING_FEE').length - newTransactions.filter(t => t.transaction_category === 'LISTING_FEE').length,
        newListingAllocations: allocations,
        processingTime,
        reconciliation: {
          grossSales,
          refunds,
          netSales,
          listingFeeCharges,
          listingFeeCredits,
          netListingFees,
          etsyAds,
          etsyLevelPool,
          offsiteAds,
          orderLevelFees,
          orderLevelTaxes,
          etsyOperatingExpenses,
          etsyOnlyProfit
        }
      };
    });

    console.log(`[Etsy Sync] All processing completed successfully.`);
    console.log(`[Etsy Sync] Status → COMPLETED`);

    return {
      status: HTTP_STATUS.OK,
      data: resultData
    };

  } catch (error: any) {
    console.error(`[Etsy Sync] Status → FAILED:`, error);
    
    // Mark as FAILED in database
    try {
      const conn = await getConnection();
      const errorMsg = error instanceof Error ? error.message : String(error);
      const failedNow = new Date();
      await executePreparedStatement(conn, `UPDATE etsy_imports SET status = 'FAILED', error_message = ?, completed_at = ? WHERE file_hash = ?`, [errorMsg, failedNow, fileHash]);
      await executePreparedStatement(conn, `INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at, status) VALUES ('etsy_statement', 0, ?, 'FAILED') ON CONFLICT (sync_name) DO UPDATE SET status = 'FAILED', last_sync_at = excluded.last_sync_at`, [failedNow]);
      conn.close();
    } catch (e) {
      console.error('[Etsy Sync] Could not update failure status in DB:', e);
    }

    return {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data: { success: false, message: 'Database Error. Transaction rolled back.' }
    };
  }
};