// lib/backup/scheduler.ts

import cron from 'node-cron';
import { runBackupWorkflow } from './backupService';
import { backupConfig } from './config';

console.log('=========================================');
console.log(`[Backup Scheduler] Initializing...`);
console.log(`[Backup Scheduler] Cron Schedule: ${backupConfig.rules.cronSchedule}`);
console.log(`[Backup Scheduler] Retention: ${backupConfig.rules.retentionDays} days`);
console.log('=========================================');

// Schedule the task
cron.schedule(backupConfig.rules.cronSchedule, async () => {
  console.log('[Backup Scheduler] Cron schedule triggered. Initiating backup...');
  await runBackupWorkflow();
});

