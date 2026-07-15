'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isMobileOpen: boolean;
  closeMobile: () => void;
}

export default function Sidebar({ isMobileOpen, closeMobile }: SidebarProps) {
  const pathname = usePathname();
  const [isUploadOpen, setIsUploadOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // 1. Add the state to hold our dynamic dates
  const [syncDates, setSyncDates] = useState({ etsy: '--', fedex: '--', inventory: '--' });

  // 2. Fetch the dates when the sidebar loads
  useEffect(() => {
    fetch('/api/dashboard/sync-status')
      .then(res => res.json())
      .then(data => {
        if (data.success) setSyncDates(data.data);
      })
      .catch(() => {});
  }, []);

  const isActive = (path: string) => pathname === path || pathname?.startsWith(`${path}/`);

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={closeMobile} />
      )}
      
      <aside className={`fixed top-0 left-0 h-screen bg-[var(--color-brand-card)] border-r border-[var(--color-brand-border)] z-50 transition-all duration-300 flex flex-col ${isCollapsed ? 'w-20' : 'w-72'} ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
     {/* Logo Section */}
<div className="h-20 flex items-center px-6 border-b border-[var(--color-brand-border)]">

  {/* Amazia Shipping Logo */}
  <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-gold)] flex items-center justify-center flex-shrink-0">

    <svg
      className="w-6 h-6 text-[var(--color-brand-primary)]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16V8z"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3.27 6.96L12 12l8.73-5.04"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 22V12"
      />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M7.5 4.27L16.5 9.5"
      />
    </svg>

  </div>

  {!isCollapsed && (
    <span className="ml-3 font-bold text-xl text-[var(--color-brand-primary)] tracking-tight">
      AMAZIA ERP
    </span>
  )}

</div>

       {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          <Link href="/dashboard" className={`flex items-center px-4 py-3 rounded-[var(--radius-xl)] transition-colors ${isActive('/dashboard') && !isActive('/dashboard/upload') && !isActive('/dashboard/orders') ? 'bg-[var(--color-brand-primary)] text-white' : 'text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-background)]'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            {!isCollapsed && <span className="ml-3 font-medium">Dashboard</span>}
          </Link>

          <Link href="/dashboard/upload" className={`flex items-center px-4 py-3 rounded-[var(--radius-xl)] transition-colors ${isActive('/dashboard/upload') ? 'bg-[var(--color-brand-primary)] text-white' : 'text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-background)]'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            {!isCollapsed && <span className="ml-3 font-medium">Upload</span>}
          </Link>
       
        </nav>

        {/* Sync Status - Bottom */}
        {!isCollapsed && (
          <div className="p-4 mx-4 mb-4 bg-[var(--color-brand-background)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)]">
            <h3 className="text-xs font-semibold text-[var(--color-brand-muted)] uppercase tracking-wider mb-3">Last Sync Status</h3>
            <div className="flex items-center text-sm text-[var(--color-brand-primary)] font-medium mb-4">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
              All data synchronized
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium flex items-center gap-2 text-[var(--color-brand-primary)]">Etsy Statement</div>
                {/* 3. Insert the dynamic Etsy date here */}
                <div className="text-xs text-[var(--color-brand-muted)] mt-0.5">{syncDates.etsy}</div>
              </div>
              <div>
                <div className="text-sm font-medium flex items-center gap-2 text-[var(--color-brand-primary)]">FedEx Billing</div>
                {/* 3. Insert the dynamic FedEx date here */}
                <div className="text-xs text-[var(--color-brand-muted)] mt-0.5">{syncDates.fedex}</div>
              </div>
              <div>
                <div className="text-sm font-medium flex items-center gap-2 text-[var(--color-brand-primary)]">Inventory Sheet</div>
                {/* 3. Insert the dynamic Inventory date here */}
                <div className="text-xs text-[var(--color-brand-muted)] mt-0.5">{syncDates.inventory}</div>
              </div>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        {/* <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-4 border-t border-[var(--color-brand-border)] flex items-center text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-background)] transition-colors"
        >
          <svg className={`w-5 h-5 flex-shrink-0 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          {!isCollapsed && <span className="ml-3 font-medium">Collapse</span>}
        </button> */}
      </aside>
    </>
  );
}