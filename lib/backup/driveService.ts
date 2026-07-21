// lib/backup/driveService.ts

import { google } from 'googleapis';
import fs from 'fs';
import { backupConfig } from './config';

// 1. Initialize OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  backupConfig.google.clientId,
  backupConfig.google.clientSecret,
  backupConfig.google.redirectUri
);

// Set the refresh token for persistent offline access
oauth2Client.setCredentials({
  refresh_token: backupConfig.google.refreshToken,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

/**
 * Uploads a file to Google Drive with an automatic retry mechanism.
 */
export async function uploadToDrive(filePath: string, fileName: string, retryCount = 0): Promise<string | null> {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [backupConfig.google.folderId],
    };
    
    const media = {
      mimeType: 'application/octet-stream', // Binary stream for .duckdb files
      body: fs.createReadStream(filePath),
    };

    console.log(`[Backup Service] Uploading ${fileName} to Google Drive...`);
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    console.log(`[Backup Service] Successfully uploaded ${fileName}. Drive ID: ${response.data.id}`);
    return response.data.id || null;

  } catch (error: any) {
    if (retryCount < backupConfig.rules.maxRetries) {
      console.warn(`[Backup Service] Upload failed for ${fileName}. Retrying... (${retryCount + 1}/${backupConfig.rules.maxRetries})`);
      
      // Brief pause before retrying (2 seconds)
      await new Promise(res => setTimeout(res, 2000));
      return uploadToDrive(filePath, fileName, retryCount + 1);
    }
    
    console.error(`[Backup Service] Failed to upload ${fileName} after ${backupConfig.rules.maxRetries} retries:`, error.message);
    throw error;
  }
}

/**
 * Deletes backups from Google Drive that are older than the configured retention days.
 */
export async function cleanUpDriveBackups(): Promise<void> {
  try {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - backupConfig.rules.retentionDays);
    
    // Query: Files in the specific folder that are older than the retention date and not trashed
    const query = `'${backupConfig.google.folderId}' in parents and modifiedTime < '${retentionDate.toISOString()}' and trashed = false`;

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
    });

    const filesToDelete = response.data.files || [];

    if (filesToDelete.length === 0) {
      console.log(`[Backup Service] Drive retention check complete: No old backups to clean up.`);
      return;
    }

    // Delete each old file
    for (const file of filesToDelete) {
      if (file.id) {
        await drive.files.delete({ fileId: file.id });
        console.log(`[Backup Service] Deleted old Drive backup: ${file.name}`);
      }
    }
  } catch (error: any) {
    console.error(`[Backup Service] Error cleaning up Drive backups:`, error.message);
  }
}