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
  onOpenOrderDetails: (orderNo: string) => void;
}



export default function OrdersTable({ data, totalRecords, page, pageSize, totalPages, isLoading, onPageChange, onOpenOrderDetails }: OrdersTableProps) {

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
                        onClick={() => onOpenOrderDetails(order.orderNo)}
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
                      {typeof order.margin === 'number' ? `${order.margin.toFixed(3)}%` : 'N/A'}
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

    </div>
  );
}
