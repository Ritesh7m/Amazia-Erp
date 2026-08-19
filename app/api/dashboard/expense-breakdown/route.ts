import { NextRequest, NextResponse } from 'next/server';
import { OrderFinancialService } from '@/services/financial/order-financial-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const orderNo = searchParams.get('order_no') || searchParams.get('orderNo');

    if (orderNo) {
      const breakdown = await OrderFinancialService.getOrderExpenseBreakdown(orderNo);
      return NextResponse.json({ success: true, data: breakdown });
    }

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    
    if (!from || !to) {
      return NextResponse.json({ success: false, error: 'Missing date range or order_no' }, { status: 400 });
    }

    const breakdown = await OrderFinancialService.getExpenseBreakdown(from, to);
    
    const total = breakdown.totalExpenses;
    const safePct = (value: number) => total === 0 ? 0 : Math.round((value / total) * 1000) / 10;

    const data = [
      { name: 'Material Cost', value: breakdown.materialCost, percentage: safePct(breakdown.materialCost), isPrimary: true },
      { name: 'FedEx Duty/Transportation', value: breakdown.fedexDutyTransportation, percentage: safePct(breakdown.fedexDutyTransportation), isPrimary: true },
      { name: 'Etsy Listing Expense', value: breakdown.etsyListingExpense, percentage: safePct(breakdown.etsyListingExpense), isPrimary: true },
      { name: 'Etsy Ads', value: breakdown.etsyAds, percentage: safePct(breakdown.etsyAds), isPrimary: false },
      { name: 'Offsite Ads', value: breakdown.offsiteAds, percentage: safePct(breakdown.offsiteAds), isPrimary: false },
      { name: 'Other Etsy Expenses', value: breakdown.otherEtsyExpenses, percentage: safePct(breakdown.otherEtsyExpenses), isPrimary: false },
    ];

    return NextResponse.json({ success: true, data, total });
  } catch (error) {
    console.error('[Expense Breakdown API] Error loading expense breakdown:', error);
    return NextResponse.json({ success: false, error: 'Failed to load expense breakdown' }, { status: 500 });
  }
}