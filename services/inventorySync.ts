//services\inventorySync.ts
import type { Connection } from 'duckdb';
import { fetchQuery, executeTransaction, executePreparedStatement, getConnection } from '@/database';
import { fetchNewInventoryRows } from './googleSheets';
import { processAndAggregateInventory } from './inventoryProcessor';


export const runInventorySync = async () => {
  const startTime = Date.now();
  console.log('-----------------------------------');
  console.log('[Scheduler]  Started Inventory Sync');

  try {
    // 1. Read Metadata
    const metadata = await fetchQuery<{ last_processed_row: number }>(
      `SELECT last_processed_row FROM sync_metadata WHERE sync_name = 'google_sheets_inventory'`
    );
    const lastProcessedRow = metadata[0]?.last_processed_row || 1;
    console.log(`[Scheduler] Resuming from row: ${lastProcessedRow}`);

    // 2. Fetch new rows only
    const apiStartTime = Date.now();
    console.log(`[Scheduler]  Fetching data from Google Sheets...`);
    const rawRows = await fetchNewInventoryRows(lastProcessedRow);
    const apiTime = Date.now() - apiStartTime;
    console.log(`[Scheduler]  Downloaded ${rawRows.length} rows in ${apiTime}ms`);

    if (rawRows.length === 0) {
      console.log(`[Scheduler] 🏁 No new rows found. Sync complete.`);
      return { success: true, message: 'No new rows to sync.' };
    }

    // 3. Process & Aggregate
    console.log(`[Scheduler] ⚙️ Processing and aggregating business rules...`);
    const processStartTime = Date.now();
    const { validRecords, skippedCount, maxRowIndex } = processAndAggregateInventory(rawRows);
    console.log(`[Scheduler] 🧠 Aggregation complete in ${Date.now() - processStartTime}ms. (Collapsed to ${validRecords.length} unique records)`);

    if (validRecords.length === 0) {
      const conn = await getConnection();
      await executePreparedStatement(conn, 
        `UPDATE sync_metadata SET last_processed_row = ?, last_sync_at = now() WHERE sync_name = 'google_sheets_inventory'`,
        [maxRowIndex]
      );
      return { success: true, message: 'Processed rows, but all were skipped.' };
    }
// 4. Database Transaction (Bulk UPSERT via Chunked SQL)
    console.log(`[Scheduler] 💾 Blasting ${validRecords.length} records into DuckDB (Multi-row Chunks)...`);
    const transactionStartTime = Date.now();
    let completedCount = 0;
    
    await executeTransaction(async (conn: Connection) => {
      
      // CHUNK OPTIMIZATION: Send 1000 rows in a single SQL string!
      const CHUNK_SIZE = 1000;

      for (let i = 0; i < validRecords.length; i += CHUNK_SIZE) {
        const chunk = validRecords.slice(i, i + CHUNK_SIZE);
        
        // Create exactly the right number of (?, ?, ?, ?, ?) placeholders
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
        
        // Flatten the data into a single 1D array for the prepared statement
        const params = chunk.flatMap(record => [
          record.order_no,
          record.material_type,
          record.category,
          record.color,
          record.quantity
         
        ]);

        const upsertQuery = `
          INSERT INTO inventory_table (order_no, material_type, category, color, quantity)
          VALUES ${placeholders}
          ON CONFLICT (order_no, material_type, category, color) DO UPDATE SET 
            quantity = EXCLUDED.quantity,
            updated_at = now();
        `;

        // Execute the massive query once per chunk
        await executePreparedStatement(conn, upsertQuery, params);
        
        completedCount += chunk.length;
      }

      // Update Metadata
      const updateMetadataQuery = `
        UPDATE sync_metadata 
        SET last_processed_row = ?, last_sync_at = now() 
        WHERE sync_name = 'google_sheets_inventory'
      `;
      await executePreparedStatement(conn, updateMetadataQuery, [maxRowIndex]);
    });

    const transactionTime = Date.now() - transactionStartTime;
    const totalTime = Date.now() - startTime;

    // 5. Logging
    console.log('[Scheduler] 🎉 Inventory Sync Successfully Completed!');
    console.log(`   - started_at: ${new Date(startTime).toISOString()}`);
    console.log(`   - downloaded_rows: ${rawRows.length}`);
    console.log(`   - aggregated_rows: ${validRecords.length}`);
    console.log(`   - inserted_rows: ${completedCount}`);
    console.log(`   - updated_rows: 0`);
    console.log(`   - skipped_rows: ${skippedCount}`);
    console.log(`   - failed_rows: 0`);
    console.log(`   - duration: ${totalTime}ms`);
    console.log(`   - final status: SUCCESS`);
    console.log('-----------------------------------');

    return { success: true, aggregatedRows: validRecords.length, skipped: skippedCount };

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.log('[Scheduler] ❌ Inventory Sync Failed!');
    console.log(`   - started_at: ${new Date(startTime).toISOString()}`);
    console.log(`   - duration: ${totalTime}ms`);
    console.log(`   - final status: FAILED`);
    console.error('[Scheduler] Sync Failed. Transaction Rolled Back.', error?.message || error);
    throw error;
  }
};