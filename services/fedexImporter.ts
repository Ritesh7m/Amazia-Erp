import type { Connection } from 'duckdb';
import { parseFedexCsv } from '@/services/fedexParser';
import { generateFileHash } from '@/utils/crypto';
import { executeTransaction, executePreparedStatement, fetchQuery } from '@/database';
import { ApiResponse } from '@/types';
import { HTTP_STATUS } from '@/constants';
import { fedexRowSchema } from '@/utils/validation';
import { runMappingAndAllocation } from '@/services/fedexMappingService';

interface ImportResult {
  status: number;
  data: ApiResponse & {
    billingRecords?: number;
    csvMappings?: number;
    apiMappings?: number;
    combinedMappings?: number;
    matchedBillingAwbs?: number;
    unmatchedBillingAwbs?: number;
    allocationRows?: number;
    reconciliationPassed?: boolean;
    diagnostics?: any;
    duplicateUpload?: boolean;
  };
}

export const processFedexImport = async (
  fileBuffer: Buffer,
  fileName: string,
  fileSize: number
): Promise<ImportResult> => {
  const startTime = Date.now();
  const fileHash = generateFileHash(fileBuffer);

  try {
    // 1. Check for Duplicate File Upload (Idempotency)
    const existingImports = await fetchQuery<any>(
      `SELECT id, file_name, imported_rows, completed_at FROM fedex_imports WHERE file_hash = ? AND status = 'COMPLETED'`,
      [fileHash]
    );

    if (existingImports && existingImports.length > 0) {
      return {
        status: HTTP_STATUS.OK,
        data: {
          success: true,
          message: `This FedEx billing file (${fileName}) has already been imported previously. Existing records retained.`,
          totalRows: existingImports[0].imported_rows || 0,
          importedRows: 0,
          duplicateUpload: true
        }
      };
    }

    // 2. Parse and Validate CSV structure
    const records = await parseFedexCsv(fileBuffer);
    if (records.length === 0) {
      return {
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        data: { success: false, message: 'No valid FedEx billing records found in the uploaded file.' }
      };
    }

    let failedRowCount = 0;
    for (const record of records) {
      const validation = fedexRowSchema.safeParse(record);
      if (!validation.success) {
        failedRowCount++;
      }
    }

    if (failedRowCount > 0) {
      return {
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        data: {
          success: false,
          message: `Validation failed: ${failedRowCount} rows did not match schema.`,
          totalRows: records.length,
          failedRows: failedRowCount,
          processingTime: Date.now() - startTime
        }
      };
    }

    // 3. Transactional Cumulative Ingestion, Mapping, and Allocation
    let mappingResult: any = null;

    await executeTransaction(async (conn: Connection) => {
      // Step A: Record new import in fedex_imports audit table
      const insertImportQuery = `
        INSERT INTO fedex_imports (file_name, file_hash, file_size, status, total_rows, imported_rows)
        VALUES (?, ?, ?, 'PROCESSING', ?, ?)
        RETURNING id;
      `;
      const importRes = await new Promise<any[]>((resolve, reject) => {
        conn.all(insertImportQuery, fileName, fileHash, fileSize, records.length, records.length, (err, rows) =>
          err ? reject(err) : resolve(rows || [])
        );
      });
      const importId = importRes && importRes.length > 0 ? importRes[0].id : null;

      // Step B: Append new cleaned CSV records into fedex_billing (CUMULATIVE - DO NOT DELETE PREVIOUS RECORDS)
      const insertRecordQuery = `
        INSERT INTO fedex_billing (
          billing_row_hash, invoice_type, invoice_date, due_date, awb_number, order_no, country,
          air_waybill_total_amount, file_hash, shipper_reference_1, parsed_order_no, recipient_country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      for (const record of records) {
        await executePreparedStatement(conn, insertRecordQuery, [
          record.billing_row_hash || null,
          record.invoice_type || null,
          record.invoice_date || null,
          record.due_date || null,
          record.awb_number,
          record.order_no || null,
          record.country || null,
          record.air_waybill_total_amount,
          fileHash,
          record.shipper_reference_1 || null,
          record.parsed_order_no || null,
          record.recipient_country || null
        ]);
      }

      // Step C: Update sync_metadata for fedex_billing
      const now = new Date();
      const syncMetaQuery = `
        INSERT INTO sync_metadata (sync_name, last_processed_row, last_sync_at, status) 
        VALUES ('fedex_billing', ?, ?, 'COMPLETED') 
        ON CONFLICT (sync_name) 
        DO UPDATE SET 
          last_processed_row = sync_metadata.last_processed_row + ?, 
          last_sync_at = ?,
          status = 'COMPLETED';
      `;
      await executePreparedStatement(conn, syncMetaQuery, [records.length, now, records.length, now]);

      // Step D: Rebuild mapping and allocations across ALL cumulative FedEx records
      mappingResult = await runMappingAndAllocation(conn);

      // Step E: Mark import completed
      if (importId) {
        const completedIso = new Date().toISOString();
        await executePreparedStatement(
          conn,
          `UPDATE fedex_imports SET status = 'COMPLETED', completed_at = ? WHERE id = ?`,
          [completedIso, importId]
        );
      }
    });

    console.log(`[FedEx Importer] Cumulative import complete: ${records.length} new records appended. Total billing records in DB: ${mappingResult?.billingRecords ?? 'N/A'}`);

    return {
      status: HTTP_STATUS.OK,
      data: {
        success: true,
        message: `FedEx import & reconciliation completed successfully. ${records.length} billing rows appended.`,
        totalRows: records.length,
        importedRows: records.length,
        failedRows: 0,
        processingTime: Date.now() - startTime,
        billingRecords: mappingResult?.billingRecords,
        csvMappings: mappingResult?.csvMappings,
        apiMappings: mappingResult?.apiMappings,
        combinedMappings: mappingResult?.combinedMappings,
        matchedBillingAwbs: mappingResult?.matchedBillingAwbs,
        unmatchedBillingAwbs: mappingResult?.unmatchedBillingAwbs,
        allocationRows: mappingResult?.allocationRows,
        reconciliationPassed: mappingResult?.reconciliationPassed ?? true,
        diagnostics: mappingResult?.diagnostics
      }
    };

  } catch (error: any) {
    console.error('[FedEx Importer] Error during import:', error);
    return {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data: { success: false, message: error?.message || 'Database error. Transaction rolled back.' }
    };
  }
};
