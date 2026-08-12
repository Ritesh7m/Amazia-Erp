'use client';
import { useState } from 'react';
import { OrderData } from '@/lib/dashboard/dashboardTypes';

interface OrdersTableProps {
  data: OrderData[];
  totalRecords: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

interface ExpenseTooltipProps {
  orderNo?: string;
  breakdown: OrderData['expenseBreakdown'];
  onClose: () => void;
}

function ExpenseTooltip({ orderNo, breakdown, onClose }: ExpenseTooltipProps) {
  const primaryItems = [
    { label: 'Material Cost', value: breakdown.materialCost, color: '#184B4D' },
    { label: 'FedEx Duty/Transportation', value: breakdown.fedexDutyTransportation, color: '#E4D4BA' },
    { label: 'Etsy Listing Expense', value: breakdown.listingExpense, color: '#4B8B84' },
  ];

  const secondaryItems = [
    { label: 'TDS', value: breakdown.tds },
    { label: 'TCS', value: breakdown.tcs },
    { label: 'Transaction Fee', value: breakdown.transactionFee },
    { label: 'Processing Fee', value: breakdown.processingFee },
    { label: 'Sales Tax', value: breakdown.salesTax },
    { label: 'Regulatory Fee', value: breakdown.regulatoryFee },
    { label: 'Other Etsy Expense', value: breakdown.otherEtsyExpense },
  ];

  const fmt = (n: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-[var(--color-brand-card)] w-full max-w-[560px] rounded-2xl shadow-2xl border border-[var(--color-brand-border)] overflow-hidden my-auto transform transition-all animate-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--color-brand-border)] flex justify-between items-center bg-[var(--color-brand-background)]/50">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[var(--color-brand-primary)]">Expense Breakdown</h3>
            {orderNo && (
              <span className="text-xs font-semibold text-[var(--color-brand-muted)] bg-[var(--color-brand-card)] px-2.5 py-1 rounded-md border border-[var(--color-brand-border)] shadow-xs">
                Order #{orderNo}
              </span>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)] transition-colors p-1.5 rounded-lg hover:bg-gray-200/60 flex items-center justify-center"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Primary Categories */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold tracking-wider text-[var(--color-brand-muted)] uppercase border-b border-[var(--color-brand-border)]/60 pb-1.5">
              Primary Categories
            </div>
            <div className="space-y-2">
              {primaryItems.map(item => (
                <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-[var(--color-brand-border)]/30 last:border-none">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-semibold text-[var(--color-brand-primary)]">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold text-[var(--color-brand-primary)] font-mono text-right">
                    {fmt(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Secondary Categories (Other Etsy Expenses) */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold tracking-wider text-[var(--color-brand-muted)] uppercase border-b border-[var(--color-brand-border)]/60 pb-1.5">
              Other Etsy Expenses
            </div>
            <div className="space-y-1.5">
              {secondaryItems.map(item => (
                <div key={item.label} className="flex justify-between items-center py-1 border-b border-[var(--color-brand-border)]/20 last:border-none">
                  <span className="text-xs text-[var(--color-brand-muted)]">{item.label}</span>
                  <span className={`text-xs font-medium font-mono text-right ${item.value > 0 ? 'text-[var(--color-brand-primary)]' : 'text-[var(--color-brand-muted)]/70'}`}>
                    {fmt(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total Expense Footer */}
          <div className="border-t-2 border-[var(--color-brand-border)] pt-4 flex justify-between items-center">
            <span className="text-base font-bold text-[var(--color-brand-primary)]">Total Expense</span>
            <span className="text-lg font-extrabold text-red-600 font-mono tracking-tight">{fmt(breakdown.totalExpense)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrdersTable({ data, totalRecords, page, pageSize, totalPages, isLoading, onPageChange }: OrdersTableProps) {
  const [activeOrder, setActiveOrder] = useState<{ orderNo: string; breakdown: OrderData['expenseBreakdown'] } | null>(null);

  const fmt = (n: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

  if (isLoading) {
    return (
      <div className="bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm p-6">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-6 animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-brand-border)] flex justify-between items-center">
        <h3 className="font-semibold text-[var(--color-brand-primary)]">Orders</h3>
        <span className="text-xs text-[var(--color-brand-muted)]">{totalRecords} total orders</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-brand-background)]/50 text-[var(--color-brand-muted)]">
              <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider">Order Number</th>
              <th className="text-right px-6 py-3 font-semibold text-xs uppercase tracking-wider">Sales</th>
              <th className="text-right px-6 py-3 font-semibold text-xs uppercase tracking-wider">Expense</th>
              <th className="text-right px-6 py-3 font-semibold text-xs uppercase tracking-wider">Profit</th>
              <th className="text-right px-6 py-3 font-semibold text-xs uppercase tracking-wider">Margin</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[var(--color-brand-muted)] text-sm">
                  No orders found for this period.
                </td>
              </tr>
            ) : (
              data.map((order) => (
                <tr key={order.orderNo} className="border-b border-[var(--color-brand-border)] last:border-none hover:bg-[var(--color-brand-background)]/30 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-medium text-[var(--color-brand-primary)]">{order.orderNo}</div>
                    <div className="text-xs text-[var(--color-brand-muted)] mt-0.5">{order.saleDate}</div>
                  </td>
                  <td className="px-6 py-3.5 text-right font-medium text-[var(--color-brand-primary)]">
                    {fmt(order.sales)}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-medium text-red-500">{fmt(order.totalExpense)}</span>
                      <button
                        onClick={() => setActiveOrder({ orderNo: order.orderNo, breakdown: order.expenseBreakdown })}
                        className="p-0.5 rounded-full hover:bg-[var(--color-brand-background)] transition-colors group"
                        title="View expense breakdown"
                      >
                        <svg className="w-3.5 h-3.5 text-[var(--color-brand-muted)] group-hover:text-[var(--color-brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className={`px-6 py-3.5 text-right font-bold ${order.estimatedProfitBeforeShipping >= 0 ? 'text-[#184B4D]' : 'text-red-600'}`}>
                    {fmt(order.estimatedProfitBeforeShipping)}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      order.margin > 0 
                        ? 'bg-[#4B8B84]/10 text-[#4B8B84]' 
                        : order.margin < 0 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {order.margin}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-[var(--color-brand-border)] flex items-center justify-between">
          <span className="text-xs text-[var(--color-brand-muted)]">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-background)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-background)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Expense Breakdown Modal */}
      {activeOrder && (
        <ExpenseTooltip 
          orderNo={activeOrder.orderNo} 
          breakdown={activeOrder.breakdown} 
          onClose={() => setActiveOrder(null)} 
        />
      )}
    </div>
  );
}
