import type { Connection } from 'duckdb';
import { parseFedexCsv } from '@/services/fedexParser';
import { generateFileHash } from '@/utils/crypto';
import { fetchQuery, executeTransaction, executePreparedStatement, getConnection } from '@/database';
import { ApiResponse } from '@/types';
import { SUPPORTED_INVOICE_TYPES, HTTP_STATUS } from '@/constants';
import { fedexRowSchema } from '@/utils/validation';

interface ImportResult {
  status: number;
  data: ApiResponse;
}

export const processFedexImport = async (
  fileBuffer: Buffer,
  fileName: string,
  fileSize: number
): Promise<ImportResult> => {
  const startTime = Date.now();
  const fileHash = generateFileHash(fileBuffer);

  try {
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

    const records = await parseFedexCsv(fileBuffer);

    if (records.length === 0) {
      return {
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        data: { success: false, message: 'No valid FedEx billing records found in the uploaded file.' }
      };
    }

    // --- PHASE 11: Strict Zod Validation ---
    let failedRowCount = 0;
    for (const record of records) {
      const validation = fedexRowSchema.safeParse(record);
      if (!validation.success) {
        failedRowCount++;
      }
    }

    // Rollback on any failure, no partial imports
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
        fileName, fileHash, fileSize, 'FAILED', SUPPORTED_INVOICE_TYPES.FEDEX,
        records.length, 0, failedRowCount, processingTime
      ]);

      return {
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        data: {
          success: false,
          message: 'Validation failed.',
          totalRows: records.length,
          importedRows: 0,
          failedRows: failedRowCount,
          processingTime
        }
      };
    }

    // Database Transaction
    await executeTransaction(async (conn: Connection) => {
      const insertRecordQuery = `
        INSERT INTO fedex_billing (
          invoice_type, invoice_date, due_date, awb_number, air_waybill_total_amount, book_expense_cost
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      for (const record of records) {
        await executePreparedStatement(conn, insertRecordQuery, [
          record.invoice_type, record.invoice_date, record.due_date,
          record.awb_number, record.air_waybill_total_amount, record.book_expense_cost
        ]);
      }

      const processingTime = Date.now() - startTime;
      const historyQuery = `
        INSERT INTO import_history (
          file_name, file_hash, file_size, status, invoice_type,
          total_rows, imported_rows, failed_rows, processing_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await executePreparedStatement(conn, historyQuery, [
        fileName, fileHash, fileSize, 'SUCCESS', SUPPORTED_INVOICE_TYPES.FEDEX,
        records.length, records.length, 0, processingTime
      ]);
    });

    return {
      status: HTTP_STATUS.OK,
      data: {
        success: true, message: 'Import completed successfully.',
        totalRows: records.length, importedRows: records.length,
        failedRows: 0, processingTime: Date.now() - startTime
      }
    };

  } catch (error) {
    console.error('[FedEx Importer] Error during import:', error);
    return {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data: { success: false, message: 'Database Error. Transaction rolled back.' }
    };
  }
};