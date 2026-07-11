'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import config from '@/config/config.json';

export default function DashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const [activePeriod, setActivePeriod] = useState<string>(`${config.dashboard.defaultPeriodMonths}M`);

  // Initialize default date range if missing from URL
  useEffect(() => {
    if (!searchParams.get('from') || !searchParams.get('to')) {
      handleQuickPeriod(`${config.dashboard.defaultPeriodMonths}M`);
    }
  }, []);

  // 400ms Debounce for Global Search
  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchValue.trim()) {
        params.set('search', searchValue.trim());
      } else {
        params.delete('search');
      }
      // Reset pagination on new search
      if (params.get('page')) params.set('page', '1');
      
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 400);
    return () => clearTimeout(handler);
  }, [searchValue]);

  const handleQuickPeriod = (period: string) => {
    setActivePeriod(period);
    const to = new Date(); // Current date
    const from = new Date();

    switch (period) {
      case '7D': from.setDate(to.getDate() - 7); break;
      case '30D': from.setDate(to.getDate() - 30); break;
      case '3M': from.setMonth(to.getMonth() - 3); break;
      case '6M': from.setMonth(to.getMonth() - 6); break;
      case '12M': from.setMonth(to.getMonth() - 12); break;
      case 'FY': 
        const currentMonth = to.getMonth();
        // Indian FY starts April 1st
        from.setFullYear(currentMonth >= 3 ? to.getFullYear() : to.getFullYear() - 1, 3, 1); 
        break;
      default: return; 
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('from', from.toISOString().split('T')[0]);
    params.set('to', to.toISOString().split('T')[0]);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const periods = ['7D', '30D', '3M', '6M', '12M', 'FY', 'Custom'];

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4 mb-6 animate-fade-in">
      {/* Date Range & Quick Periods */}
      <div className="flex bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] p-1 overflow-x-auto w-full lg:w-auto">
        <div className="flex items-center px-4 border-r border-[var(--color-brand-border)] text-sm text-[var(--color-brand-muted)] min-w-[max-content]">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {searchParams.get('from') || '...'} - {searchParams.get('to') || '...'}
        </div>
        <div className="flex gap-1 px-2">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => handleQuickPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activePeriod === p ? 'bg-[var(--color-brand-primary)] text-white' : 'text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-background)]'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Debounced Search */}
      <div className="relative w-full lg:flex-1">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-brand-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input 
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search by Order No., AWB or invoice type..."
          className="w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)] transition-all"
        />
        {searchValue && (
          <button onClick={() => setSearchValue('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Export Button */}
      <button className="flex items-center px-4 py-2.5 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] text-sm font-medium hover:bg-[var(--color-brand-background)] transition-colors w-full lg:w-auto justify-center">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        Export Report 
        <svg className="w-3 h-3 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  );
}