'use client';
import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';

interface OrderDetailsModalProps {
  orderNo: string | null;
  onClose: () => void;
}

export default function OrderDetailsModal({ orderNo, onClose }: OrderDetailsModalProps) {
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
    <Modal isOpen={!!orderNo} onClose={onClose}>
      {/* Modal Header */}
      <div className="px-6 py-4 border-b border-[var(--color-brand-border)] flex justify-between items-center bg-[var(--color-brand-background)]/50 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-[var(--color-brand-primary)]">Order Details</h3>
          {orderNo && (
            <span className="text-xs font-semibold text-[var(--color-brand-muted)] bg-[var(--color-brand-card)] px-2.5 py-1 rounded-md border border-[var(--color-brand-border)] shadow-xs">
              Order #{orderNo}
            </span>
          )}
        </div>
        <button 
          onClick={onClose} 
          className="text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-brand-background)] flex items-center justify-center"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-6 sm:p-7 space-y-8 overflow-y-auto flex-1">
        {loading ? (
          <div className="flex justify-center items-center py-10 text-[var(--color-brand-muted)]">Loading order details...</div>
        ) : error ? (
          <div className="flex justify-center items-center py-10 text-red-500 font-semibold">{error}</div>
        ) : data && data.summary ? (
          <>
            {/* Quick Details (from DashboardFilters) & Summary */}
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
                <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Sale Date</div>
                <div className="text-sm font-bold text-[#184B4D]">{data.summary.saleDate ? formatDate(data.summary.saleDate) : 'N/A'}</div>
              </div>
              <div className="bg-[var(--color-brand-background)]/30 p-3 rounded-lg border border-[var(--color-brand-border)]/50">
                <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Connected AWB(s)</div>
                {data.summary.awbNumbers && data.summary.awbNumbers !== 'N/A' ? (
                  <div className="flex flex-col gap-1 mt-1">
                    {data.summary.awbNumbers.split(',').map((awb: string) => awb.trim()).filter(Boolean).map((awb: string) => (
                      <span key={awb} className="font-mono text-[11px] font-medium bg-[var(--color-brand-background)] px-2 py-0.5 rounded border border-[var(--color-brand-border)]/80 text-[var(--color-brand-primary)] w-max">
                        {awb}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="font-mono text-sm inline-block text-[var(--color-brand-primary)] mt-1">N/A</div>
                )}
              </div>
              <div className="bg-[var(--color-brand-background)]/30 p-3 rounded-lg border border-[var(--color-brand-border)]/50 col-span-2 md:col-span-2 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Direct NPF (Net Profit)</div>
                  <div className={`text-lg font-bold ${data.summary.netProfit >= 0 ? 'text-[#184B4D]' : 'text-red-600'}`}>{fmt(data.summary.netProfit)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-semibold mb-1">Margin</div>
                  <div className={`text-lg font-bold ${data.summary.profitMargin >= 0 ? 'text-[#184B4D]' : 'text-red-600'}`}>{data.summary.profitMargin != null ? `${data.summary.profitMargin.toFixed(3)}%` : 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Primary Categories */}
            <div className="space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-[var(--color-brand-muted)] uppercase border-b border-[var(--color-brand-border)]/60 pb-1.5">
                Expense Breakdown
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                {data.summary.materialCost !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Material Cost</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.materialCost)}</span>
                  </div>
                )}
                {data.summary.fedexCost !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">FedEx Duty / Transportation</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.fedexCost)}</span>
                  </div>
                )}
                {data.summary.breakdown?.listingExpense !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Etsy Listing Expense (Allocated)</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.listingExpense)}</span>
                  </div>
                )}
                {data.summary.breakdown?.etsyAds !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Etsy Ads</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.etsyAds)}</span>
                  </div>
                )}
                {data.summary.breakdown?.offsiteAds !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Offsite Ads</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.offsiteAds)}</span>
                  </div>
                )}
                {data.summary.breakdown?.buyerFee !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Buyer Fee</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.buyerFee)}</span>
                  </div>
                )}
                {data.summary.breakdown?.transactionFee !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Transaction Fee</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.transactionFee)}</span>
                  </div>
                )}
                {data.summary.breakdown?.processingFee !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Processing Fee</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.processingFee)}</span>
                  </div>
                )}
                {data.summary.breakdown?.salesTax !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Sales Tax</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.salesTax)}</span>
                  </div>
                )}
                {data.summary.breakdown?.regulatoryFee !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">Regulatory Fee</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.regulatoryFee)}</span>
                  </div>
                )}
                {data.summary.breakdown?.tds !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">TDS</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.tds)}</span>
                  </div>
                )}
                {data.summary.breakdown?.tcs !== 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">TCS</span>
                    <span className="text-sm font-bold text-red-500 font-mono">-{fmt(data.summary.breakdown?.tcs)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center py-1 pt-3 border-t border-[var(--color-brand-border)] sm:col-span-2">
                  <span className="text-sm font-bold text-[var(--color-brand-primary)]">Total Expense</span>
                  <span className="text-sm font-bold text-red-600 font-mono">-{fmt(data.summary.totalExpense)}</span>
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
    </Modal>
  );
}
