import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/dashboard/dashboardQueries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const q = searchParams.get('q') || '';

    if (!from || !to) return new NextResponse('Missing dates', { status: 400 });

    // Fetch up to 10,000 records for the export
    const { data } = await getOrders(from, to, 10000, 0, q);

    // Convert JSON to CSV string
    const headers = ['Order No', 'Sale Date', 'Sales (INR)', 'Material Cost (INR)', 'Estimated Profit (INR)', 'Status'];
    const csvRows = [headers.join(',')];

    for (const row of data) {
      csvRows.push([
        row.orderNo,
        row.saleDate,
        row.sales,
        row.materialCost,
        row.estimatedProfitBeforeShipping,
        row.status
      ].join(','));
    }

    const csvString = csvRows.join('\n');

    
    return new NextResponse(csvString, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Business_Report_${from}_to_${to}.csv"`,
      },
    });

  } catch (error) {
    return new NextResponse('Failed to generate export', { status: 500 });
  }
}