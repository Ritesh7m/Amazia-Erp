'use client';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartDataPoint } from '@/lib/dashboard/dashboardTypes';

export default function BusinessPerformanceChart({ data, isLoading }: { data: ChartDataPoint[], isLoading: boolean }) {
  if (isLoading) {
    return <div className="w-full h-[350px] bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] animate-pulse" />;
  }

  if (!data || data.length === 0) {
    return <div className="w-full h-[350px] bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] flex flex-col items-center justify-center text-[var(--color-brand-muted)] text-sm">No sales data available for this period.</div>;
  }

  const formatCurrency = (val: number) => `₹${new Intl.NumberFormat('en-IN').format(val)}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-[var(--color-brand-border)] shadow-[var(--shadow-glass)] rounded-lg text-sm">
          <p className="font-semibold text-[var(--color-brand-primary)] mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-6 mb-1">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
                <span className="text-[var(--color-brand-muted)]">{entry.name}</span>
              </div>
              <span className="font-medium text-[var(--color-brand-primary)]">
                {entry.name === 'Margin' ? `${entry.value}%` : formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[var(--color-brand-card)] p-6 rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-[var(--color-brand-primary)]">Business Performance (Monthly)</h3>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4D4BA" opacity={0.5} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#677072' }} dy={10} />
            <YAxis yAxisId="left" tickFormatter={(val) => `₹${val / 100000}L`} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#677072' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            
            <Bar yAxisId="left" dataKey="sales" name="Sales" fill="#4B8B84" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar yAxisId="left" dataKey="expenses" name="Expenses" fill="#E89B71" radius={[4, 4, 0, 0]} barSize={20} />
            <Line yAxisId="left" type="monotone" dataKey="profit" name="Profit" stroke="#184B4D" strokeWidth={3} dot={{ r: 4, fill: '#184B4D', stroke: 'white', strokeWidth: 2 }} />
            {/* Invisible line just to inject margin into the tooltip */}
            <Line yAxisId="left" dataKey="margin" name="Margin" stroke="transparent" activeDot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}