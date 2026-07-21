// lib/backup/backupService.ts

import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { backupConfig, validateConfig } from './config';
import { uploadToDrive, cleanUpDriveBackups } from './driveService';

/**
 * Ensures the local backup directory exists before attempting to write to it.
 */
function ensureBackupDirExists() {
  if (!existsSync(backupConfig.paths.localBackupDir)) {
    mkdirSync(backupConfig.paths.localBackupDir, { recursive: true });
  }
}

/**
 * Scans the database directory and returns an array of all database files.
 */
async function discoverDatabases(): Promise<string[]> {
  try {
    const files = await fs.readdir(backupConfig.paths.dbDirectory);
    // Explicitly target SQLite files (.db and .wal)
    return files.filter(file => file.endsWith('.db') || file.endsWith('.wal'));
  } catch (error: any) {
    console.error(`[Backup Service] Error discovering databases in ${backupConfig.paths.dbDirectory}:`, error.message);
    return [];
  }
}

/**
 * Deletes local backups older than the configured retention period.
 */
async function cleanUpLocalBackups() {
  try {
    const files = await fs.readdir(backupConfig.paths.localBackupDir);
    const now = Date.now();
    const retentionMs = backupConfig.rules.retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(backupConfig.paths.localBackupDir, file);
      const stats = await fs.stat(filePath);
      
      // If the file is older than the retention period, delete it
      if (now - stats.mtimeMs > retentionMs) {
        await fs.unlink(filePath);
        console.log(`[Backup Service] Deleted old local backup: ${file}`);
      }
    }
  } catch (error: any) {
    console.error('[Backup Service] Error cleaning up local backups:', error.message);
  }
}

/**
 * The master orchestrator function that executes the full backup workflow.
 */
export async function runBackupWorkflow() {
  console.log('=========================================');
  console.log(`[Backup Service] Starting backup workflow at ${new Date().toISOString()}`);
  
  if (!validateConfig()) {
    console.warn('[Backup Service] Drive config incomplete. Proceeding with local backups only.');
  }

  ensureBackupDirExists();
  const databases = await discoverDatabases();

  if (databases.length === 0) {
    console.log('[Backup Service] No database files (.db, .wal) found to backup.');
    return;
  }

  // Create a safe, filesystem-friendly timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Process every discovered database
  for (const dbName of databases) {
    const sourcePath = path.join(backupConfig.paths.dbDirectory, dbName);
    
    // Correctly handle the file extensions for both the main db and the wal file
    let backupFileName = '';
    if (dbName.endsWith('.db.wal')) {
        backupFileName = `${dbName.replace('.db.wal', '')}_${timestamp}.db.wal`;
    } else if (dbName.endsWith('.db')) {
        backupFileName = `${dbName.replace('.db', '')}_${timestamp}.db`;
    } else {
        backupFileName = `${dbName}_${timestamp}`;
    }

    const localBackupPath = path.join(backupConfig.paths.localBackupDir, backupFileName);

    try {
      // 1. Create the Local Copy
      await fs.copyFile(sourcePath, localBackupPath);
      console.log(`[Backup Service] Created local backup: ${backupFileName}`);

      // 2. Upload to Google Drive (if folder ID is configured)
      if (backupConfig.google.folderId) {
        await uploadToDrive(localBackupPath, backupFileName);
      }
    } catch (error: any) {
      console.error(`[Backup Service] Failed to process backup for ${dbName}:`, error.message);
    }
  }

  // 3. Run Retention Cleanup for both Local and Drive
  console.log('[Backup Service] Running retention cleanup...');
  await cleanUpLocalBackups();
  
  if (backupConfig.google.folderId) {
    await cleanUpDriveBackups();
  }

  console.log(`[Backup Service] Backup workflow completed successfully.`);
}