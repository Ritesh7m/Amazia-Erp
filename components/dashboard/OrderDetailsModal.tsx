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
    setError(null);
    fetch(`/api/dashboard/orders/${encodeURIComponent(orderNo)}/transactions`)
      .then(async (res) => {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          if (res.ok && json.success) {
            setData(json);
          } else {
            setError(json.message || `Unable to load order details (HTTP ${res.status})`);
          }
        } catch {
          setError(`Server returned status ${res.status} (${res.statusText || 'Error'}).`);
        }
      })
      .catch((err) => setError(err.message || 'Network error fetching order details.'))
      .finally(() => setLoading(false));
  }, [orderNo]);

  const fmt = (n: number | undefined | null) => {
    if (n === undefined || n === null || isNaN(n)) return '₹0.00';
    return `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const m = months[d.getMonth()];
      const day = d.getDate();
      const yr = d.getFullYear();
      return `${m} ${day} ${yr}`;
    } catch {
      return dateStr;
    }
  };

  const summary = data?.summary;
  const breakdown = summary?.breakdown || {};
  const fedexDetails = data?.fedexDetails || [];
  const transactions = data?.transactions || [];

  const hasRefund = summary && summary.refundValue > 0;
  const isFullyRefunded = summary && (summary.refundStatus === 'Refunded' || (summary.refundValue >= summary.grossSales && summary.grossSales > 0));
  const isPartiallyRefunded = summary && (summary.refundStatus === 'Partially Refunded' || (hasRefund && !isFullyRefunded));

  // Least Proportional Charges (Section 35)
  const etsyAds = Number(breakdown.etsyAds || 0);
  const etsyListingExpense = Number(breakdown.listingExpense || 0);
  const totalProportionalCharges = etsyAds + etsyListingExpense;

  // Order Level Expenses (Section 36 - Etsy Ads and Listing Fees MUST NOT appear here)
  const materialCost = Number(breakdown.materialCost || 0);
  const transactionFee = Number(breakdown.transactionFee || 0);
  const processingFee = Number(breakdown.processingFee || 0);
  const regulatoryFee = Number(breakdown.regulatoryFee || 0);
  const tds = Number(breakdown.tds || 0);
  const tcs = Number(breakdown.tcs || 0);
  const offsiteAds = Number(breakdown.offsiteAds || 0);
  const fedexCost = Number(summary?.fedexCost || breakdown.fedexDutyTransportation || 0);
  const otherOrderLevelFees = Number(breakdown.buyerFee || 0) + Number(breakdown.salesTax || 0);

  const totalOrderLevelExpenses = materialCost + transactionFee + processingFee + regulatoryFee + tds + tcs + offsiteAds + fedexCost + otherOrderLevelFees;
  const totalExpense = totalProportionalCharges + totalOrderLevelExpenses;

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
          className="text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-brand-background)] flex items-center justify-center cursor-pointer"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Modal Body */}
      <div className="p-6 sm:p-7 space-y-7 overflow-y-auto flex-1 max-h-[80vh]">
        {loading ? (
          <div className="flex justify-center items-center py-12 text-[var(--color-brand-muted)] text-sm">
            Loading order details...
          </div>
        ) : error ? (
          <div className="flex justify-center items-center py-12 text-red-500 font-semibold text-sm">
            {error}
          </div>
        ) : summary ? (
          <>
            {/* 1. Header Overview Banner (Section 34, 55) */}
            <div className="bg-[var(--color-brand-background)]/60 p-4 rounded-xl border border-[var(--color-brand-border)] flex flex-col gap-4">
              <div>
                <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-bold">Product / Listing</div>
                <div className="text-sm font-semibold text-[var(--color-brand-primary)] break-words mt-0.5">
                  {summary.productTitle || 'Etsy Order Item'}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 pt-2 border-t border-[var(--color-brand-border)]/40">
                <div>
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-bold">Country</div>
                  <div className="mt-0.5">
                    {summary.country && summary.country !== 'N/A' ? (
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">
                        {summary.country}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-brand-muted)]">N/A</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-bold">Gross Sales</div>
                  <div className="text-xs font-bold text-[var(--color-brand-primary)] mt-0.5">{fmt(summary.grossSales)}</div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-bold">Refund Value</div>
                  <div className="text-xs font-bold text-red-500 mt-0.5">
                    {summary.refundValue > 0 ? `-${fmt(summary.refundValue)}` : fmt(0)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-bold">Sale Date</div>
                  <div className="text-xs font-semibold text-[var(--color-brand-primary)] mt-0.5">
                    {summary.saleDate ? formatDate(summary.saleDate) : 'N/A'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-bold">Connected AWB(s)</div>
                  <div className="text-xs font-mono font-medium text-[var(--color-brand-primary)] mt-0.5 truncate" title={summary.awbNumbers || 'N/A'}>
                    {summary.awbNumbers || 'N/A'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-bold">Direct NPF</div>
                  <div className={`text-xs font-bold font-mono mt-0.5 ${summary.directNpf >= 0 ? 'text-[#184B4D]' : 'text-red-600'}`}>
                    {fmt(summary.directNpf)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase tracking-wider font-bold">Margin</div>
                  <div className={`text-xs font-bold font-mono mt-0.5 ${summary.margin !== null && summary.margin >= 0 ? 'text-[#184B4D]' : 'text-red-600'}`}>
                    {summary.margin !== null && !isNaN(summary.margin) ? `${summary.margin.toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. LEAST PROPORTIONAL CHARGES (Section 35) */}
            <div className="space-y-3 bg-[var(--color-brand-background)]/30 p-4 rounded-xl border border-[var(--color-brand-border)]">
              <div className="flex justify-between items-center border-b border-[var(--color-brand-border)]/60 pb-2">
                <h4 className="text-xs font-bold text-[var(--color-brand-primary)] uppercase tracking-wider">
                  Proportional Charges
                </h4>
                <span className="text-xs font-mono font-bold text-red-500">
                  Total: -{fmt(totalProportionalCharges)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-[var(--color-brand-card)] p-3 rounded-lg border border-[var(--color-brand-border)]/60 flex justify-between items-center">
                  <span className="text-[var(--color-brand-muted)]">Etsy Ads</span>
                  <span className="font-mono font-medium text-red-500">{etsyAds > 0 ? `-${fmt(etsyAds)}` : '₹0.00'}</span>
                </div>
                <div className="bg-[var(--color-brand-card)] p-3 rounded-lg border border-[var(--color-brand-border)]/60 flex justify-between items-center">
                  <span className="text-[var(--color-brand-muted)]">Etsy Listing Expense (Allocated)</span>
                  <span className="font-mono font-medium text-red-500">{etsyListingExpense > 0 ? `-${fmt(etsyListingExpense)}` : '₹0.00'}</span>
                </div>
                <div className="bg-[var(--color-brand-card)] p-3 rounded-lg border border-[var(--color-brand-border)]/60 flex justify-between items-center font-bold">
                  <span className="text-[var(--color-brand-primary)]">Total Proportional Charges</span>
                  <span className="font-mono text-red-600">{totalProportionalCharges > 0 ? `-${fmt(totalProportionalCharges)}` : '₹0.00'}</span>
                </div>
              </div>
            </div>

            {/* 3. ORDER LEVEL EXPENSES (Section 36 - Etsy Ads & Listing Fees MUST NOT appear here) */}
            <div className="space-y-3 bg-[var(--color-brand-background)]/30 p-4 rounded-xl border border-[var(--color-brand-border)]">
              <div className="flex justify-between items-center border-b border-[var(--color-brand-border)]/60 pb-2">
                <h4 className="text-xs font-bold text-[var(--color-brand-primary)] uppercase tracking-wider">
                  Order Level Expenses
                </h4>
                <span className="text-xs font-mono font-bold text-red-500">
                  Total: -{fmt(totalOrderLevelExpenses)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">Material Cost</div>
                  <div className="font-mono font-medium text-red-500 mt-0.5">{materialCost > 0 ? `-${fmt(materialCost)}` : '₹0.00'}</div>
                  {data?.inventory && data.inventory.length > 0 && (
                    <div className="text-[10px] text-[var(--color-brand-muted)] mt-0.5 truncate">
                      {data.inventory.map((i: any) => `${i.material_type || 'Item'} (${i.quantity})`).join(', ')}
                    </div>
                  )}
                </div>
                <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">Transaction Fee</div>
                  <div className="font-mono font-medium text-red-500 mt-0.5">{transactionFee > 0 ? `-${fmt(transactionFee)}` : '₹0.00'}</div>
                </div>
                <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">Processing Fee</div>
                  <div className="font-mono font-medium text-red-500 mt-0.5">{processingFee > 0 ? `-${fmt(processingFee)}` : '₹0.00'}</div>
                </div>
                <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">Regulatory Fee</div>
                  <div className="font-mono font-medium text-red-500 mt-0.5">{regulatoryFee > 0 ? `-${fmt(regulatoryFee)}` : '₹0.00'}</div>
                </div>
                <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">TDS</div>
                  <div className="font-mono font-medium text-red-500 mt-0.5">{tds > 0 ? `-${fmt(tds)}` : '₹0.00'}</div>
                </div>
                <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">TCS</div>
                  <div className="font-mono font-medium text-red-500 mt-0.5">{tcs > 0 ? `-${fmt(tcs)}` : '₹0.00'}</div>
                </div>
                <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">Offsite Ads</div>
                  <div className="font-mono font-medium text-red-500 mt-0.5">{offsiteAds > 0 ? `-${fmt(offsiteAds)}` : '₹0.00'}</div>
                </div>
                <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                  <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">FedEx Cost</div>
                  <div className="font-mono font-medium text-red-500 mt-0.5">{fedexCost > 0 ? `-${fmt(fedexCost)}` : '₹0.00'}</div>
                </div>
                {Number(breakdown.salesTax || 0) > 0 && (
                  <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                    <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">Sales Tax (Withheld)</div>
                    <div className="font-mono font-medium text-red-500 mt-0.5">-{fmt(Number(breakdown.salesTax))}</div>
                  </div>
                )}
                {Number(breakdown.buyerFee || 0) > 0 && (
                  <div className="bg-[var(--color-brand-card)] p-2.5 rounded-lg border border-[var(--color-brand-border)]/60">
                    <div className="text-[10px] text-[var(--color-brand-muted)] uppercase">Buyer Fee</div>
                    <div className="font-mono font-medium text-red-500 mt-0.5">-{fmt(Number(breakdown.buyerFee))}</div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. TOTAL EXPENSE BANNER (Section 37) */}
            <div className="bg-[var(--color-brand-primary)] text-white p-4 rounded-xl flex justify-between items-center shadow-sm">
              <div>
                <div className="text-xs font-semibold text-white/80 uppercase tracking-wider">Total Expense</div>
                <div className="text-xs text-white/60">Proportional Charges + Order Level Expenses</div>
              </div>
              <div className="text-lg font-bold font-mono text-red-300">
                -{fmt(totalExpense)}
              </div>
            </div>

            {/* 5. INVENTORY & MATERIAL BREAKDOWN */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[var(--color-brand-primary)] uppercase tracking-wider">
                Inventory & Material Breakdown
              </h4>
              {data?.inventory && data.inventory.length > 0 ? (
                <div className="overflow-x-auto border border-[var(--color-brand-border)]/60 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--color-brand-background)]">
                      <tr className="border-b border-[var(--color-brand-border)]/60 text-[var(--color-brand-muted)]">
                        <th className="px-3 py-2 text-left font-semibold">Material Type</th>
                        <th className="px-3 py-2 text-left font-semibold">Category</th>
                        <th className="px-3 py-2 text-left font-semibold">Color</th>
                        <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-brand-border)]/30">
                      {data.inventory.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[var(--color-brand-background)]/20">
                          <td className="px-3 py-2 font-medium text-[var(--color-brand-primary)]">{item.material_type || 'N/A'}</td>
                          <td className="px-3 py-2 text-[var(--color-brand-muted)]">{item.category || '-'}</td>
                          <td className="px-3 py-2 text-[var(--color-brand-muted)]">{item.color || '-'}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-[var(--color-brand-primary)]">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-center py-3 text-[var(--color-brand-muted)] border border-[var(--color-brand-border)]/40 rounded-lg">
                  No inventory records linked to this order.
                </div>
              )}
            </div>

            {/* 6. FEDEX SHIPPING DETAILS (Section 18, 55) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[var(--color-brand-primary)] uppercase tracking-wider">
                FedEx Shipping Details & AWB Mapping
              </h4>
              {fedexDetails && fedexDetails.length > 0 ? (
                <div className="overflow-x-auto border border-[var(--color-brand-border)]/60 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--color-brand-background)]">
                      <tr className="border-b border-[var(--color-brand-border)]/60 text-[var(--color-brand-muted)]">
                        <th className="px-3 py-2 text-left font-semibold">AWB Number</th>
                        <th className="px-3 py-2 text-left font-semibold">Mapping Source</th>
                        <th className="px-3 py-2 text-right font-semibold">Total AWB Cost</th>
                        <th className="px-3 py-2 text-right font-semibold">Allocated Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-brand-border)]/30">
                      {fedexDetails.map((f: any, idx: number) => {
                        const isApi = f.source === 'Shipment API';
                        const isCsv = f.source === 'FedEx Billing CSV';
                        const badgeStyle = isApi
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isCsv
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200';

                        return (
                          <tr key={idx} className="hover:bg-[var(--color-brand-background)]/20">
                            <td className="px-3 py-2 font-mono font-medium text-[var(--color-brand-primary)]">{f.awb_number}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeStyle}`}>
                                {f.source || 'Shipment API'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-[var(--color-brand-muted)]">{fmt(f.total_awb_cost)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-red-600">{fmt(f.allocated_cost)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-center py-3 text-[var(--color-brand-muted)] border border-[var(--color-brand-border)]/40 rounded-lg">
                  No FedEx billing records allocated to this order yet.
                </div>
              )}
            </div>

            {/* 6. ETSY EXPENSE TRANSACTIONS BREAKDOWN (Section 38, 55) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-[var(--color-brand-border)]/60 pb-1.5">
                <span className="text-xs font-bold text-[var(--color-brand-primary)] uppercase tracking-wider">
                  Etsy Transactions Breakdown
                </span>
              </div>
              {transactions && transactions.length > 0 ? (
                <div className="overflow-x-auto border border-[var(--color-brand-border)]/50 rounded-lg max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--color-brand-background)] sticky top-0">
                      <tr className="border-b border-[var(--color-brand-border)]/50 text-[var(--color-brand-muted)]">
                        <th className="px-3 py-2 text-left font-semibold">Date</th>
                        <th className="px-3 py-2 text-left font-semibold">Type</th>
                        <th className="px-3 py-2 text-left font-semibold">Description</th>
                        <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-brand-border)]/30">
                      {transactions.map((tx: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[var(--color-brand-background)]/30">
                          <td className="px-3 py-2 text-[var(--color-brand-muted)] whitespace-nowrap">{formatDate(tx.date)}</td>
                          <td className="px-3 py-2 font-medium">
                            {tx.expense_type}
                            {tx.is_allocation && <span className="ml-1 text-[8px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">ALLOC</span>}
                          </td>
                          <td className="px-3 py-2 text-[var(--color-brand-muted)] truncate max-w-[220px]" title={tx.title}>{tx.title || '-'}</td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-red-600">{fmt(tx.net_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-center py-3 text-[var(--color-brand-muted)] border border-[var(--color-brand-border)]/50 rounded-lg">
                  No individual Etsy expense transactions found.
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
