import { NextResponse } from 'next/server';
import { fetchQuery, getConnection } from '@/database'; 
import { getAllMaterialCostFactors } from '@/config/appConfig';

function buildMaterialCostExpr(): string {
  const factors = getAllMaterialCostFactors();
  const otherRate = factors['OTHER'] ?? 100;
  const cases = Object.entries(factors)
    .filter(([key]) => key !== 'OTHER')
    .map(([key, rate]) => `WHEN UPPER(i.material_type) = '${key}' THEN i.quantity * ${rate}`)
    .join(' ');
  return `CASE ${cases} ELSE i.quantity * ${otherRate} END`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ data: [] });
    }

    let orderNoQuery = query;
    let awbQuery = query;

    if (query.startsWith('#')) {
      orderNoQuery = query.substring(1);
      awbQuery = 'NOT_MATCHING_ANYTHING_UNLESS_ORDER';
    } else if (query.toUpperCase().startsWith('AWB-')) {
      awbQuery = query.substring(4);
      orderNoQuery = 'NOT_MATCHING_ANYTHING_UNLESS_AWB';
    }

    const orderSearchValue = `%${orderNoQuery.trim()}%`;
    const awbSearchValue = `%${awbQuery.trim()}%`;
    const costExpr = buildMaterialCostExpr();

    const sqlQuery = `
      SELECT
        CAST(o.order_no AS VARCHAR) AS order_no,
        CAST(o.sale_date AS VARCHAR) AS sale_date,
        o.sales,
        o.material_cost,
        o.fedex_cost AS duty_cost,
        o.awb_numbers,
        o.etsy_listing_expense AS listing_expense,
        o.tds,
        o.tcs,
        o.transaction_fee,
        o.processing_fee,
        o.sales_tax,
        o.regulatory_fee,
        o.etsy_expenses AS etsy_expenses,
        o.total_expense,
        o.profit AS estimatedProfitBeforeShipping,
        o.profit AS netProfit,
        o.margin
      FROM v_order_financials o
      WHERE CAST(o.order_no AS VARCHAR) ILIKE ? 
         OR CAST(o.order_no AS VARCHAR) IN (
            SELECT CAST(order_no AS VARCHAR) 
            FROM order_awb_mapping 
            WHERE CAST(awb_number AS VARCHAR) ILIKE ?
         )
      LIMIT 6
    `;

    const rows = await fetchQuery<any>(sqlQuery, [orderSearchValue, awbSearchValue]);

    const data = rows.map((row: any) => {
      const sales = Number(row.sales ?? 0);
      const profit = Number(row.netProfit ?? 0);

      return {
        orderNo: String(row.order_no ?? ''),
        saleDate: String(row.sale_date ?? ''),
        sales,
        materialCost: Number(row.material_cost ?? 0),
        dutyCost: Number(row.duty_cost ?? 0),
        listingExpense: Number(row.listing_expense ?? 0),
        etsyExpenses: Number(row.etsy_expenses ?? 0),
        totalExpense: Number(row.total_expense ?? 0),
        awbNumbers: String(row.awb_numbers ?? 'N/A'),
        estimatedProfitBeforeShipping: profit,
        netProfit: profit,
        margin: Number(row.margin ?? 0),
        status: profit > 0 ? 'Profitable' : profit < 0 ? 'Loss' : 'Neutral',
        expenseBreakdown: {
          materialCost: Number(row.material_cost ?? 0),
          fedexDutyTransportation: Number(row.duty_cost ?? 0),
          listingExpense: Number(row.listing_expense ?? 0),
          tds: Number(row.tds ?? 0),
          tcs: Number(row.tcs ?? 0),
          transactionFee: Number(row.transaction_fee ?? 0),
          processingFee: Number(row.processing_fee ?? 0),
          salesTax: Number(row.sales_tax ?? 0),
          regulatoryFee: Number(row.regulatory_fee ?? 0),
          etsyExpenses: Number(row.etsy_expenses ?? 0),
          totalExpense: Number(row.total_expense ?? 0),
        },
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('SEARCH API ERROR:', error);
    return NextResponse.json({ success: false, error: (error as any)?.message || String(error) }, { status: 500 });
  }
}