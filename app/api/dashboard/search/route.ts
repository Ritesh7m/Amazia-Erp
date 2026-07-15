import { NextResponse } from 'next/server';
import { fetchQuery } from '@/database'; 
// import { MATERIAL_COST_RATE } from '@/lib/dashboard/dashboardQueries'; 

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const searchValue = `%${query.trim()}%`;
    const materialRate = 250; 

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
      )
      SELECT
        CAST(e.order_no AS VARCHAR) AS order_no,
        CAST(e.date AS VARCHAR) AS sale_date,
        COALESCE(TRY_CAST(REPLACE(CAST(e.net_amt AS VARCHAR), ',', '') AS DOUBLE), 0) AS sales,
        COALESCE(SUM(COALESCE(TRY_CAST(i.quantity AS DOUBLE), 0) * ?), 0) AS material_cost,
        COALESCE(af.allocated_duty_cost, 0) AS duty_cost,
        COALESCE(MAX(af.awb_numbers), 'N/A') AS awb_numbers
      FROM etsy_statement e
      LEFT JOIN inventory_table i ON CAST(i.order_no AS VARCHAR) LIKE CAST(e.order_no AS VARCHAR) || '%'
      LEFT JOIN allocated_fedex af ON CAST(e.order_no AS VARCHAR) = CAST(af.order_no AS VARCHAR)
      WHERE CAST(e.order_no AS VARCHAR) ILIKE ? 
         OR CAST(e.order_no AS VARCHAR) IN (
            SELECT CAST(order_no AS VARCHAR) 
            FROM order_awb_mapping 
            WHERE awb_number ILIKE ?
         )
      GROUP BY e.order_no, e.date, e.net_amt, af.allocated_duty_cost
      LIMIT 6
    `;

    const rows = await fetchQuery<any>(sqlQuery, [materialRate, searchValue, searchValue]);

    const data = rows.map((row) => {
      const sales = Number(row.sales ?? 0);
      const materialCost = Number(row.material_cost ?? 0);
      const dutyCost = Number(row.duty_cost ?? 0);
      const profit = sales - (materialCost + dutyCost);

      return {
        orderNo: String(row.order_no ?? ''),
        saleDate: String(row.sale_date ?? ''),
        sales,
        materialCost,
        dutyCost,
        awbNumbers: String(row.awb_numbers ?? 'N/A'),
        netProfit: profit,
        status: profit > 0 ? 'Profitable' : profit < 0 ? 'Loss' : 'Neutral',
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('SEARCH API ERROR:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}