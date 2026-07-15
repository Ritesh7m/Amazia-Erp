'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isUpload = pathname?.includes('/upload');
  const isOrders = pathname?.includes('/orders');
  
  const title = isUpload ? 'Upload Center' : isOrders ? 'Order History' : 'Dashboard';
  const subtitle = isUpload 
    ? 'Import your Etsy and FedEx CSV files into the database' 
    : isOrders 
    ? 'View, search, filter and export order-level sales data' 
    : 'Overview of your business performance';

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    router.refresh(); 
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 mb-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-brand-primary)] tracking-tight">{title}</h1>
        <p className="text-[var(--color-brand-muted)] text-sm mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4 mt-4 md:mt-0 text-sm">
        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-full hover:bg-[var(--color-brand-background)] transition-colors disabled:opacity-50 border border-transparent hover:border-[var(--color-brand-border)]"
        >
          <svg className={`w-5 h-5 text-[var(--color-brand-primary)] ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="w-px h-6 bg-[var(--color-brand-border)] mx-1"></div>
        {/* User Avatar */}
        <div className="w-9 h-9 rounded-[var(--radius-xl)] bg-[var(--color-brand-primary)] text-white flex items-center justify-center font-semibold shadow-sm">
          R
        </div>
      </div>
    </header>
  );
}