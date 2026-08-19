import { NextRequest, NextResponse } from 'next/server';
import { OrderFinancialService } from '@/services/financial/order-financial-service';

export const dynamic = 'force-dynamic';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const q = searchParams.get('q') || '';
    const refundedOnly = searchParams.get('refundedOnly') === 'true';

    // Validate dates
    if (!from || !to) {
      return NextResponse.json(
        { success: false, message: 'Missing date range parameters (from, to).' },
        { status: 400 }
      );
    }

    if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      return NextResponse.json(
        { success: false, message: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    if (from > to) {
      return NextResponse.json(
        { success: false, message: 'Invalid date range: from date cannot be after to date.' },
        { status: 400 }
      );
    }

    // Support both 'limit' and 'pageSize' parameters
    const rawPageSize = searchParams.get('pageSize') || searchParams.get('limit') || '10';
    const rawPage = searchParams.get('page') || '1';

    // Validate pagination
    const pageSize = Math.max(1, Math.min(100, parseInt(rawPageSize) || 10));
    const page = Math.max(1, parseInt(rawPage) || 1);
    const offset = (page - 1) * pageSize;

    const { data, totalRecords } = await OrderFinancialService.getOrders(
      from,
      to,
      pageSize,
      offset,
      q,
      refundedOnly
    );

    return NextResponse.json({
      success: true,
      data,
      totalRecords,
      page,
      pageSize,
      totalPages: Math.ceil(totalRecords / pageSize),
    });
  } catch (error) {
    console.error('[Orders API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to load dashboard data.' },
      { status: 500 }
    );
  }
}