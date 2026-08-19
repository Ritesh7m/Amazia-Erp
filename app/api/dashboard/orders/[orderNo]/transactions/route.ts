import { NextRequest, NextResponse } from 'next/server';
import { fetchQuery } from '@/database';
import { OrderFinancialService } from '@/services/financial/order-financial-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderNo: string }> }) {
  try {
    const { orderNo } = await params;

    if (!orderNo) {
      return NextResponse.json({ success: false, message: 'Order number is required' }, { status: 400 });
    }

    // Fetch order summary from centralized view
    const summaryRows = await fetchQuery<any>(`
      SELECT *
      FROM v_order_financials
      WHERE order_no = ?
    `, [orderNo]);

    if (!summaryRows || summaryRows.length === 0) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    const s = summaryRows[0];
    
    // Format summary mapping
    const summary = {
      orderNo: s.order_no,
      saleDate: s.sale_date,
      grossSales: Number(s.sales || 0),
      refundValue: Number(s.refunds || 0),
      adjustedSales: Number(s.net_sales || 0),
      materialCost: Number(s.material_cost || 0),
      fedexCost: Number(s.fedex_cost || 0),
      etsyExpenses: Number(s.etsy_expenses || 0),
      totalExpense: Number(s.total_expense || 0),
      netProfit: Number(s.profit || 0),
      profitMargin: Number(s.margin || 0),
      breakdown: {
        listingExpense: Number(s.etsy_listing_expense || 0),
        etsyAds: Number(s.etsy_ads_expense || 0),
        offsiteAds: Number(s.offsite_ads || 0),
        buyerFee: Number(s.buyer_fee || 0),
        tds: Number(s.tds || 0),
        tcs: Number(s.tcs || 0),
        transactionFee: Number(s.transaction_fee || 0),
        processingFee: Number(s.processing_fee || 0),
        salesTax: Number(s.sales_tax || 0),
        regulatoryFee: Number(s.regulatory_fee || 0),
      }
    };

    // Fetch detailed etsy_expenses rows
    const transactions = await fetchQuery<any>(`
      SELECT 
        expense_date as date,
        expense_type,
        title,
        amount,
        net_amount,
        currency,
        listing_id,
        is_allocation,
        import_reference
      FROM etsy_expenses
      WHERE order_no = ?
      ORDER BY expense_date DESC, created_at DESC
    `, [orderNo]);

    return NextResponse.json({
      success: true,
      summary,
      transactions: transactions || []
    });

  } catch (error) {
    console.error('[Order Details API] Error:', error);
    return NextResponse.json({ success: false, message: 'Unable to load order details.' }, { status: 500 });
  }
}
