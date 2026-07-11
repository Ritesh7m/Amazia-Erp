import { NextRequest, NextResponse } from 'next/server';
import { getActivityLogs } from '@/lib/dashboard/dashboardQueries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    // For preview, we only want 3. Default to 10 for the full page.
    const limit = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    const data = await getActivityLogs(limit, offset);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load activity' }, { status: 500 });
  }
}