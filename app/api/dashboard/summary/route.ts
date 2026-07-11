import { NextRequest, NextResponse } from 'next/server';
import { getTotalSales, getFedExExpenses, getMaterialExpenses } from '@/lib/dashboard/dashboardQueries';
import { DashboardSummaryResponse, KPIData } from '@/lib/dashboard/dashboardTypes';

export const dynamic = 'force-dynamic';

function calculateKPI(current: number, previous: number): KPIData {
  let changePercentage = 0;
  
  if (previous === 0) {
    changePercentage = current > 0 ? 100 : 0;
  } else {
    changePercentage = ((current - previous) / Math.abs(previous)) * 100;
  }

  changePercentage = Math.round(changePercentage * 10) / 10;

  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (changePercentage > 0) trend = 'up';
  if (changePercentage < 0) trend = 'down';

  return {
    value: current,
    previousValue: previous,
    changePercentage: Math.abs(changePercentage),
    trend
  };
}

function calculateMarginKPI(currentProfit: number, currentSales: number, prevProfit: number, prevSales: number): KPIData {
  const currentMargin = currentSales === 0 ? 0 : (currentProfit / currentSales) * 100;
  const prevMargin = prevSales === 0 ? 0 : (prevProfit / prevSales) * 100;
  
  const diff = currentMargin - prevMargin;
  const roundedDiff = Math.round(diff * 10) / 10;

  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (roundedDiff > 0) trend = 'up';
  if (roundedDiff < 0) trend = 'down';

  return {
    value: Math.round(currentMargin * 10) / 10,
    previousValue: Math.round(prevMargin * 10) / 10,
    changePercentage: Math.abs(roundedDiff),
    trend
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

    // 1. Calculate previous period dates for comparison
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const durationMs = toDate.getTime() - fromDate.getTime();
    
    const prevToDate = new Date(fromDate.getTime() - 1); 
    const prevFromDate = new Date(prevToDate.getTime() - durationMs);

    const prevFrom = prevFromDate.toISOString().split('T')[0];
    const prevTo = prevToDate.toISOString().split('T')[0];

    // 2. Fetch data for CURRENT period
    const [currentSales, currentFedEx, currentMaterial] = await Promise.all([
      getTotalSales(from, to),
      getFedExExpenses(from, to),
      getMaterialExpenses(from, to)
    ]);
    const currentExpenses = currentFedEx + currentMaterial;
    const currentProfit = currentSales - currentExpenses;

    // 3. Fetch data for PREVIOUS period
    const [prevSales, prevFedEx, prevMaterial] = await Promise.all([
      getTotalSales(prevFrom, prevTo),
      getFedExExpenses(prevFrom, prevTo),
      getMaterialExpenses(prevFrom, prevTo)
    ]);
    const prevExpenses = prevFedEx + prevMaterial;
    const prevProfit = prevSales - prevExpenses;

    // 4. Calculate KPIs
    const responseData = {
      totalSales: calculateKPI(currentSales, prevSales),
      totalExpenses: calculateKPI(currentExpenses, prevExpenses),
      grossProfit: calculateKPI(currentProfit, prevProfit),
      profitMargin: calculateMarginKPI(currentProfit, currentSales, prevProfit, prevSales),
    };

    return NextResponse.json({ success: true, data: responseData });

  } catch (error) {
    console.error('[Dashboard API] Failed to fetch summary data:', error);
    return NextResponse.json({ success: false, error: 'Failed to process dashboard summary' }, { status: 500 });
  }
}