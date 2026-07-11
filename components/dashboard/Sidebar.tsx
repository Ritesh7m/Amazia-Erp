'use client';
import { useState } from 'react';
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
          <div className="w-8 h-8 rounded bg-[var(--color-brand-gold)] flex-shrink-0"></div>
          {!isCollapsed && <span className="ml-3 font-bold text-xl text-[var(--color-brand-primary)] tracking-tight">AMAZIA ERP</span>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          <Link href="/dashboard" className={`flex items-center px-4 py-3 rounded-[var(--radius-xl)] transition-colors ${isActive('/dashboard') && !isActive('/dashboard/upload') ? 'bg-[var(--color-brand-primary)] text-white' : 'text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-background)]'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            {!isCollapsed && <span className="ml-3 font-medium">Dashboard</span>}
          </Link>

          <div className="space-y-1">
            <button onClick={() => setIsUploadOpen(!isUploadOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius-xl)] text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-background)] transition-colors">
              <div className="flex items-center">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                {!isCollapsed && <span className="ml-3 font-medium">Upload</span>}
              </div>
              {!isCollapsed && (
                <svg className={`w-4 h-4 transition-transform ${isUploadOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              )}
            </button>
            
            {!isCollapsed && isUploadOpen && (
              <div className="pl-12 pr-4 py-2 space-y-3">
                <Link href="/dashboard/upload/etsy" className="block text-sm text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)]">Etsy Statement Upload</Link>
                <Link href="/dashboard/upload/fedex" className="block text-sm text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)]">FedEx Billing Upload</Link>
              </div>
            )}
          </div>

          <Link href="/inventory" className="flex items-center px-4 py-3 rounded-[var(--radius-xl)] text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-background)] transition-colors">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            {!isCollapsed && <span className="ml-3 font-medium">Inventory</span>}
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
                <div className="text-xs text-[var(--color-brand-muted)] mt-0.5">--</div>
              </div>
              <div>
                <div className="text-sm font-medium flex items-center gap-2 text-[var(--color-brand-primary)]">FedEx Billing</div>
                <div className="text-xs text-[var(--color-brand-muted)] mt-0.5">--</div>
              </div>
              <div>
                <div className="text-sm font-medium flex items-center gap-2 text-[var(--color-brand-primary)]">Inventory Sheet</div>
                <div className="text-xs text-[var(--color-brand-muted)] mt-0.5">--</div>
              </div>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-4 border-t border-[var(--color-brand-border)] flex items-center text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-background)] transition-colors"
        >
          <svg className={`w-5 h-5 flex-shrink-0 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          {!isCollapsed && <span className="ml-3 font-medium">Collapse</span>}
        </button>
      </aside>
    </>
  );
}