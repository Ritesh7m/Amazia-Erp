import React from 'react';
import { fetchQuery } from '@/database';
import { InventoryRecord } from '@/types/inventory';


export const dynamic = 'force-dynamic';

export default async function InventoryDashboard() {
  // Look at this! Zero Google Sheets APIs. Pure DuckDB speed.
  const inventoryData = await fetchQuery<InventoryRecord>(
    `SELECT * FROM inventory_table ORDER BY order_no DESC`
  );

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-brand-primary)]">Inventory Master (DuckDB)</h1>
        <p className="text-[var(--color-brand-muted)]">Live reads directly from the local database engine.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-brand-border)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--color-brand-background)] border-b border-[var(--color-brand-border)]">
              <th className="p-4 text-sm font-semibold text-[var(--color-brand-primary)]">Order No</th>
              <th className="p-4 text-sm font-semibold text-[var(--color-brand-primary)]">Material</th>
              <th className="p-4 text-sm font-semibold text-[var(--color-brand-primary)]">Category</th>
              <th className="p-4 text-sm font-semibold text-[var(--color-brand-primary)]">Color</th>
              <th className="p-4 text-sm font-semibold text-[var(--color-brand-primary)] text-right">Aggregated Qty</th>
              <th className="p-4 text-sm font-semibold text-[var(--color-brand-primary)] text-right">Material Cost</th>
            </tr>
          </thead>
          <tbody>
            {inventoryData.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[var(--color-brand-muted)]">No inventory data found. Run the sync!</td>
              </tr>
            ) : (
              inventoryData.map((item, idx) => (
                <tr key={idx} className="border-b border-[var(--color-brand-border)]/50 hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm text-slate-800 font-medium">{item.order_no}</td>
                  <td className="p-4 text-sm text-slate-600">{item.material_type}</td>
                  <td className="p-4 text-sm text-slate-600">{item.category}</td>
                  <td className="p-4 text-sm text-slate-600">
                    <span className="px-2 py-1 bg-slate-100 rounded-md text-xs">{item.color}</span>
                  </td>
                  <td className="p-4 text-sm font-semibold text-slate-800 text-right">{item.quantity}</td>
                  <td className="p-4 text-sm font-semibold text-emerald-600 text-right">
                    ₹{item.material_cost.toLocaleString('en-IN')}
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