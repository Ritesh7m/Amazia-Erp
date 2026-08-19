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

  try {
    const { transactionRecords } = await parseEtsyCsv(fileBuffer);

    if (transactionRecords.length === 0) {
      return {
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        data: { success: false, message: 'No valid Etsy records found in the uploaded file.' }
      };
    }

    // 1. Idempotency Check
    const existing = await fetchQuery<any>(
      `SELECT id, status FROM import_history WHERE file_hash = ?`,
      [fileHash]
    );

    let importId: number;

    if (existing && existing.length > 0) {
      if (existing[0].status === 'SUCCESS') {
        return {
          status: HTTP_STATUS.CONFLICT,
          data: { success: true, message: 'This file has already been successfully imported.' }
        };
      } else {
        // Reuse the existing record if it failed previously
        importId = existing[0].id;
        const conn = await getConnection();
        await executePreparedStatement(conn, `UPDATE import_history SET status = 'PROCESSING' WHERE id = ?`, [importId]);
        conn.close();
      }
    } else {
      const conn = await getConnection();
      const importInsertQuery = `
        INSERT INTO import_history (
          file_name, file_hash, file_size, status, invoice_type, total_rows, imported_rows, failed_rows, processing_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
      `;
      const importRes = await new Promise<any[]>((resolve, reject) => {
        conn.all(importInsertQuery, 
          ...[fileName, fileHash, fileSize, 'PROCESSING', SUPPORTED_INVOICE_TYPES.ETSY, transactionRecords.length, 0, 0, 0], 
          (err: any, rows: any) => err ? reject(err) : resolve(rows || [])
        );
      });
      importId = importRes[0]?.id;
      conn.close();
    }

    let resultData: ApiResponse = { success: false, message: '' };

    await executeTransaction(async (conn: Connection) => {

      // 2. Insert Transactions
      let insertedCount = 0;
      const CHUNK_SIZE = 500;
      const newTransactions: EtsyTransactionRecord[] = [];
      
      for (let i = 0; i < transactionRecords.length; i += CHUNK_SIZE) {
        const chunk = transactionRecords.slice(i, i + CHUNK_SIZE);
        
        // Handle Sales
        const salesChunk = chunk.filter(tx => tx.transaction_category === 'SALE' && tx.order_no);
        if (salesChunk.length > 0) {
          const salesPlaceholders = salesChunk.map(() => '(?, ?, ?, ?, ?)').join(',');
          const salesValues = salesChunk.flatMap(tx => [
            tx.transaction_fingerprint, tx.order_no, tx.transaction_date, 'Sale', tx.amount
          ]);
          
          const salesInsertQuery = `
            INSERT INTO etsy_sales (
              transaction_hash, order_no, sale_date, type, gross_amount
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
        }
      }

      // 3. Allocate Etsy-Level Expenses
      const newSales = newTransactions.filter(t => t.transaction_category === 'SALE' && t.order_no);
      const uniqueSaleOrderNos = [...new Set(newSales.map(t => t.order_no))];

      const { groups, allocations } = await allocateEtsyLevelExpenses(
        conn, importId, newTransactions, uniqueSaleOrderNos
      );

      // 4. Update Import Record
      const processingTime = Date.now() - startTime;
      const updateImportQuery = `
        UPDATE import_history 
        SET status = 'SUCCESS', imported_rows = ?, failed_rows = 0, processing_time = ?
        WHERE id = ?
      `;
      await executePreparedStatement(conn, updateImportQuery, [
        insertedCount, processingTime, importId
      ]);
      
      // 5. Update Sync Metadata
      const syncMetaQuery = `
        UPDATE sync_metadata 
        SET last_processed_row = ?, last_sync_at = CURRENT_TIMESTAMP
        WHERE sync_name = 'etsy_statement'
      `;
      await executePreparedStatement(conn, syncMetaQuery, [insertedCount]);
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

    return {
      status: HTTP_STATUS.OK,
      data: resultData
    };

  } catch (error: any) {
    console.error('[Etsy Importer] Error during import:', error);
    
    // Attempt to mark as FAILED
    try {
      const conn = await getConnection();
      await executePreparedStatement(conn, `UPDATE import_history SET status = 'FAILED' WHERE file_hash = ?`, [fileHash]);
      conn.close();
    } catch (e) {
      console.error('[Etsy Importer] Could not update failure status:', e);
    }

    return {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data: { success: false, message: 'Database Error. Transaction rolled back.' }
    };
  }
};