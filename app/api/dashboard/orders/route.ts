import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/dashboard/dashboardQueries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    
    // For the preview, we only want 5 records. Default to 10 for the full page later.
    const limit = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    if (!from || !to) return NextResponse.json({ success: false }, { status: 400 });

    const data = await getOrders(from, to, limit, offset);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load orders' }, { status: 500 });
  }
}