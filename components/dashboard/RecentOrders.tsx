'use client';
import Link from 'next/link';
import { OrderData } from '@/lib/dashboard/dashboardTypes';

export default function RecentOrders({ data, isLoading }: { data: OrderData[], isLoading: boolean }) {
  const formatCurrency = (val: number) => `₹${new Intl.NumberFormat('en-IN').format(val)}`;
  
  return (
    <div className="bg-[var(--color-brand-card)] p-6 rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-[var(--color-brand-primary)]">Recent Orders</h3>
        <Link href="/dashboard/orders" className="text-sm px-3 py-1.5 border border-[var(--color-brand-border)] rounded-lg hover:bg-[var(--color-brand-background)] transition-colors text-[var(--color-brand-muted)] font-medium">
          View All
        </Link>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-brand-border)] text-xs text-[var(--color-brand-muted)] uppercase tracking-wider">
              <th className="pb-3 font-medium">Order No.</th>
              <th className="pb-3 font-medium">Sale Date</th>
              <th className="pb-3 font-medium text-right">Sales (₹)</th>
              <th className="pb-3 font-medium text-right">Material Cost (₹)</th>
              <th className="pb-3 font-medium text-right">Est. Profit (₹)</th>
              <th className="pb-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {isLoading ? (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--color-brand-muted)]">Loading orders...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-[var(--color-brand-muted)]">No orders in this period.</td></tr>
            ) : (
              data.map((order) => (
                <tr key={order.orderNo} className="border-b border-gray-100 last:border-0 hover:bg-[var(--color-brand-background)] transition-colors">
                  <td className="py-3 font-medium text-[var(--color-brand-primary)]">{order.orderNo}</td>
                  <td className="py-3 text-[var(--color-brand-muted)]">{order.saleDate}</td>
                  <td className="py-3 text-right">{formatCurrency(order.sales)}</td>
                  <td className="py-3 text-right text-[var(--color-brand-muted)]">{formatCurrency(order.materialCost)}</td>
                  <td className="py-3 text-right font-medium">{formatCurrency(order.estimatedProfitBeforeShipping)}</td>
                  <td className="py-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${order.status === 'Profitable' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {order.status}
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