import { NextResponse } from 'next/server';
import { OrderFinancialService } from '@/services/financial/order-financial-service';

const formatMonth = (yyyyMm: string) => {
  const [year, month] = yyyyMm.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json({ success: false, error: 'Missing date range' }, { status: 400 });
    }

    const performanceData = await OrderFinancialService.getPerformance(from, to);

    const chartData = performanceData.map(item => ({
      ...item,
      month: formatMonth(item.month)
    }));

    return NextResponse.json({ success: true, data: chartData });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch performance data' }, { status: 500 });
  }
}