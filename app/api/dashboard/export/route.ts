import { getOrders } from '@/lib/dashboard/dashboardQueries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return new Response('Missing date range', { status: 400 });
    }

    const { data } = await getOrders(from, to, 100000, 0, '');

    // 1. Define exact CSV Headers
    const headers = [
      'Order Number',
      'AWB Number(s)',
      'Customer Name',
      'Date',
      'Sales (INR)',
      'Material Cost (INR)',
      'Duty Cost (INR)',
      'Book Expenses (INR)',
      'Net Profit (INR)'
    ];

    // 2. Map data to CSV rows
    const csvRows = [headers.join(',')];

    for (const order of data) {
      const row = [
        `"${order.orderNo}"`,
        `"=""${order.awbNumbers}"""`, 
        `"${order.customerName}"`, 
        `"${order.saleDate}"`,
        order.sales.toFixed(2),
        order.materialCost.toFixed(2),
        order.dutyCost.toFixed(2),
        order.bookExpense.toFixed(2),
        order.estimatedProfitBeforeShipping.toFixed(2)
      ];
      csvRows.push(row.join(','));
    }

    const csvString = csvRows.join('\n');

    return new Response(csvString, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Amazia_ERP_Report_${from}_to_${to}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export API Error:', error);
    return new Response('Failed to generate export report', { status: 500 });
  }
}