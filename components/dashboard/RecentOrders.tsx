'use client';
import Link from 'next/link';

interface OrderData {
  orderNo: string;
  saleDate: string;
  sales: number;
  materialCost: number;
  estimatedProfitBeforeShipping: number;
  status: string;
}

interface RecentOrdersProps {
  data: OrderData[];
  isLoading: boolean;
}

export default function RecentOrders({ data, isLoading }: RecentOrdersProps) {
  // Format numbers nicely as Indian Rupees
  const formatCurrency = (val: number) => `₹${new Intl.NumberFormat('en-IN').format(val || 0)}`;

  return (
    <div className="bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-brand-border)]">
        <h3 className="text-[16px] font-bold text-[var(--color-brand-primary)]">Recent Orders</h3>
        <Link href="/dashboard/orders">
          <button className="text-sm font-medium text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)] transition-colors px-4 py-1.5 rounded-lg border border-[var(--color-brand-border)] hover:bg-[var(--color-brand-background)] shadow-sm">
            View All
          </button>
        </Link>
      </div>
      
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-brand-border)] text-[11px] font-bold text-[var(--color-brand-muted)] uppercase tracking-wider bg-[var(--color-brand-background)]/50">
              <th className="px-6 py-4">Order No.</th>
              <th className="px-6 py-4">Sale Date</th>
              <th className="px-6 py-4 text-right">Sales (₹)</th>
              <th className="px-6 py-4 text-right">Material Cost (₹)</th>
              <th className="px-6 py-4 text-right">Est. Profit (₹)</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[var(--color-brand-muted)] font-medium">
                  Loading recent orders...
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[var(--color-brand-muted)] font-medium">
                  No orders found in this period.
                </td>
              </tr>
            ) : (
              data.map((order, index) => (
                <tr key={order.orderNo || index} className="border-b border-[var(--color-brand-border)]/50 last:border-0 hover:bg-[var(--color-brand-background)] transition-colors">
                  <td className="px-6 py-4 font-bold text-[var(--color-brand-primary)]">
                    {order.orderNo}
                  </td>
                  <td className="px-6 py-4 text-[var(--color-brand-muted)] font-medium">
                    {order.saleDate}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-[var(--color-brand-primary)]">
                    {formatCurrency(order.sales)}
                  </td>
                  <td className="px-6 py-4 text-right text-[var(--color-brand-muted)]">
                    {formatCurrency(order.materialCost)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-[var(--color-brand-primary)]">
                    {formatCurrency(order.estimatedProfitBeforeShipping)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${
                      order.status === 'Profitable' 
                        ? 'bg-[var(--color-brand-success)] text-[#0F4D4D] border border-green-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {order.status || 'Neutral'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}