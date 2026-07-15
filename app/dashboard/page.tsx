'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// UI Components
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import MetricCard from '@/components/dashboard/MetricCard';
import BusinessPerformanceChart from '@/components/dashboard/BusinessPerformanceChart';
import ExpenseBreakdownChart from '@/components/dashboard/ExpenseBreakdownChart';

// Types
import { 
  DashboardSummaryResponse, 
  ChartDataPoint, 
  ExpenseBreakdownPoint, 
  OrderData, 
  ActivityData 
} from '@/lib/dashboard/dashboardTypes';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  // State Management
  const [summaryData, setSummaryData] = useState<DashboardSummaryResponse['data'] | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [expenseData, setExpenseData] = useState<{ data: ExpenseBreakdownPoint[], total: number }>({ data: [], total: 0 });
  const [ordersData, setOrdersData] = useState<OrderData[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all dashboard data concurrently
  useEffect(() => {
    // Wait for the filters component to set the default URL dates
    if (!from || !to) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [sumRes, perfRes, expRes, ordRes, actRes] = await Promise.all([
          fetch(`/api/dashboard/summary?from=${from}&to=${to}`),
          fetch(`/api/dashboard/performance?from=${from}&to=${to}`),
          fetch(`/api/dashboard/expense-breakdown?from=${from}&to=${to}`),
          fetch(`/api/dashboard/orders?from=${from}&to=${to}&limit=5`), // Max 5 for preview
          fetch(`/api/dashboard/activity?limit=3`) // Max 3 for preview
        ]);
        
        const sumResult = await sumRes.json();
        const perfResult = await perfRes.json();
        const expResult = await expRes.json();
        const ordResult = await ordRes.json();
        const actResult = await actRes.json();

        if (sumResult.success) setSummaryData(sumResult.data);
        if (perfResult.success) setChartData(perfResult.data);
        if (expResult.success) setExpenseData({ data: expResult.data, total: expResult.total });
        if (ordResult.success) setOrdersData(ordResult.data);
        if (actResult.success) setActivityData(actResult.data);

      } catch (err) {
        setError('Network error loading dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [from, to]); 

  // Format the comparison text string dynamically based on the date range
  const getComparisonText = () => {
    if (!from || !to) return 'vs previous period';
    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 3600 * 24));
    if (days <= 7) return 'vs previous 7 days';
    if (days <= 31) return 'vs previous 30 days';
    if (days <= 93) return 'vs previous 3 months';
    if (days <= 186) return 'vs previous 6 months';
    if (days <= 366) return 'vs previous 12 months';
    return 'vs previous period';
  };

  return (
    <div>
      <DashboardFilters />

      {error && (
        <div className="p-4 mb-6 text-sm text-red-600 bg-red-50 rounded-[var(--radius-xl)] border border-red-100 animate-fade-in">
          {error}
        </div>
      )}

      {/* KPI Cards Grid (Step 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard 
          title="Total Sales" 
          value={summaryData?.totalSales.value || 0}
          changePercentage={summaryData?.totalSales.changePercentage}
          trend={summaryData?.totalSales.trend}
          prefix="₹"
          isLoading={loading}
          comparisonText={getComparisonText()}
        />
        <MetricCard 
          title="Total Expenses" 
          value={summaryData?.totalExpenses.value || 0}
          changePercentage={summaryData?.totalExpenses.changePercentage}
          trend={summaryData?.totalExpenses.trend}
          prefix="₹"
          isLoading={loading}
          inverseTrendColor={true} // High expenses = warning color
          comparisonText={getComparisonText()}
        />
        <MetricCard 
          title="Gross Profit" 
          value={summaryData?.grossProfit.value || 0}
          changePercentage={summaryData?.grossProfit.changePercentage}
          trend={summaryData?.grossProfit.trend}
          prefix="₹"
          isLoading={loading}
          comparisonText={getComparisonText()}
        />
        <MetricCard 
          title="Profit Margin" 
          value={summaryData?.profitMargin.value || 0}
          changePercentage={summaryData?.profitMargin.changePercentage}
          trend={summaryData?.profitMargin.trend}
          suffix="%"
          isLoading={loading}
          comparisonText={getComparisonText().replace('vs', 'pp vs')} // pp = percentage points
        />
      </div>

      {/* Charts Grid (Step 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <BusinessPerformanceChart data={chartData} isLoading={loading} />
        </div>
        <div>
          <ExpenseBreakdownChart data={expenseData.data} total={expenseData.total} isLoading={loading} />
        </div>
      </div>


    </div>
  );
}