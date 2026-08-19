import { fetchQuery } from './database/index';

async function audit() {
  console.log('\n--- H. REFUND DETAILS (Missing Order No Check) ---');
  const h = await fetchQuery(`
    SELECT order_no, COUNT(*) as rows, SUM(net_amount) as amount 
    FROM etsy_expenses 
    WHERE expense_type = 'REFUND' 
    GROUP BY order_no;
  `);
  console.table(h);

  console.log('\n--- I. MISSING ORDERS IN SALES ---');
  const i = await fetchQuery(`
    SELECT DISTINCT e.order_no, e.expense_type, e.net_amount
    FROM etsy_expenses e
    LEFT JOIN etsy_sales s ON e.order_no = s.order_no
    WHERE e.expense_type = 'REFUND' AND s.order_no IS NULL;
  `);
  console.table(i);

  console.log('\n--- J. ETSY EXPENSES VS v_order_financials ---');
  const j = await fetchQuery(`
    SELECT SUM(total_expense) as sum_total_expense, SUM(order_etsy_expenses) as sum_order_etsy, SUM(etsy_ads_expense) as sum_ads, SUM(etsy_listing_expense) as sum_listing
    FROM v_order_financials;
  `);
  console.table(j);

  process.exit(0);
}

audit().catch(console.error);
