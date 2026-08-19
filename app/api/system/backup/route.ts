import { NextResponse } from 'next/server';
import { runBackupWorkflow } from '@/lib/backup/backupService';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Run the backup asynchronously or wait for it.
    // Given that backups might take time, we will await it here for immediate feedback, 
    // but in a larger database this might need to be fire-and-forget.
    await runBackupWorkflow();
    return NextResponse.json({ success: true, message: 'Backup completed successfully.' });
  } catch (error: any) {
    console.error('[Backup API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Backup failed.', error: error.message },
      { status: 500 }
    );
  }
}
