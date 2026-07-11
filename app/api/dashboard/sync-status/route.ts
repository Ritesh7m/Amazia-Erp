import { NextResponse } from 'next/server';
import { getSyncStatuses } from '@/lib/dashboard/dashboardQueries';
import { SyncStatusResponse } from '@/lib/dashboard/dashboardTypes';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse<SyncStatusResponse>> {
  try {
    const statuses = await getSyncStatuses();
    return NextResponse.json({ success: true, data: statuses });
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch sync status:', error);
    return NextResponse.json({ success: false, error: 'Failed to load sync status' }, { status: 500 });
  }
}