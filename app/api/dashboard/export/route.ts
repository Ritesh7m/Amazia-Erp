import { OrderFinancialService } from '@/services/financial/order-financial-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const q = searchParams.get('q') || '';
    const refundedOnly = searchParams.get('refundedOnly') === 'true';

    if (!from || !to) {
      return new Response('Missing date range', { status: 400 });
    }

    const { data } = await OrderFinancialService.getOrders(from, to, 100000, 0, q, refundedOnly);

    const headers = [
      'Order Number',
      'AWB Number',
      'Sale Date',
      'Gross Sales',
      'Refund Value',
      'Adjusted Sales',
      'Material Cost',
      'FedEx Cost',
      'Etsy Listing Expense',
      'Etsy Ads',
      'Offsite Ads',
      'TDS',
      'TCS',
      'Transaction Fee',
      'Processing Fee',
      'Sales Tax',
      'Regulatory Fee',
      'Other Etsy Expense',
      'Total Expense',
      'Net Profit',
      'Profit Margin'
    ];

    const csvRows = [headers.join(',')];

    for (const order of data) {
      const b = order.expenseBreakdown;
      const otherEtsyExpense = b.etsyExpenses - (b.tds + b.tcs + b.transactionFee + b.processingFee + b.salesTax + b.regulatoryFee + b.buyerFee + b.offsiteAds);
      const row = [
        `"${order.orderNo}"`,
        `"=""${order.awbNumbers}"""`, 
        `"${order.saleDate}"`,
        order.sales.toFixed(2),
        (order.refundAmount || 0).toFixed(2),
        (order.sales - (order.refundAmount || 0)).toFixed(2),
        order.materialCost.toFixed(2),
        order.dutyCost.toFixed(2),
        b.listingExpense.toFixed(2),
        b.etsyAds.toFixed(2),
        b.offsiteAds.toFixed(2),
        b.tds.toFixed(2),
        b.tcs.toFixed(2),
        b.transactionFee.toFixed(2),
        b.processingFee.toFixed(2),
        b.salesTax.toFixed(2),
        b.regulatoryFee.toFixed(2),
        otherEtsyExpense.toFixed(2),
        order.totalExpense.toFixed(2),
        order.estimatedProfitBeforeShipping.toFixed(2),
        order.margin.toFixed(1)
      ];
      csvRows.push(row.join(','));
    }

    const csvString = csvRows.join('\n');

    return new Response(csvString, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="amazia-erp-report-${from}-to-${to}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export API Error:', error);
    return new Response('Failed to generate export report', { status: 500 });
  }
}