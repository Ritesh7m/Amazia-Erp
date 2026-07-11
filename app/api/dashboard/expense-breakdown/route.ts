import { NextRequest, NextResponse } from 'next/server';
import { getFedExExpenses, getMaterialExpenses } from '@/lib/dashboard/dashboardQueries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from || !to) return NextResponse.json({ success: false }, { status: 400 });

    const [fedex, materials] = await Promise.all([
      getFedExExpenses(from, to),
      getMaterialExpenses(from, to)
    ]);

    const total = fedex + materials;
    const fedexPct = total === 0 ? 0 : Math.round((fedex / total) * 1000) / 10;
    const matPct = total === 0 ? 0 : Math.round((materials / total) * 1000) / 10;

    const data = [
      { name: 'FedEx Expenses', value: fedex, percentage: fedexPct },
      { name: 'Material Expenses', value: materials, percentage: matPct }
    ];

    return NextResponse.json({ success: true, data, total });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load breakdown' }, { status: 500 });
  }
}