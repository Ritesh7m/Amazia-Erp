// lib/backup/config.ts

import path from 'path';

export const backupConfig = {
  // 1. Google Drive Settings
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    folderId: process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || '',
  },

  // 2. Local File System Settings
  paths: {
    // Directory where the active .duckdb files are located
    dbDirectory: process.env.DATABASE_DIR || path.join(process.cwd(), './'),
    // Directory where local copies of the backups will be temporarily/permanently stored
    localBackupDir: process.env.LOCAL_BACKUP_DIR || path.join(process.cwd(), 'backups'),
  },

  // 3. Backup Rules & Retention
  rules: {
    cronSchedule: process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *', // Default: 2 AM daily
    retentionDays: parseInt(process.env.RETENTION_DAYS || '7', 10),
    maxRetries: parseInt(process.env.MAX_UPLOAD_RETRIES || '3', 10),
  }
};

// Simple validation to ensure critical Drive credentials exist
export function validateConfig() {
  const missing: string[] = [];
  if (!backupConfig.google.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!backupConfig.google.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!backupConfig.google.refreshToken) missing.push('GOOGLE_REFRESH_TOKEN');
  
  if (missing.length > 0) {
    console.warn(`[Backup Config] Warning: Missing Drive credentials: ${missing.join(', ')}`);
  }
  return missing.length === 0;
}