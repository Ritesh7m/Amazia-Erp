'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';

function FiltersContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeRange, setActiveRange] = useState('12M');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isExporting, setIsExporting] = useState(false);

  // Safely grab dates from the URL for our calendar pickers
  const fromDate = searchParams.get('from') || '';
  const toDate = searchParams.get('to') || '';

  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  // Initialize default dates or read from URL on load
  useEffect(() => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (!fromParam || !toParam) {
      handleDateRangeChange('12M');
    } else {
      setSearchQuery(searchParams.get('q') || '');
      
      // Calculate the difference in days to figure out which button to highlight
      const d1 = new Date(fromParam);
      const d2 = new Date(toParam);
      const diffDays = Math.round(Math.abs((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));

      if (diffDays === 7) setActiveRange('7D');
      else if (diffDays >= 28 && diffDays <= 31) setActiveRange('30D');
      else if (diffDays >= 89 && diffDays <= 93) setActiveRange('3M');
      else if (diffDays >= 180 && diffDays <= 184) setActiveRange('6M');
      else if (diffDays >= 364 && diffDays <= 366) setActiveRange('12M');
      else setActiveRange('Custom'); 
    }
  }, [searchParams]);

  const handleDateRangeChange = (range: string) => {
    setActiveRange(range);
    const to = new Date();
    let from = new Date();

    switch (range) {
      case '7D': from.setDate(to.getDate() - 7); break;
      case '30D': from.setDate(to.getDate() - 30); break;
      case '3M': from.setMonth(to.getMonth() - 3); break;
      case '6M': from.setMonth(to.getMonth() - 6); break;
      case '12M': from.setFullYear(to.getFullYear() - 1); break;
      case 'FY':
        // Indian Financial Year: April 1st to March 31st
        const currentMonth = to.getMonth();
        const startYear = currentMonth >= 3 ? to.getFullYear() : to.getFullYear() - 1;
        from = new Date(startYear, 3, 1); 
        break;
      default: return;
    }

    updateURL(formatDate(from), formatDate(to), searchQuery);
  };

  // Handles manual calendar picks
  const handleCustomDateChange = (type: 'from' | 'to', value: string) => {
    setActiveRange('Custom');
    const currentFrom = searchParams.get('from') || '';
    const currentTo = searchParams.get('to') || '';
    
    if (type === 'from') {
      updateURL(value, currentTo, searchQuery);
    } else {
      updateURL(currentFrom, value, searchQuery);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateURL(searchParams.get('from')!, searchParams.get('to')!, searchQuery);
  };

  const updateURL = (from: string, to: string, q: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (q) params.set('q', q);
    else params.delete('q');
    
    params.set('page', '1'); // Reset pagination on filter change
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      window.location.href = `/api/dashboard/export?from=${from}&to=${to}`;
      toast.success('Report download started');
    } catch (err) {
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const ranges = ['7D', '30D', '3M', '6M', '12M', 'FY'];

  return (
    <div className="flex flex-col xl:flex-row gap-4 mb-8">
      {/* Date Range Selector */}
      <div className="flex items-center bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] p-1 shadow-sm overflow-x-auto no-scrollbar">
        
        {/* Interactive Calendar Pickers */}
        <div className="flex items-center px-3 border-r border-[var(--color-brand-border)] gap-2">
          <input 
            type="date" 
            value={fromDate}
            onChange={(e) => handleCustomDateChange('from', e.target.value)}
            className="bg-transparent text-sm font-medium text-[var(--color-brand-primary)] focus:outline-none cursor-pointer"
          />
          <span className="text-[var(--color-brand-muted)] font-medium">to</span>
          <input 
            type="date" 
            value={toDate}
            onChange={(e) => handleCustomDateChange('to', e.target.value)}
            className="bg-transparent text-sm font-medium text-[var(--color-brand-primary)] focus:outline-none cursor-pointer"
          />
        </div>

        {/* Preset Range Buttons */}
        {ranges.map(range => (
          <button
            key={range}
            onClick={() => handleDateRangeChange(range)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeRange === range 
                ? 'bg-[var(--color-brand-primary)] text-white shadow-sm' 
                : 'text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-background)]'
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex-1 relative">
        <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-brand-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input 
          type="text" 
          placeholder="Search by Order No..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent shadow-sm placeholder:text-[var(--color-brand-muted)]/70 text-[var(--color-brand-primary)]"
        />
      </form>

      {/* Export Button */}
      <button 
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center justify-center px-5 py-2.5 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] text-sm font-semibold text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-background)] transition-colors shadow-sm disabled:opacity-50"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        {isExporting ? 'Exporting...' : 'Export Report'}
      </button>
    </div>
  );
}

// Wrap the component in Suspense to prevent Next.js build errors
export default function DashboardFilters() {
  return (
    <Suspense fallback={
      <div className="w-full h-14 bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] animate-pulse mb-8"></div>
    }>
      <FiltersContent />
    </Suspense>
  );
}