import type { Connection } from 'duckdb';
import { parseFedexCsv } from '@/services/fedexParser';
import { generateFileHash } from '@/utils/crypto';
import { fetchQuery, executeTransaction, executePreparedStatement } from '@/database';
import { ApiResponse } from '@/types';
import { HTTP_STATUS } from '@/constants';
import { fedexRowSchema } from '@/utils/validation';
import { syncMappings } from '@/services/fedexMappingService';

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
    // 1. Idempotency check
    const existingImport = await fetchQuery<{ count: number }>(`SELECT COUNT(*) as count FROM fedex_billing WHERE file_hash = ?`, [fileHash]);
    if (existingImport && existingImport[0]?.count > 0) {
      return {
        status: HTTP_STATUS.OK,
        data: { success: true, message: 'File already imported successfully.' }
      };
    }

    // 2. Parse and Validate
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
          message: 'Validation failed.',
          totalRows: records.length,
          failedRows: failedRowCount,
          processingTime: Date.now() - startTime
        }
      };
    }

    // 3. Database Transaction to insert FedEx Records
    await executeTransaction(async (conn: Connection) => {
      const insertRecordQuery = `
        INSERT INTO fedex_billing (
          invoice_type, invoice_date, due_date, awb_number, air_waybill_total_amount, file_hash
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      for (const record of records) {
        await executePreparedStatement(conn, insertRecordQuery, [
          record.invoice_type, record.invoice_date, record.due_date,
          record.awb_number, record.air_waybill_total_amount, fileHash
        ]);
      }
    });

    console.log(`[FedEx Importer] Successfully imported ${records.length} records. Starting automatic mapping sync...`);

    // 4. Automatically trigger the mapping sync
    const syncResult = await syncMappings();
    
    if (!syncResult.success) {
      console.warn(`[FedEx Importer] Mapping sync failed but CSV was imported: ${syncResult.message}`);
    }

    return {
      status: HTTP_STATUS.OK,
      data: {
        success: true, 
        message: 'Import completed successfully. Mapping sync triggered.',
        totalRows: records.length, importedRows: records.length,
        failedRows: 0, processingTime: Date.now() - startTime
      }
    };

  } catch (error: any) {
    console.error('[FedEx Importer] Error during import:', error);
    return {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      data: { success: false, message: error?.message || 'Database Error. Transaction rolled back.' }
    };
  }
};
