'use client';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartDataPoint } from '@/lib/dashboard/dashboardTypes';

export default function BusinessPerformanceChart({ data, isLoading }: { data: ChartDataPoint[], isLoading: boolean }) {
  if (isLoading) {
    return <div className="w-full h-[350px] bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)]" />;
  }

  if (!data || data.length === 0) {
    return <div className="w-full h-[350px] bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] flex flex-col items-center justify-center text-[var(--color-brand-muted)] text-sm">No sales data available for this period.</div>;
  }

  const formatCurrency = (val: number) => `₹${new Intl.NumberFormat('en-IN').format(val)}`;

 const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const chartData = payload[0].payload;
      
      const sales = chartData.sales || 0;
      const materialCost = chartData.materialCost || 0;
      const fedexCost = chartData.dutyCost || chartData.fedexCost || 0; 
      const totalExpenses = chartData.expenses || (materialCost + fedexCost);
      const profit = chartData.profit || (sales - totalExpenses);
      const margin = chartData.margin || 0;

      return (
        <div className="bg-white p-5 border border-[var(--color-brand-border)] shadow-xl rounded-xl text-sm min-w-[250px]">
          {/* Header */}
          <p className="font-bold text-[var(--color-brand-primary)] mb-4 text-[15px] tracking-wide">{label}</p>
          
          <div className="flex flex-col gap-3">
            {/* Sales */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#4B8B84]" />
                <span className="text-[var(--color-brand-muted)] font-medium">Sales</span>
              </div>
              <span className="font-semibold text-[var(--color-brand-primary)]">{formatCurrency(sales)}</span>
            </div>

            {/* Total Expenses */}
            <div className="flex justify-between items-center mt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#E89B71]" />
                <span className="font-semibold text-[var(--color-brand-primary)]">Total Expenses</span>
              </div>
              <span className="font-bold text-red-500">{formatCurrency(totalExpenses)}</span>
            </div>

            {/* Sub-Expenses (Indented, lighter text, no bullets needed due to indent) */}
            <div className="flex flex-col gap-1.5 pl-5 pr-1 mb-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--color-brand-muted)]">Material Cost</span>
                <span className="text-xs font-medium text-[var(--color-brand-muted)]">{formatCurrency(materialCost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--color-brand-muted)]">FedEx Expenses</span>
                <span className="text-xs font-medium text-[var(--color-brand-muted)]">{formatCurrency(fedexCost)}</span>
              </div>
            </div>

            {/* Profit */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#184B4D]" />
                <span className="font-bold text-[var(--color-brand-primary)]">Profit</span>
              </div>
              <span className="font-bold text-[#184B4D]">{formatCurrency(profit)}</span>
            </div>

            {/* Margin */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-transparent" />
                <span className="text-[var(--color-brand-muted)] font-medium">Margin</span>
              </div>
              <span className="font-semibold text-[var(--color-brand-primary)]">{margin}%</span>
            </div>
          </div>
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
            <YAxis yAxisId="left" tickFormatter={(val) => `₹${val >= 100000 ? (val / 100000).toFixed(1) + 'L' : (val / 1000) + 'k'}`} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#677072' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            
            <Bar yAxisId="left" dataKey="sales" name="Sales" fill="#4B8B84" radius={[4, 4, 0, 0]} barSize={20} isAnimationActive={false} />
            <Bar yAxisId="left" dataKey="expenses" name="Expenses" fill="#E89B71" radius={[4, 4, 0, 0]} barSize={20} isAnimationActive={false} />
            <Line yAxisId="left" type="monotone" dataKey="profit" name="Profit" stroke="#184B4D" strokeWidth={3} dot={{ r: 4, fill: '#184B4D', stroke: 'white', strokeWidth: 2 }} isAnimationActive={false} />
            <Line yAxisId="left" dataKey="margin" name="Margin" stroke="transparent" activeDot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}