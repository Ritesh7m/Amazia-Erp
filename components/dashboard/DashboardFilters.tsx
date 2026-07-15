'use client';
import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';

function FiltersContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeRange, setActiveRange] = useState('12M');
  const [isExporting, setIsExporting] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  const searchRef = useRef<HTMLDivElement>(null);

  const fromDate = searchParams.get('from') || '';
  const toDate = searchParams.get('to') || '';

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set active date range pills
  useEffect(() => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (!fromParam || !toParam) {
      handleDateRangeChange('12M');
    } else {
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

  // Live Search Logic (Debounced)
  useEffect(() => {
    const fetchResults = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setIsDropdownOpen(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        setSearchResults(json.data || []);
        setIsDropdownOpen(true);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 350); // 350ms delay
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

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
        const currentMonth = to.getMonth();
        const startYear = currentMonth >= 3 ? to.getFullYear() : to.getFullYear() - 1;
        from = new Date(startYear, 3, 1); 
        break;
      default: return;
    }
    updateURL(formatDate(from), formatDate(to));
  };

  const handleCustomDateChange = (type: 'from' | 'to', value: string) => {
    setActiveRange('Custom');
    const currentFrom = searchParams.get('from') || '';
    const currentTo = searchParams.get('to') || '';
    if (type === 'from') updateURL(value, currentTo);
    else updateURL(currentFrom, value);
  };

  const updateURL = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', '1'); 
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
    <>
      <div className="flex flex-col xl:flex-row gap-4 mb-8">
        {/* Date Pickers & Range Buttons */}
        <div className="flex items-center bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] p-1 shadow-sm overflow-x-auto no-scrollbar">
          <div className="flex items-center px-3 border-r border-[var(--color-brand-border)] gap-2">
            <input type="date" value={fromDate} onChange={(e) => handleCustomDateChange('from', e.target.value)} className="bg-transparent text-sm font-medium text-[var(--color-brand-primary)] focus:outline-none cursor-pointer" />
            <span className="text-[var(--color-brand-muted)] font-medium">to</span>
            <input type="date" value={toDate} onChange={(e) => handleCustomDateChange('to', e.target.value)} className="bg-transparent text-sm font-medium text-[var(--color-brand-primary)] focus:outline-none cursor-pointer" />
          </div>
          {ranges.map(range => (
            <button key={range} onClick={() => handleDateRangeChange(range)} className={`px-4 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${activeRange === range ? 'bg-[var(--color-brand-primary)] text-white shadow-sm' : 'text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-background)]'}`}>
              {range}
            </button>
          ))}
        </div>

        {/* Live Search Bar with Dropdown */}
        <div className="flex-1 relative" ref={searchRef}>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-brand-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Search by Order No or AWB..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if(searchResults.length > 0) setIsDropdownOpen(true); }}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent shadow-sm placeholder:text-[var(--color-brand-muted)]/70 text-[var(--color-brand-primary)]"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-[var(--color-brand-primary)] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-full mt-2 w-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] shadow-lg z-40 overflow-hidden">
              {searchResults.length === 0 && !isSearching ? (
                <div className="p-4 text-sm text-[var(--color-brand-muted)] text-center">No orders found.</div>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {searchResults.map((result) => (
                    <li 
                      key={result.orderNo} 
                      onClick={() => {
                        setSelectedOrder(result);
                        setIsDropdownOpen(false);
                        setSearchQuery('');
                      }}
                      className="px-4 py-3 hover:bg-[var(--color-brand-background)] cursor-pointer border-b border-[var(--color-brand-border)] last:border-none transition-colors flex justify-between items-center"
                    >
                      <div>
                        {/* ONLY showing the number now */}
                        <div className="font-semibold text-sm text-[var(--color-brand-primary)]">{result.orderNo}</div>
                        <div className="text-xs text-[var(--color-brand-muted)] mt-0.5">AWB: {result.awbNumbers}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm text-[#184B4D]">₹{result.sales.toLocaleString('en-IN')}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${result.status === 'Profitable' ? 'bg-[#4B8B84]/10 text-[#4B8B84]' : result.status === 'Loss' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                          {result.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Export Button */}
        <button type="button" onClick={handleExport} disabled={isExporting} className="flex items-center justify-center px-5 py-2.5 bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] rounded-[var(--radius-xl)] text-sm font-semibold text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-background)] transition-colors shadow-sm disabled:opacity-50">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          {isExporting ? 'Exporting...' : 'Export Report'}
        </button>
      </div>

      {/* Order Details Modal Overlay */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-brand-card)] w-full max-w-lg rounded-2xl shadow-2xl border border-[var(--color-brand-border)] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--color-brand-border)] flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-[var(--color-brand-primary)]">Order Details</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)] transition-colors p-1 rounded-md hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 border-b border-[var(--color-brand-border)] pb-4">
                <div>
                  <p className="text-xs text-[var(--color-brand-muted)] uppercase tracking-wider mb-1">Order Number</p>
                  {/* ONLY showing the number now, no '#' prefix */}
                  <p className="font-semibold text-[var(--color-brand-primary)]">{selectedOrder.orderNo}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-brand-muted)] uppercase tracking-wider mb-1">Sale Date</p>
                  <p className="font-semibold text-[var(--color-brand-primary)]">{selectedOrder.saleDate}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-[var(--color-brand-muted)] uppercase tracking-wider mb-1">Connected AWB(s)</p>
                  <p className="font-mono text-sm bg-[var(--color-brand-background)] px-2 py-1 rounded inline-block text-[var(--color-brand-primary)]">{selectedOrder.awbNumbers}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-brand-muted)]">Gross Sales</span>
                  <span className="font-medium text-[var(--color-brand-primary)]">₹{selectedOrder.sales.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-red-500">
                  <span className="text-sm">Material Cost</span>
                  <span className="font-medium">-₹{selectedOrder.materialCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-red-500 pb-3 border-b border-[var(--color-brand-border)]">
                  <span className="text-sm">Allocated Duty (FedEx)</span>
                  <span className="font-medium">-₹{selectedOrder.dutyCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-[var(--color-brand-primary)]">Direct NPF (Net Profit)</span>
                  <span className={`font-bold text-lg ${selectedOrder.netProfit >= 0 ? 'text-[#184B4D]' : 'text-red-600'}`}>
                    ₹{selectedOrder.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50/50 border-t border-[var(--color-brand-border)] flex justify-end">
              <button onClick={() => setSelectedOrder(null)} className="px-5 py-2 bg-[var(--color-brand-primary)] text-white text-sm font-semibold rounded-lg hover:bg-[#184B4D] shadow-sm transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardFilters() {
  return (
    <Suspense fallback={<div className="w-full h-14 bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] animate-pulse mb-8"></div>}>
      <FiltersContent />
    </Suspense>
  );
}