'use client';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ExpenseBreakdownPoint } from '@/lib/dashboard/dashboardTypes';

const CATEGORY_COLORS: Record<string, string> = {
  'Material Cost': '#184B4D',
  'FedEx Duty/Transportation': '#E4D4BA',
  'Etsy Listing Expense': '#4B8B84',
  'Etsy Ads': '#F59E0B',
  'Offsite Ads': '#F97316',
  'Other Etsy Expenses': '#94A3B8',
};

const DISPLAY_CATEGORY_NAMES = [
  'Material Cost',
  'FedEx Duty/Transportation',
  'Etsy Listing Expense',
  'Etsy Ads',
  'Offsite Ads',
  'Other Etsy Expenses',
];

export default function ExpenseBreakdownChart({
  data,
  total,
  isLoading,
}: {
  data: ExpenseBreakdownPoint[];
  total: number;
  isLoading: boolean;
}) {
  const fmtCurrency = (val: number) =>
    `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)}`;

  if (isLoading) {
    return (
      <div className="w-full h-[360px] bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] animate-pulse" />
    );
  }

  if (total === 0 || !data || data.length === 0) {
    return (
      <div className="bg-[var(--color-brand-card)] p-6 rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm h-full flex flex-col items-center justify-center min-h-[300px]">
        <h3 className="font-semibold text-[var(--color-brand-primary)] self-start mb-4">
          Expense Breakdown
        </h3>
        <p className="text-[var(--color-brand-muted)] text-sm">
          No expense data available for this period.
        </p>
      </div>
    );
  }

  // Ensure all categories exist in display list even if 0
  const displayList = DISPLAY_CATEGORY_NAMES.map((name) => {
    const found = data.find((d) => d.name === name);
    const value = found ? found.value : 0;
    const percentage =
      total === 0 ? 0 : Math.round((value / total) * 1000) / 10;
    return {
      name,
      value,
      percentage,
      color: CATEGORY_COLORS[name] || '#94A3B8',
    };
  });

  return (
    <div className="bg-[var(--color-brand-card)] p-6 rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm h-full flex flex-col items-center justify-between">
      <h3 className="font-semibold text-[var(--color-brand-primary)] self-start mb-2">
        Expense Breakdown
      </h3>

      {/* Top: Perfectly Circular Donut Chart Area */}
      <div className="w-44 h-44 aspect-square relative flex-shrink-0 flex items-center justify-center mx-auto my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORY_COLORS[entry.name] || '#94A3B8'}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
          <span className="text-[10px] text-[var(--color-brand-muted)] font-semibold tracking-wider uppercase">
            TOTAL EXPENSES
          </span>
          <span className="text-sm font-bold text-[var(--color-brand-primary)] mt-0.5">
            {fmtCurrency(total)}
          </span>
        </div>
      </div>

      {/* Below the Circle: Expense Categories Breakdown */}
      <div className="w-full space-y-2.5 pt-3 border-t border-[var(--color-brand-border)]/60 mt-1">
        {displayList.map((cat) => (
          <div
            key={cat.name}
            className="flex items-center justify-between text-xs"
          >
            <div className="flex items-center font-medium text-[var(--color-brand-primary)]">
              <span
                className="w-2.5 h-2.5 rounded-full mr-2.5 flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="truncate max-w-[170px]">{cat.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-[var(--color-brand-primary)]">
                {fmtCurrency(cat.value)}
              </span>
              <span className="text-[11px] text-[var(--color-brand-muted)] font-medium min-w-[36px] text-right">
                {cat.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}