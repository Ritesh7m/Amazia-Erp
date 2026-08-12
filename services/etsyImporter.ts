import type { Connection } from 'duckdb';
import { parseEtsyCsv } from '@/services/etsyParser';
import { allocateListingExpenses } from '@/services/listingAllocation';
import { generateFileHash } from '@/utils/crypto';
import { fetchQuery, executeTransaction, executePreparedStatement, getConnection } from '@/database';
import { ApiResponse } from '@/types';
import { SUPPORTED_INVOICE_TYPES, HTTP_STATUS } from '@/constants';
import { etsyRowSchema } from '@/utils/validation';
import { ETSY_EXPENSE_TYPES } from '@/config/appConfig';

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
    // ─── DUPLICATE FILE CHECK ──────────────────────────────────────
    const existing = await fetchQuery<{ id: number }>(
      `SELECT id FROM import_history WHERE file_hash = ?`,
      [fileHash]
    );

    if (existing && existing.length > 0) {
      return {
        status: HTTP_STATUS.CONFLICT,
        data: { success: false, message: 'This file has already been imported.' }
      };
    }

    // ─── PARSE: Extract both sale records and expense records ───────
    const { saleRecords, expenseRecords } = await parseEtsyCsv(fileBuffer, fileHash);

    if (saleRecords.length === 0 && expenseRecords.length === 0) {
      return {
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        data: { success: false, message: 'No valid Etsy records found in the uploaded file.' }
      };
    }

    // ─── VALIDATE SALE RECORDS ─────────────────────────────────────
    let failedRowCount = 0;
    for (const record of saleRecords) {
      const validation = etsyRowSchema.safeParse(record);
      if (!validation.success) {
        failedRowCount++;
      }
    }

    // Rollback on any sale validation failure, no partial imports
    if (failedRowCount > 0) {
      const processingTime = Date.now() - startTime;
      const conn = await getConnection();
      const failHistoryQuery = `
        INSERT INTO import_history (
          file_name, file_hash, file_size, status, invoice_type,
          total_rows, imported_rows, failed_rows, processing_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await executePreparedStatement(conn, failHistoryQuery, [
        fileName, fileHash, fileSize, 'FAILED', SUPPORTED_INVOICE_TYPES.ETSY,
        saleRecords.length, 0, failedRowCount, processingTime
      ]);

      return {
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        data: {
          success: false,
          message: 'Validation failed.',
          totalRows: saleRecords.length,
          importedRows: 0,
          failedRows: failedRowCount,
          processingTime
        }
      };
    }

    // ─── DATABASE TRANSACTION ──────────────────────────────────────
    // Upload → Parse → Normalize → Validate → Calculate →
    // Begin Transaction → Insert Etsy records → Insert Etsy expenses →
    // Create listing allocations → Commit
    // Critical failure → ROLLBACK, no partial financial data.
    
    const totalRows = saleRecords.length + expenseRecords.length;

    await executeTransaction(async (conn: Connection) => {
      // 1. Insert sale records into etsy_statement
      const insertSaleQuery = `
        INSERT INTO etsy_statement (
          order_no, date, type, net_amt
        ) VALUES (?, ?, ?, ?)
      `;

      for (const record of saleRecords) {
        await executePreparedStatement(conn, insertSaleQuery, [
          record.order_no, record.date, record.type, record.net_amt
        ]);
      }

      // 2. Insert ALL expense records into etsy_expenses
      //    (Raw listing expenses store listing_id with empty order_no; allocated listing expenses get assigned order_no)
      const insertExpenseQuery = `
        INSERT INTO etsy_expenses (
          order_no, expense_type, expense_amount, 
          source_transaction_type, source_description, listing_id, import_reference
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
      `;

      for (const expense of expenseRecords) {
        await executePreparedStatement(conn, insertExpenseQuery, [
          expense.order_no,
          expense.expense_type,
          expense.expense_amount,
          expense.source_transaction_type,
          expense.source_description,
          expense.listing_id,
          expense.import_reference,
        ]);
      }

      // 3. Run listing allocation logic for eligible orders
      const saleOrderNos = saleRecords.map(r => r.order_no).filter(o => o.length > 0);
      const allocationRecords = await allocateListingExpenses(
        conn, expenseRecords, saleOrderNos, fileHash
      );

      // Insert allocated listing expense records
      for (const alloc of allocationRecords) {
        await executePreparedStatement(conn, insertExpenseQuery, [
          alloc.order_no,
          alloc.expense_type,
          alloc.expense_amount,
          alloc.source_transaction_type,
          alloc.source_description,
          alloc.listing_id,
          alloc.import_reference,
        ]);
      }

      // 4. Record import history
      const processingTime = Date.now() - startTime;
      const historyQuery = `
        INSERT INTO import_history (
          file_name, file_hash, file_size, status, invoice_type,
          total_rows, imported_rows, failed_rows, processing_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await executePreparedStatement(conn, historyQuery, [
        fileName, fileHash, fileSize, 'SUCCESS', SUPPORTED_INVOICE_TYPES.ETSY,
        totalRows, totalRows, 0, processingTime
      ]);
    });

    return {
      status: HTTP_STATUS.OK,
      data: {
        success: true, 
        message: `Import completed successfully. ${saleRecords.length} sales and ${expenseRecords.length} expenses processed.`,
        totalRows: totalRows, 
        importedRows: totalRows,
        failedRows: 0, 
        processingTime: Date.now() - startTime
      }
    };

  } catch (error) {
    console.error('[Etsy Importer] Error during import:', error);
    return {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data: { success: false, message: 'Database Error. Transaction rolled back.' }
    };
  }
};