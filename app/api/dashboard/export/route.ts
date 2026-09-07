import { OrderFinancialService } from '@/services/financial/order-financial-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const q = searchParams.get('q') || '';
    const rawTab = searchParams.get('tab') as 'orders' | 'zero_sales' | 'refunds' | null;
    const refundedOnly = searchParams.get('refundedOnly') === 'true';
    const tab: 'orders' | 'zero_sales' | 'refunds' = rawTab || (refundedOnly ? 'refunds' : 'orders');

    if (!from || !to) {
      return new Response('Missing date range parameters (from, to)', { status: 400 });
    }

    const { data } = await OrderFinancialService.getOrders(from, to, 100000, 0, q, tab);

    // Exact order-level headers specified in plan.md Section 23
    const headers = [
      'Order Number',
      'Product',
      'Country',
      'Sale Date',
      'AWB(s)',
      'Sales',
      'Refund',
      'FedEx Cost',
      'Material',
      'Quantity',
      'Etsy Expenses',
      'Total Expense',
      'Direct NPF',
      'Margin'
    ];

    const csvRows = [headers.join(',')];

    for (const order of data) {
      const grossSales = Number(order.sales || 0);
      const refundValue = Number(order.refundAmount || 0);
      const netSales = Number(order.netSales ?? (grossSales - refundValue));
      const fedexCost = Number(order.fedexCost ?? order.dutyCost ?? 0);
      const materialCost = Number(order.materialCost || 0);
      const quantity = Number(order.quantity || 0);
      const etsyExpenses = Number(order.etsyExpenses || 0);
      const totalExpense = Number(order.totalExpense || (fedexCost + materialCost + etsyExpenses));
      const directNpf = Number(order.profit ?? (netSales - totalExpense));
      const marginStr = order.margin !== null && order.margin !== undefined && !isNaN(order.margin)
        ? `${order.margin.toFixed(1)}%`
        : 'N/A';

      const row = [
        `"${order.orderNo}"`,
        `"${(order.productTitle || 'Etsy Order Item').replace(/"/g, '""')}"`,
        `"${order.country || 'N/A'}"`,
        `"${order.saleDate}"`,
        `"=""${order.awbNumbers || 'N/A'}"""`,
        grossSales.toFixed(2),
        refundValue.toFixed(2),
        fedexCost.toFixed(2),
        materialCost.toFixed(2),
        quantity > 0 ? quantity : '',
        etsyExpenses.toFixed(2),
        totalExpense.toFixed(2),
        directNpf.toFixed(2),
        `"${marginStr}"`
      ];
      csvRows.push(row.join(','));
    }

    const csvString = csvRows.join('\n');

    return new Response(csvString, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="amazia-erp-report-${from}-to-${to}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Export API Error:', error);
    return new Response(error?.message || 'Failed to generate export report', { status: 500 });
  }
}