import { NextResponse } from 'next/server';
import { fetchQuery } from '@/database'; 

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ data: [] });
    }

    let orderNoQuery = query.trim();
    let awbQuery = query.trim();

    if (query.startsWith('#')) {
      orderNoQuery = query.substring(1).trim();
      awbQuery = 'NOT_MATCHING_ANYTHING_UNLESS_ORDER';
    } else if (query.toUpperCase().startsWith('AWB-')) {
      awbQuery = query.substring(4).trim();
      orderNoQuery = 'NOT_MATCHING_ANYTHING_UNLESS_AWB';
    }

    const orderSearchValue = `%${orderNoQuery}%`;
    const awbSearchValue = `%${awbQuery}%`;

    const sqlQuery = `
      SELECT
        CAST(o.order_no AS VARCHAR) AS order_no,
        CAST(o.sale_date AS VARCHAR) AS sale_date,
        o.product_title,
        o.country,
        o.sales,
        o.refunds,
        o.net_sales,
        o.material_cost,
        o.fedex_cost,
        o.awb_numbers,
        o.etsy_listing_expense AS listing_expense,
        o.etsy_ads_expense,
        o.offsite_ads,
        o.tds,
        o.tcs,
        o.transaction_fee,
        o.processing_fee,
        o.sales_tax,
        o.regulatory_fee,
        o.buyer_fee,
        o.etsy_expenses,
        o.total_expense,
        o.profit AS netProfit,
        o.margin,
        o.refund_status
      FROM v_order_financials o
      WHERE CAST(o.order_no AS VARCHAR) ILIKE ? 
         OR CAST(o.awb_numbers AS VARCHAR) ILIKE ?
         OR CAST(o.order_no AS VARCHAR) IN (
            SELECT CAST(order_no AS VARCHAR) 
            FROM order_awb_mapping 
            WHERE CAST(awb_number AS VARCHAR) ILIKE ?
         )
      LIMIT 10
    `;

    const rows = await fetchQuery<any>(sqlQuery, [orderSearchValue, awbSearchValue, awbSearchValue]);

    const data = rows.map((row: any) => {
      const sales = Number(row.sales ?? 0);
      const refunds = Number(row.refunds ?? 0);
      const netSales = Number(row.net_sales ?? (sales - refunds));
      const fedexCost = Number(row.fedex_cost ?? 0);
      const materialCost = Number(row.material_cost ?? 0);
      const etsyExpenses = Number(row.etsy_expenses ?? 0);
      const totalExpense = Number(row.total_expense ?? (fedexCost + materialCost + etsyExpenses));
      const profit = Number(row.netProfit ?? (netSales - totalExpense));
      const margin = row.margin !== null && row.margin !== undefined && !isNaN(Number(row.margin))
        ? Number(Number(row.margin).toFixed(1))
        : null;

      let refundStatus: 'Refunded' | 'Partially Refunded' | null = row.refund_status || null;
      if (!refundStatus) {
        if (refunds >= sales && sales > 0) refundStatus = 'Refunded';
        else if (refunds > 0) refundStatus = 'Partially Refunded';
      }

      return {
        orderNo: String(row.order_no ?? ''),
        saleDate: String(row.sale_date ?? ''),
        productTitle: String(row.product_title || 'Etsy Order Item'),
        country: String(row.country || 'N/A'),
        sales,
        refundAmount: refunds,
        netSales,
        materialCost,
        dutyCost: fedexCost,
        fedexCost,
        listingExpense: Number(row.listing_expense ?? 0),
        etsyExpenses,
        totalExpense,
        awbNumbers: String(row.awb_numbers ?? 'N/A'),
        estimatedProfitBeforeShipping: profit,
        netProfit: profit,
        margin,
        refundStatus,
        status: profit > 0 ? 'Profitable' : profit < 0 ? 'Loss' : 'Neutral',
        expenseBreakdown: {
          materialCost,
          fedexDutyTransportation: fedexCost,
          listingExpense: Number(row.listing_expense ?? 0),
          etsyAds: Number(row.etsy_ads_expense ?? 0),
          offsiteAds: Number(row.offsite_ads ?? 0),
          buyerFee: Number(row.buyer_fee ?? 0),
          tds: Number(row.tds ?? 0),
          tcs: Number(row.tcs ?? 0),
          transactionFee: Number(row.transaction_fee ?? 0),
          processingFee: Number(row.processing_fee ?? 0),
          salesTax: Number(row.sales_tax ?? 0),
          regulatoryFee: Number(row.regulatory_fee ?? 0),
          etsyExpenses,
          totalExpense,
        },
      };
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('SEARCH API ERROR:', error);
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
}