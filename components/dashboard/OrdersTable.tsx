'use client';
import { useState, useEffect } from 'react';
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
  onClose: () => void;
}

function ExpenseTooltip({ orderNo, onClose }: ExpenseTooltipProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNo) return;
    setLoading(true);
    fetch(`/api/dashboard/orders/${orderNo}/transactions`)
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData(res);
        } else {
          setError(res.message || 'Failed to load data');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderNo]);

  const fmt = (n: number | undefined | null) => {
    if (n === undefined || n === null) return 'N/A';
    return `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-[var(--color-brand-card)] w-full max-w-[800px] rounded-2xl shadow-2xl border border-[var(--color-brand-border)] overflow-hidden my-auto transform transition-all animate-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--color-brand-border)] flex justify-between items-center bg-[var(--color-brand-background)]/50">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[var(--color-brand-primary)]">Order Financial Details</h3>
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
        <div className="p-6 sm:p-7 space-y-8 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-10 text-[var(--color-brand-muted)]">Loading order details...</div>
          ) : error ? (
            <div className="flex justify-center items-center py-10 text-red-500 font-semibold">{error}</div>
          ) : data && data.summary ? (
            <>
              {/* Order Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--color-brand-background)]/30 p-3 rounded-lg border border-[var(--color-brand-border)]/50">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Gross Sales</div>
                  <div className="text-sm font-bold text-[var(--color-brand-primary)]">{fmt(data.summary.grossSales)}</div>
                </div>
                <div className="bg-[var(--color-brand-background)]/30 p-3 rounded-lg border border-[var(--color-brand-border)]/50">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Refund Value</div>
                  <div className="text-sm font-bold text-red-500">{fmt(data.summary.refundValue)}</div>
                </div>
                <div className="bg-[var(--color-brand-background)]/30 p-3 rounded-lg border border-[var(--color-brand-border)]/50">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Adjusted Sales</div>
                  <div className="text-sm font-bold text-[#184B4D]">{fmt(data.summary.adjustedSales)}</div>
                </div>
                <div className="bg-[var(--color-brand-background)]/30 p-3 rounded-lg border border-[var(--color-brand-border)]/50">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Total Expense</div>
                  <div className="text-sm font-bold text-red-600">{fmt(data.summary.totalExpense)}</div>
                </div>
                <div className="bg-[var(--color-brand-background)]/30 p-3 rounded-lg border border-[var(--color-brand-border)]/50 col-span-2 md:col-span-2 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Net Profit</div>
                    <div className={`text-lg font-bold ${data.summary.netProfit >= 0 ? 'text-[#184B4D]' : 'text-red-600'}`}>{fmt(data.summary.netProfit)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Margin</div>
                    <div className={`text-lg font-bold ${data.summary.profitMargin >= 0 ? 'text-[#184B4D]' : 'text-red-600'}`}>{data.summary.profitMargin.toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Primary Categories */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold tracking-wider text-[var(--color-brand-muted)] uppercase border-b border-[var(--color-brand-border)]/60 pb-1.5">
                  Primary Expense Categories
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Material Cost</span>
                    <span className="text-sm font-bold text-[var(--color-brand-primary)] font-mono">{fmt(data.summary.materialCost)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">FedEx Duty / Transportation</span>
                    <span className="text-sm font-bold text-[var(--color-brand-primary)] font-mono">{fmt(data.summary.fedexCost)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Etsy Listing Expense</span>
                    <span className="text-sm font-bold text-[var(--color-brand-primary)] font-mono">{fmt(data.summary.breakdown?.listingExpense)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Etsy Ads</span>
                    <span className="text-sm font-bold text-[var(--color-brand-primary)] font-mono">{fmt(data.summary.breakdown?.etsyAds)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Offsite Ads</span>
                    <span className="text-sm font-bold text-[var(--color-brand-primary)] font-mono">{fmt(data.summary.breakdown?.offsiteAds)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Buyer Fee</span>
                    <span className="text-sm font-bold text-[var(--color-brand-primary)] font-mono">{fmt(data.summary.breakdown?.buyerFee)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Total Etsy Expenses</span>
                    <span className="text-sm font-bold text-[var(--color-brand-primary)] font-mono">{fmt(data.summary.etsyExpenses)}</span>
                  </div>
                </div>
              </div>

              {/* Transactions Detail */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold tracking-wider text-[var(--color-brand-muted)] uppercase border-b border-[var(--color-brand-border)]/60 pb-1.5 flex justify-between items-center">
                  <span>Etsy Expense Transactions Detail</span>
                </div>
                {data.transactions && data.transactions.length > 0 ? (
                  <div className="overflow-x-auto border border-[var(--color-brand-border)]/50 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--color-brand-background)]">
                        <tr className="border-b border-[var(--color-brand-border)]/50">
                          <th className="px-3 py-2 text-left font-semibold text-[var(--color-brand-muted)]">Date</th>
                          <th className="px-3 py-2 text-left font-semibold text-[var(--color-brand-muted)]">Type</th>
                          <th className="px-3 py-2 text-left font-semibold text-[var(--color-brand-muted)]">Description</th>
                          <th className="px-3 py-2 text-right font-semibold text-[var(--color-brand-muted)]">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-brand-border)]/30">
                        {data.transactions.map((tx: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[var(--color-brand-background)]/30">
                            <td className="px-3 py-2 text-[var(--color-brand-muted)]">{formatDate(tx.date)}</td>
                            <td className="px-3 py-2 font-medium">
                              {tx.expense_type}
                              {tx.is_allocation && <span className="ml-1 text-[8px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">ALLOC</span>}
                            </td>
                            <td className="px-3 py-2 text-[var(--color-brand-muted)] truncate max-w-[200px]" title={tx.title}>{tx.title || '-'}</td>
                            <td className="px-3 py-2 text-right font-mono font-medium text-red-600">{fmt(tx.net_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-center py-4 text-[var(--color-brand-muted)] border border-[var(--color-brand-border)]/50 rounded-lg">
                    No individual Etsy transactions found.
                  </div>
                )}
              </div>
            </>
          ) : null}
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
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-[var(--color-brand-primary)]">{order.orderNo}</div>
                      {(order.refundStatus === 'Refunded' || (order.refundAmount !== undefined && order.refundAmount >= order.sales && order.sales > 0)) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                          Refunded
                        </span>
                      )}
                      {(order.refundStatus === 'Partially Refunded' || (order.refundAmount !== undefined && order.refundAmount > 0 && (order.sales === 0 || order.refundAmount < order.sales))) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                          Partially Refunded
                        </span>
                      )}
                    </div>
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
          onClose={() => setActiveOrder(null)} 
        />
      )}
    </div>
  );
}
