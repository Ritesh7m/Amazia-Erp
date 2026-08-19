import { NextRequest, NextResponse } from 'next/server';
import { OrderFinancialService } from '@/services/financial/order-financial-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from = searchParams.get('from') || '2000-01-01';
    const to = searchParams.get('to') || '2100-01-01';

    const result = await OrderFinancialService.reconcileFinancials(from, to);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Reconciliation error:', error);
    return NextResponse.json({ success: false, error: 'Reconciliation failed' }, { status: 500 });
  }
}
