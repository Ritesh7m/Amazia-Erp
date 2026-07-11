import { NextRequest, NextResponse } from 'next/server';
import { getMonthlySales, getMonthlyFedEx, getMonthlyMaterials } from '@/lib/dashboard/dashboardQueries';

export const dynamic = 'force-dynamic';

function generateMonthList(start: string, end: string) {
  const months = [];
  const curr = new Date(start);
  curr.setDate(1); // Set to 1st to avoid timezone skips at end-of-month
  const endDate = new Date(end);
  endDate.setDate(1);
  
  while (curr <= endDate) {
    const id = curr.toISOString().slice(0, 7); // "YYYY-MM"
    const label = curr.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); // "Apr 2025"
    months.push({ id, label });
    curr.setMonth(curr.getMonth() + 1);
  }
  return months;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from || !to) return NextResponse.json({ success: false }, { status: 400 });

    const [sales, fedex, materials] = await Promise.all([
      getMonthlySales(from, to),
      getMonthlyFedEx(from, to),
      getMonthlyMaterials(from, to)
    ]);

    const timeline = generateMonthList(from, to);
    
    const chartData = timeline.map(m => {
      const s = sales.find(x => x.month === m.id)?.total || 0;
      const f = fedex.find(x => x.month === m.id)?.total || 0;
      const mat = materials.find(x => x.month === m.id)?.total || 0;
      
      const expenses = f + mat;
      const profit = s - expenses;
      const margin = s === 0 ? 0 : Math.round((profit / s) * 1000) / 10;

      return {
        month: m.label,
        sales: s,
        expenses,
        profit,
        margin
      };
    });

    return NextResponse.json({ success: true, data: chartData });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch performance data' }, { status: 500 });
  }
}