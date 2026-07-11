'use client';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ExpenseBreakdownPoint } from '@/lib/dashboard/dashboardTypes';

const COLORS = ['#184B4D', '#E4D4BA']; // FedEx (Dark), Material (Gold)

export default function ExpenseBreakdownChart({ data, total, isLoading }: { data: ExpenseBreakdownPoint[], total: number, isLoading: boolean }) {
  if (isLoading) {
    return <div className="w-full h-[350px] bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] animate-pulse" />;
  }

  if (total === 0) {
    return <div className="w-full h-[350px] bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] flex items-center justify-center text-[var(--color-brand-muted)] text-sm">No expense data available.</div>;
  }

  return (
    <div className="bg-[var(--color-brand-card)] p-6 rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm h-full flex flex-col">
      <h3 className="font-semibold text-[var(--color-brand-primary)] mb-6">Expense Breakdown</h3>
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6">
        
        <div className="w-48 h-48 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-[var(--color-brand-muted)] font-medium">Total Expenses</span>
            <span className="text-sm font-bold text-[var(--color-brand-primary)]">
              ₹{new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(total)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {data.map((item, index) => (
            <div key={item.name} className="flex flex-col">
              <div className="flex items-center text-sm font-medium text-[var(--color-brand-primary)] mb-1">
                <div className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                {item.name}
              </div>
              <div className="flex items-center justify-between pl-4 text-xs text-[var(--color-brand-muted)]">
                <span>₹{new Intl.NumberFormat('en-IN').format(item.value)}</span>
                <span className="ml-4 font-semibold">{item.percentage}%</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}