import { NextResponse } from 'next/server';
// Notice the updated path going up three directories to reach the lib folder
import { runBackupWorkflow } from '../../../lib/backup/backupService';

export async function GET() {
  console.log('[API] Manual backup triggered');
  try {
    await runBackupWorkflow();
    return NextResponse.json({ success: true, message: 'Backup completed successfully!' }, { status: 200 });
  } catch (error) {
    console.error('[API] Backup failed:', error);
    return NextResponse.json({ success: false, error: 'Backup process failed' }, { status: 500 });
  }
}