'use client';
import { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-brand-background)] flex">
      {/* Fixed Sidebar */}
      <Sidebar isMobileOpen={isMobileMenuOpen} closeMobile={() => setIsMobileMenuOpen(false)} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-72 transition-all duration-300">
        
        {/* Mobile Header Toggle */}
        <div className="md:hidden flex items-center p-4 bg-[var(--color-brand-card)] border-b border-[var(--color-brand-border)] sticky top-0 z-30">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-background)] rounded-[var(--radius-xl)] transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="ml-2 font-bold text-lg text-[var(--color-brand-primary)] tracking-tight">AMAZIA ERP</span>
        </div>

        <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto">
          <DashboardHeader />
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}