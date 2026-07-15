import { NextResponse } from 'next/server';
import { getMonthlySales, getMonthlyFedEx, getMonthlyMaterials } from '@/lib/dashboard/dashboardQueries';

// Formats '2026-06' into 'Jun 2026'
const formatMonth = (yyyyMm: string) => {
  const [year, month] = yyyyMm.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

// Generates an array of every "YYYY-MM" between the start and end dates
const generateMonthRange = (startDateStr: string, endDateStr: string) => {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const months = [];
  
  // Set to the 1st of the month to avoid timezone/day-skipping edge cases
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  
  while (current <= endMonth) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    // Move to the next month
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json({ success: false, error: 'Missing date range' }, { status: 400 });
    }

    const monthlySales = await getMonthlySales(from, to);
    const monthlyFedEx = await getMonthlyFedEx(from, to);
    const monthlyMaterials = await getMonthlyMaterials(from, to);

    // Get a continuous sequence of months regardless of whether data exists
    const allMonths = generateMonthRange(from, to);

    const chartData = allMonths.map(month => {
      // Look up the data for this specific month (will be undefined if nothing happened)
      const salesItem = monthlySales.find(s => s.month === month);
      const fedexItem = monthlyFedEx.find(f => f.month === month);
      const materialItem = monthlyMaterials.find(m => m.month === month);

      // Default to 0 if the item doesn't exist
      const salesAmount = salesItem?.total || 0;
      const dutyCost = fedexItem?.total || 0;
      const materialCost = materialItem?.total || 0;
      
      const expenses = dutyCost + materialCost;
      const profit = salesAmount - expenses;
      const margin = salesAmount > 0 ? ((profit / salesAmount) * 100).toFixed(1) : 0;

      return {
        month: formatMonth(month),
        sales: salesAmount,
        expenses: expenses,
        materialCost: materialCost, 
        dutyCost: dutyCost,         
        profit: profit,
        margin: margin
      };
    });

    return NextResponse.json({ success: true, data: chartData });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch performance data' }, { status: 500 });
  }
}