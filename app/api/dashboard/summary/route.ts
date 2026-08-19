import { NextRequest, NextResponse } from 'next/server';
import { OrderFinancialService } from '@/services/financial/order-financial-service';
import { DashboardSummaryResponse, KPIData } from '@/lib/dashboard/dashboardTypes';

export const dynamic = 'force-dynamic';

function calculateKPI(current: number, previous: number): KPIData {
  let changePercentage: number | null = null;
  
  if (previous !== 0) {
    changePercentage = ((current - previous) / Math.abs(previous)) * 100;
    changePercentage = Math.round(changePercentage * 10) / 10;
  }

  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (changePercentage !== null) {
    if (changePercentage > 0) trend = 'up';
    if (changePercentage < 0) trend = 'down';
  }

  return {
    value: current,
    previousValue: previous,
    changePercentage: changePercentage !== null ? Math.abs(changePercentage) : null,
    trend
  };
}

function calculateMarginKPI(currentMargin: number, prevMargin: number): KPIData {
  if (prevMargin === 0 && currentMargin === 0) {
     return {
      value: 0,
      previousValue: 0,
      changePercentage: null,
      trend: 'neutral',
      isPercentagePoint: true
    };
  }

  let diff: number | null = currentMargin - prevMargin;
  
  // If there was no previous sales/margin, it's basically N/A comparison.
  if (prevMargin === 0) {
    diff = null;
  }

  const roundedDiff = diff !== null ? Math.round(diff * 10) / 10 : null;

  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (roundedDiff !== null) {
    if (roundedDiff > 0) trend = 'up';
    if (roundedDiff < 0) trend = 'down';
  }

  return {
    value: Math.round(currentMargin * 10) / 10,
    previousValue: Math.round(prevMargin * 10) / 10,
    changePercentage: roundedDiff !== null ? Math.abs(roundedDiff) : null,
    trend,
    isPercentagePoint: true
  };
}

export async function GET(req: NextRequest): Promise<NextResponse<DashboardSummaryResponse>> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json({ success: false, error: 'Missing date range parameters' }, { status: 400 });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const durationMs = toDate.getTime() - fromDate.getTime();
    
    const prevToDate = new Date(fromDate.getTime() - 1); 
    const prevFromDate = new Date(prevToDate.getTime() - durationMs);

    const prevFrom = prevFromDate.toISOString().split('T')[0];
    const prevTo = prevToDate.toISOString().split('T')[0];

    const currentSummary = await OrderFinancialService.getDashboardSummary(from, to);
    const prevSummary = await OrderFinancialService.getDashboardSummary(prevFrom, prevTo);

    const responseData = {
      totalSales: calculateKPI(currentSummary.totalSales, prevSummary.totalSales),
      totalExpenses: calculateKPI(currentSummary.totalExpenses, prevSummary.totalExpenses),
      grossProfit: calculateKPI(currentSummary.netProfit, prevSummary.netProfit),
      profitMargin: calculateMarginKPI(currentSummary.profitMargin, prevSummary.profitMargin),
      refundValue: calculateKPI(currentSummary.refundValue, prevSummary.refundValue),
    };

    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error('[Dashboard API] Failed to fetch summary data:', error);
    return NextResponse.json({ success: false, error: 'Unable to load dashboard data.' }, { status: 500 });
  }
}