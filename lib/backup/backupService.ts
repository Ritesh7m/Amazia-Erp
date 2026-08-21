import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { getConnection, closeConnection, executeQuery } from '@/database';
import { backupConfig, validateConfig } from './config';
import { uploadToDrive, cleanUpDriveBackups } from './driveService';
import crypto from 'crypto';

let isBackupRunning = false;

function ensureBackupDirExists() {
  if (!existsSync(backupConfig.paths.localBackupDir)) {
    mkdirSync(backupConfig.paths.localBackupDir, { recursive: true });
  }
}

async function discoverDatabases(): Promise<string[]> {
  try {
    const files = await fs.readdir(backupConfig.paths.dbDirectory);
    return files.filter(file => file.endsWith('.db') || file.endsWith('.wal'));
  } catch (error: any) {
    console.error(`[Backup Service] Error discovering databases in ${backupConfig.paths.dbDirectory}:`, error.message);
    return [];
  }
}

async function cleanUpLocalBackups() {
  try {
    const files = await fs.readdir(backupConfig.paths.localBackupDir);
    const now = Date.now();
    const retentionMs = backupConfig.rules.retentionDays * 24 * 60 * 60 * 1000;

    // We should only clean up valid backups (e.g. .db or .wal) and ignore .tmp.db
    for (const file of files) {
      if (file.endsWith('.tmp.db') || file.endsWith('.tmp.wal') || file.endsWith('.tmp')) continue;
      
      const filePath = path.join(backupConfig.paths.localBackupDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > retentionMs) {
        await fs.unlink(filePath);
        console.log(`[Backup Service] Deleted old local backup: ${file}`);
      }
    }
  } catch (error: any) {
    console.error('[Backup Service] Error cleaning up local backups:', error.message);
  }
}

async function safeCopyFile(source: string, dest: string, maxRetries = 5) {
  let attempt = 1;
  let delay = 250;
  while (attempt <= maxRetries) {
    try {
      await fs.copyFile(source, dest);
      return attempt - 1; // Return number of retries used
    } catch (err: any) {
      if (['EBUSY', 'EPERM', 'EACCES'].includes(err.code) && attempt < maxRetries) {
        console.warn(`[Backup Service] File locked (${err.code}). Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 2, 4000); // Cap at 4s
        attempt++;
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

async function updateBackupStatus(backupId: string, status: string, errorMessage: string = '', retryCount: number = 0) {
  try {
    await executeQuery(`
      UPDATE backup_history 
      SET status = '${status}', 
          error_message = '${errorMessage.replace(/'/g, "''")}', 
          retry_count = retry_count + ${retryCount},
          completed_at = ${['COMPLETED', 'FAILED'].includes(status) ? 'CURRENT_TIMESTAMP' : 'completed_at'}
      WHERE backup_id = '${backupId}'
    `);
  } catch (err: any) {
    console.error(`[Backup Service] Failed to update backup status to ${status}:`, err.message);
  }
}

export async function runBackupWorkflow() {
  if (isBackupRunning) {
    console.log('[Backup Service] Backup is already running. Skipping this execution.');
    return;
  }
  
  isBackupRunning = true;
  console.log('=========================================');
  console.log(`[Backup Service] Starting backup workflow at ${new Date().toISOString()}`);
  
  const backupId = crypto.randomUUID();
  
  try {
    if (!validateConfig()) {
      console.warn('[Backup Service] Drive config incomplete. Proceeding with local backups only.');
    }

    ensureBackupDirExists();
    
    // Create initial record
    await executeQuery(`
      INSERT INTO backup_history (backup_id, status) VALUES ('${backupId}', 'STARTED')
    `);

    // Checkpoint
    await updateBackupStatus(backupId, 'CHECKPOINTING');
    try {
      console.log('[Backup Service] Forcing DuckDB checkpoint for consistent backup...');
      const conn = await getConnection();
      await new Promise<void>((resolve, reject) => {
        conn.run('FORCE CHECKPOINT;', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      conn.close();
      await closeConnection();
    } catch (err: any) {
      console.warn('[Backup Service] Failed to force checkpoint. Backup might be inconsistent:', err.message);
    }

    const databases = await discoverDatabases();
    if (databases.length === 0) {
      throw new Error("No database files (.db, .wal) found to backup.");
    }

    await updateBackupStatus(backupId, 'CREATING');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    let totalRetries = 0;
    
    for (const dbName of databases) {
      const sourcePath = path.join(backupConfig.paths.dbDirectory, dbName);
      
      let backupFileName = '';
      if (dbName.endsWith('.db.wal')) backupFileName = `${dbName.replace('.db.wal', '')}_${timestamp}.db.wal`;
      else if (dbName.endsWith('.db')) backupFileName = `${dbName.replace('.db', '')}_${timestamp}.db`;
      else backupFileName = `${dbName}_${timestamp}`;

      const tempBackupPath = path.join(backupConfig.paths.localBackupDir, backupFileName + '.tmp');
      const finalBackupPath = path.join(backupConfig.paths.localBackupDir, backupFileName);

      try {
        const retries = await safeCopyFile(sourcePath, tempBackupPath);
        totalRetries += retries;
        
        // Verify size > 0
        await updateBackupStatus(backupId, 'VERIFYING');
        const stats = await fs.stat(tempBackupPath);
        if (stats.size === 0) {
          throw new Error("Backup file size is 0 bytes");
        }
        
        // Rename to final
        await fs.rename(tempBackupPath, finalBackupPath);
        console.log(`[Backup Service] Created local backup: ${backupFileName}`);
        
        await updateBackupStatus(backupId, 'UPLOADING');
        if (backupConfig.google.folderId) {
          await uploadToDrive(finalBackupPath, backupFileName);
        }
      } catch (error: any) {
        // Cleanup temp file if exists
        try { if (existsSync(tempBackupPath)) await fs.unlink(tempBackupPath); } catch(e){}
        throw error; // Bubble up to fail the entire backup job
      }
    }

    console.log('[Backup Service] Running retention cleanup...');
    await cleanUpLocalBackups();
    if (backupConfig.google.folderId) {
      await cleanUpDriveBackups();
    }

    await updateBackupStatus(backupId, 'COMPLETED', '', totalRetries);
    console.log(`[Backup Service] Backup workflow completed successfully.`);

  } catch (error: any) {
    console.error(`[Backup Service] Backup failed:`, error.message);
    await updateBackupStatus(backupId, 'FAILED', error.message);
  } finally {
    isBackupRunning = false;
  }
}