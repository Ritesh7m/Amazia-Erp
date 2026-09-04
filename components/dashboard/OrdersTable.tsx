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
  isZeroSalesOnly?: boolean;
  onPageChange: (page: number) => void;
  onOpenOrderDetails: (orderNo: string) => void;
}

export default function OrdersTable({ data, totalRecords, page, pageSize, totalPages, isLoading, isZeroSalesOnly, onPageChange, onOpenOrderDetails }: OrdersTableProps) {

  const fmt = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(n)) return 'N/A';
    return `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
  };

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
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--color-brand-primary)]">
            {isZeroSalesOnly ? 'Other Stores / Zero-Sales Orders' : 'Orders'}
          </h3>
          {isZeroSalesOnly && (
            <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
              Pending Sales API
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--color-brand-muted)]">{totalRecords} total orders</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-brand-background)]/50 text-[var(--color-brand-muted)]">
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Order & Destination</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">Sales Date</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider">AWB(s)</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Sales</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">FedEx Cost</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Material</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Listing Exp</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Expense</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Direct NPF</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider">Margin</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-[var(--color-brand-muted)] text-sm">
                  No orders found for this period.
                </td>
              </tr>
            ) : (
              data.map((order) => {
                const fedexCost = Number(order.fedexCost ?? order.dutyCost ?? 0);
                const materialCost = Number(order.materialCost ?? order.expenseBreakdown?.materialCost ?? 0);
                const listingExpense = Number(order.expenseBreakdown?.listingExpense ?? 0);
                const hasRefund = order.refundAmount !== undefined && order.refundAmount > 0;
                const isFullyRefunded = order.refundStatus === 'Refunded' || (hasRefund && order.refundAmount! >= order.sales && order.sales > 0);
                const isPartiallyRefunded = order.refundStatus === 'Partially Refunded' || (hasRefund && !isFullyRefunded);

                return (
                  <tr key={order.orderNo} className="border-b border-[var(--color-brand-border)] last:border-none hover:bg-[var(--color-brand-background)]/30 transition-colors">
                    {/* Order & Destination */}
                    <td className="px-4 py-3.5 max-w-[240px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[var(--color-brand-primary)]">{order.orderNo}</span>
                        {order.country && order.country !== 'N/A' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {order.country}
                          </span>
                        )}
                        {isFullyRefunded && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                            Refunded
                          </span>
                        )}
                        {isPartiallyRefunded && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                            Partially Refunded
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-brand-muted)] truncate mt-1" title={order.productTitle || 'Etsy Order Item'}>
                        {order.productTitle || 'Etsy Order Item'}
                      </div>
                    </td>

                    {/* Sales Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-[var(--color-brand-primary)]">
                      {order.saleDate || 'N/A'}
                    </td>

                    {/* AWB(s) */}
                    <td className="px-4 py-3.5">
                      {order.awbNumbers && order.awbNumbers !== 'N/A' ? (
                        <div className="flex flex-col gap-2 max-w-[140px]">
                          {order.awbNumbers.split(',').map((awbRaw) => {
                            const awb = awbRaw.trim();
                            if (!awb) return null;

                            let sourceTag = 'API';
                            let sourceColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                            if (order.awbSources) {
                              const matched = order.awbSources.split(',').map((s) => s.trim()).find((s) => s.startsWith(awb + ':'));
                              if (matched) {
                                const src = matched.split(':')[1] || '';
                                if (src.includes('FedEx') && src.includes('API')) {
                                  sourceTag = 'API • FEDEX';
                                  sourceColor = 'text-purple-700 bg-purple-50 border-purple-200';
                                } else if (src.includes('FedEx')) {
                                  sourceTag = 'FEDEX';
                                  sourceColor = 'text-blue-700 bg-blue-50 border-blue-200';
                                } else {
                                  sourceTag = 'API';
                                  sourceColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                                }
                              }
                            }

                            return (
                              <div key={awb} className="flex flex-col items-start gap-0.5">
                                <span className={`text-[9px] font-bold px-1 py-0.2 rounded border uppercase tracking-wider ${sourceColor}`}>
                                  {sourceTag}
                                </span>
                                <span className="font-mono text-[11px] px-1.5 py-0.5 bg-[var(--color-brand-background)] border border-[var(--color-brand-border)] rounded text-[var(--color-brand-primary)] truncate w-max shadow-xs" title={`${awb} (${sourceTag})`}>
                                  {awb}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-[var(--color-brand-muted)]">N/A</span>
                      )}
                    </td>

                    {/* Sales */}
                    <td className="px-4 py-3.5 text-right">
                      {order.sales !== null && order.sales !== undefined ? (
                        <div className="font-medium text-[var(--color-brand-primary)]">
                          {fmt(order.sales)}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-brand-muted)] font-mono">
                          N/A
                        </span>
                      )}
                      {order.sales === 0 && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 block mt-0.5">
                          Pending API
                        </span>
                      )}
                      {order.sales === null && (
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-200 block mt-0.5">
                          Pending Sales API
                        </span>
                      )}
                      {hasRefund && (
                        <div className="text-[10px] text-red-500 mt-0.5">
                          -{fmt(order.refundAmount!)}
                        </div>
                      )}
                    </td>

                    {/* FedEx Cost */}
                    <td className="px-4 py-3.5 text-right font-medium text-[var(--color-brand-primary)]">
                      {fedexCost > 0 ? (
                        <span className="font-mono text-xs">{fmt(fedexCost)}</span>
                      ) : (
                        <span className="text-xs text-[var(--color-brand-muted)]">₹0.00</span>
                      )}
                    </td>

                    {/* Material Cost */}
                    <td className="px-4 py-3.5 text-right font-medium text-[var(--color-brand-primary)]">
                      {materialCost > 0 ? (
                        <span className="font-mono text-xs">{fmt(materialCost)}</span>
                      ) : (
                        <span className="text-xs text-[var(--color-brand-muted)]">₹0.00</span>
                      )}
                      {((order.quantity !== undefined && order.quantity > 0) || (order.materialType && order.materialType !== 'N/A')) && (
                        <div className="text-[10px] text-[var(--color-brand-muted)] mt-0.5 whitespace-nowrap">
                          {order.materialType && order.materialType !== 'N/A' ? order.materialType : 'Item'}
                          {order.quantity !== undefined && order.quantity > 0 ? ` • Qty: ${order.quantity}` : ''}
                        </div>
                      )}
                    </td>

                    {/* Listing Expense */}
                    <td className="px-4 py-3.5 text-right font-medium text-[var(--color-brand-primary)]">
                      {listingExpense > 0 ? (
                        <span className="font-mono text-xs">{fmt(listingExpense)}</span>
                      ) : (
                        <span className="text-xs text-[var(--color-brand-muted)]">₹0.00</span>
                      )}
                    </td>

                    {/* Expense */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-medium text-red-500 font-mono text-xs">{fmt(order.totalExpense)}</span>
                        <button
                          onClick={() => onOpenOrderDetails(order.orderNo)}
                          className="p-0.5 rounded-full hover:bg-[var(--color-brand-background)] transition-colors group"
                          title="View expense breakdown"
                          aria-label="View expense breakdown"
                        >
                          <svg className="w-3.5 h-3.5 text-[var(--color-brand-muted)] group-hover:text-[var(--color-brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                    </td>

                    {/* Direct NPF / Profit */}
                    <td className={`px-4 py-3.5 text-right font-bold font-mono text-xs ${order.estimatedProfitBeforeShipping >= 0 ? 'text-[#184B4D]' : 'text-red-600'}`}>
                      {fmt(order.estimatedProfitBeforeShipping)}
                    </td>

                    {/* Margin */}
                    <td className="px-4 py-3.5 text-right">
                      {order.margin !== null && order.margin !== undefined && isFinite(order.margin) ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          order.margin > 0 
                            ? 'bg-[#4B8B84]/10 text-[#4B8B84]' 
                            : order.margin < 0 
                            ? 'bg-red-100 text-red-600 font-mono' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {order.margin.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                          N/A
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
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

    </div>
  );
}
