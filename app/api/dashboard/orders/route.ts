import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/dashboard/dashboardQueries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const q = searchParams.get('q') || '';

    const limit = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: 'Missing dates' },
        { status: 400 }
      );
    }

      const { data, totalRecords } = await getOrders(
      from,
      to,
      limit,
      offset,
      q
    );

    return NextResponse.json({
      success: true,
      data,
      totalRecords,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to load orders' },
      { status: 500 }
    );
  }
}