"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// UI Components
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import MetricCard from "@/components/dashboard/MetricCard";
import BusinessPerformanceChart from "@/components/dashboard/BusinessPerformanceChart";
import ExpenseBreakdownChart from "@/components/dashboard/ExpenseBreakdownChart";
import OrdersTable, { OrderTab } from "@/components/dashboard/OrdersTable";
import OrderDetailsModal from "@/components/dashboard/OrderDetailsModal";

// Types
import {
  DashboardSummaryResponse,
  ChartDataPoint,
  ExpenseBreakdownPoint,
  OrderData,
} from "@/lib/dashboard/dashboardTypes";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // State Management
  const [summaryData, setSummaryData] = useState<
    DashboardSummaryResponse["data"] | null
  >(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [expenseData, setExpenseData] = useState<{
    data: ExpenseBreakdownPoint[];
    total: number;
  }>({ data: [], total: 0 });
  const [ordersData, setOrdersData] = useState<OrderData[]>([]);
  const [ordersMeta, setOrdersMeta] = useState({ totalRecords: 0, page: 1, pageSize: 10, totalPages: 1 });
  const [activeTab, setActiveTab] = useState<OrderTab>('orders');
  
  // Unified Modal State
  const [activeOrderNo, setActiveOrderNo] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPage = parseInt(searchParams.get("page") || "1") || 1;

  const handlePageChange = useCallback((newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const handleTabChange = useCallback((newTab: OrderTab) => {
    setActiveTab(newTab);
    handlePageChange(1);
  }, [handlePageChange]);

  // Fetch all dashboard data concurrently
  useEffect(() => {
    // Wait for the filters component to set the default URL dates
    if (!from || !to) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [sumRes, perfRes, expRes, ordRes] = await Promise.all([
          fetch(`/api/dashboard/summary?from=${from}&to=${to}`),
          fetch(`/api/dashboard/performance?from=${from}&to=${to}`),
          fetch(`/api/dashboard/expense-breakdown?from=${from}&to=${to}`),
          fetch(`/api/dashboard/orders?from=${from}&to=${to}&page=${currentPage}&pageSize=10&tab=${activeTab}`),
        ]);

        const sumResult = await sumRes.json();
        const perfResult = await perfRes.json();
        const expResult = await expRes.json();
        const ordResult = await ordRes.json();

        if (sumResult.success) setSummaryData(sumResult.data);
        if (perfResult.success) setChartData(perfResult.data);
        if (expResult.success)
          setExpenseData({ data: expResult.data, total: expResult.total });
        if (ordResult.success) {
          setOrdersData(ordResult.data);
          setOrdersMeta({
            totalRecords: ordResult.totalRecords || 0,
            page: ordResult.page || currentPage,
            pageSize: ordResult.pageSize || 10,
            totalPages: ordResult.totalPages || 1,
          });
        }
      } catch (err) {
        setError("Network error loading dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [from, to, currentPage, activeTab]);

  // Format the comparison text string dynamically based on the date range
  const getComparisonText = () => {
    if (!from || !to) return "vs previous period";
    const days = Math.round(
      (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 3600 * 24),
    );
    if (days <= 7) return "vs previous 7 days";
    if (days <= 31) return "vs previous 30 days";
    if (days <= 93) return "vs previous 3 months";
    if (days <= 186) return "vs previous 6 months";
    if (days <= 366) return "vs previous 12 months";
    return "vs previous period";
  };

  return (
    <div>
      <DashboardFilters onOpenOrderDetails={setActiveOrderNo} />

      {error && (
        <div className="p-4 mb-6 text-sm text-red-600 bg-red-50 rounded-[var(--radius-xl)] border border-red-100 animate-fade-in">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 xl:gap-5 mb-6">
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
          title="Refund Value"
          value={summaryData?.refundValue?.value || 0}
          changePercentage={summaryData?.refundValue?.changePercentage}
          trend={summaryData?.refundValue?.trend}
          prefix="₹"
          isLoading={loading}
          inverseTrendColor={true} // High refunds = warning color
          comparisonText={getComparisonText()}
        />
        <MetricCard
          title="Net Profit"
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
          isPercentagePoint={summaryData?.profitMargin.isPercentagePoint}
          suffix="%"
          isLoading={loading}
          comparisonText={getComparisonText()}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <BusinessPerformanceChart data={chartData} isLoading={loading} />
        </div>
        <div>
          <ExpenseBreakdownChart
            data={expenseData.data}
            total={expenseData.total}
            isLoading={loading}
          />
        </div>
      </div>

      {/* Orders Table section */}
      <div className="mt-8 mb-4">
        <h2 className="text-xl font-bold text-[var(--color-brand-primary)]">
          {activeTab === 'zero_sales'
            ? 'Other Stores / Zero-Sales Orders'
            : activeTab === 'refunds'
            ? 'Refund Orders'
            : 'Recent Orders'}
        </h2>
        <p className="text-xs text-[var(--color-brand-muted)] mt-0.5">
          {activeTab === 'zero_sales'
            ? 'Showing orders with ₹0.00 sales (other stores / pending sales API)'
            : activeTab === 'refunds'
            ? 'Showing fully and partially refunded orders'
            : 'Showing active orders with verified sales revenue'}
        </p>
      </div>

      <div className="mb-10">
        <OrdersTable
          data={ordersData}
          totalRecords={ordersMeta.totalRecords}
          page={ordersMeta.page}
          pageSize={ordersMeta.pageSize}
          totalPages={ordersMeta.totalPages}
          isLoading={loading}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onPageChange={handlePageChange}
          onOpenOrderDetails={setActiveOrderNo}
        />
      </div>

      <OrderDetailsModal 
        orderNo={activeOrderNo} 
        onClose={() => setActiveOrderNo(null)} 
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-[var(--color-brand-muted)]">
        Loading Dashboard...
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
