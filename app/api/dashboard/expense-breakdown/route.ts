import { NextRequest, NextResponse } from 'next/server';
import { 
  getFedExExpenses, 
  getMaterialExpenses, 
  getExpenseBreakdownByCategory, 
  getOrderExpenseBreakdown 
} from '@/lib/dashboard/dashboardQueries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const orderNo = searchParams.get('order_no') || searchParams.get('orderNo');

    // Single order breakdown request (for Order Table modal)
    if (orderNo) {
      const breakdown = await getOrderExpenseBreakdown(orderNo);
      return NextResponse.json({ success: true, data: breakdown });
    }

    // Date range aggregated breakdown request (for Dashboard card)
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from || !to) {
      return NextResponse.json({ success: false, error: 'Missing date range or order_no' }, { status: 400 });
    }

    const [fedex, materials, etsyBreakdown] = await Promise.all([
      getFedExExpenses(from, to),
      getMaterialExpenses(from, to),
      getExpenseBreakdownByCategory(from, to),
    ]);

    let listingExpense = 0;
    let otherEtsyExpenses = 0;

    for (const item of etsyBreakdown) {
      if (item.expense_type === 'LISTING_EXPENSE') {
        listingExpense += item.total || 0;
      } else {
        otherEtsyExpenses += item.total || 0;
      }
    }

    const totalEtsyExpenses = listingExpense + otherEtsyExpenses;
    const total = fedex + materials + totalEtsyExpenses;

    const safePct = (value: number) => total === 0 ? 0 : Math.round((value / total) * 1000) / 10;

    const data = [
      { name: 'Material Cost', value: materials, percentage: safePct(materials), isPrimary: true },
      { name: 'FedEx Duty/Transportation', value: fedex, percentage: safePct(fedex), isPrimary: true },
      { name: 'Etsy Listing Expense', value: listingExpense, percentage: safePct(listingExpense), isPrimary: true },
      { name: 'Other Etsy Expenses', value: otherEtsyExpenses, percentage: safePct(otherEtsyExpenses), isPrimary: false },
    ];

    return NextResponse.json({ success: true, data, total });
  } catch (error) {
    console.error('[Expense Breakdown API] Error loading expense breakdown:', error);
    return NextResponse.json({ success: false, error: 'Failed to load expense breakdown' }, { status: 500 });
  }
}