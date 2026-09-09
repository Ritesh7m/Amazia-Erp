'use client';

interface MetricCardProps {
  title: string;
  value: number | string;
  previousValue?: number;
  changePercentage?: number | null;
  trend?: 'up' | 'down' | 'neutral';
  prefix?: string;
  suffix?: string;
  isLoading?: boolean;
  inverseTrendColor?: boolean; 
  comparisonText?: string;
  isPercentagePoint?: boolean;
}

export default function MetricCard({
  title,
  value,
  changePercentage = 0,
  trend = 'neutral',
  prefix = '',
  suffix = '',
  isLoading = false,
  inverseTrendColor = false,
  comparisonText = 'vs previous period',
  isPercentagePoint = false
}: MetricCardProps) {
  // Format numbers based on type
  let formattedValue = value;
  if (typeof value === 'number') {
    if (suffix === '%') {
      formattedValue = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 3 }).format(value);
    } else if (prefix === '₹') {
      formattedValue = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
    } else {
      formattedValue = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
    }
  }

  // Determine trend colors and icons
  let trendColor = 'text-[var(--color-brand-muted)]';
  let bgColor = 'bg-gray-100';
  let ArrowIcon = null;

  if (trend === 'up') {
    trendColor = inverseTrendColor ? 'text-red-600' : 'text-green-600';
    bgColor = inverseTrendColor ? 'bg-[var(--color-brand-danger)]' : 'bg-[var(--color-brand-success)]';
    ArrowIcon = () => <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
  } else if (trend === 'down') {
    trendColor = inverseTrendColor ? 'text-green-600' : 'text-red-600';
    bgColor = inverseTrendColor ? 'bg-[var(--color-brand-success)]' : 'bg-[var(--color-brand-danger)]';
    ArrowIcon = () => <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
  }

  const isNA = changePercentage === null || changePercentage === undefined;

  if (isLoading) {
    return (
      <div className="bg-[var(--color-brand-card)] p-4 xl:p-5 rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm animate-pulse flex flex-col justify-center min-h-[95px]">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-7 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-brand-card)] p-4 xl:p-5 rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm flex flex-col justify-center min-h-[95px]">
      <div className="flex justify-between items-start mb-1.5">
        <h3 className="text-xs sm:text-sm font-semibold text-[var(--color-brand-muted)] tracking-wide">{title}</h3>
      </div>
      
      <div>
        <span 
          className="block text-2xl lg:text-[1.25rem] xl:text-[1.5rem] 2xl:text-3xl font-bold text-[var(--color-brand-primary)] tracking-tight tabular-nums whitespace-nowrap"
          title={`${prefix}${formattedValue}${suffix}`}
        >
          {prefix}{formattedValue}{suffix}
        </span>
      </div>
    </div>
  );
}