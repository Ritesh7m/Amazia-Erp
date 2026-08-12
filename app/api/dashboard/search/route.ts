import { NextResponse } from 'next/server';
import { fetchQuery } from '@/database'; 
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

    const searchValue = `%${query.trim()}%`;
    const costExpr = buildMaterialCostExpr();

    const sqlQuery = `
      WITH awb_order_counts AS (
        SELECT awb_number, COUNT(DISTINCT order_no) as total_orders_in_awb
        FROM order_awb_mapping
        GROUP BY awb_number
      ),
      allocated_fedex AS (
        SELECT 
          m.order_no,
          STRING_AGG(DISTINCT m.awb_number, ' | ') as awb_numbers,
          SUM(f.air_waybill_total_amount / c.total_orders_in_awb) as allocated_duty_cost
        FROM order_awb_mapping m
        JOIN fedex_billing f ON m.awb_number = f.awb_number
        JOIN awb_order_counts c ON m.awb_number = c.awb_number
        GROUP BY m.order_no
      ),
      order_etsy_expenses AS (
        SELECT order_no, COALESCE(SUM(expense_amount), 0) AS total_etsy_expense
        FROM etsy_expenses
        GROUP BY order_no
      )
      SELECT
        CAST(e.order_no AS VARCHAR) AS order_no,
        CAST(e.date AS VARCHAR) AS sale_date,
        COALESCE(TRY_CAST(REPLACE(CAST(e.net_amt AS VARCHAR), ',', '') AS DOUBLE), 0) AS sales,
        COALESCE(SUM(${costExpr}), 0) AS material_cost,
        COALESCE(af.allocated_duty_cost, 0) AS duty_cost,
        COALESCE(MAX(af.awb_numbers), 'N/A') AS awb_numbers,
        COALESCE(oex.total_etsy_expense, 0) AS total_etsy_expense
      FROM etsy_statement e
      LEFT JOIN inventory_table i ON CAST(i.order_no AS VARCHAR) LIKE CAST(e.order_no AS VARCHAR) || '%'
      LEFT JOIN allocated_fedex af ON CAST(e.order_no AS VARCHAR) = CAST(af.order_no AS VARCHAR)
      LEFT JOIN order_etsy_expenses oex ON CAST(e.order_no AS VARCHAR) = CAST(oex.order_no AS VARCHAR)
      WHERE CAST(e.order_no AS VARCHAR) ILIKE ? 
         OR CAST(e.order_no AS VARCHAR) IN (
            SELECT CAST(order_no AS VARCHAR) 
            FROM order_awb_mapping 
            WHERE awb_number ILIKE ?
         )
      GROUP BY e.order_no, e.date, e.net_amt, af.allocated_duty_cost, oex.total_etsy_expense
      LIMIT 6
    `;

    const rows = await fetchQuery<any>(sqlQuery, [searchValue, searchValue]);

    const data = rows.map((row: any) => {
      const sales = Number(row.sales ?? 0);
      const materialCost = Number(row.material_cost ?? 0);
      const dutyCost = Number(row.duty_cost ?? 0);
      const totalEtsyExpense = Number(row.total_etsy_expense ?? 0);
      const totalExpense = materialCost + dutyCost + totalEtsyExpense;
      const profit = sales - totalExpense;

      return {
        orderNo: String(row.order_no ?? ''),
        saleDate: String(row.sale_date ?? ''),
        sales,
        materialCost,
        dutyCost,
        totalEtsyExpense,
        totalExpense,
        awbNumbers: String(row.awb_numbers ?? 'N/A'),
        netProfit: profit,
        margin: sales > 0 ? Number(((profit / sales) * 100).toFixed(1)) : 0,
        status: profit > 0 ? 'Profitable' : profit < 0 ? 'Loss' : 'Neutral',
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('SEARCH API ERROR:', error);
    return NextResponse.json({ success: false, error: 'Failed to search' }, { status: 500 });
  }
}