'use client';
import { useState } from 'react';

export default function DashboardHeader() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 mb-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-brand-primary)] tracking-tight">Dashboard</h1>
        <p className="text-[var(--color-brand-muted)] text-sm mt-1">Overview of your business performance</p>
      </div>
      <div className="flex items-center gap-4 mt-4 md:mt-0 text-sm">
        <span className="text-[var(--color-brand-muted)]">Last updated: --</span>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-full hover:bg-[var(--color-brand-card)] transition-colors disabled:opacity-50 border border-transparent hover:border-[var(--color-brand-border)]"
          title="Refresh Dashboard"
        >
          <svg className={`w-5 h-5 text-[var(--color-brand-primary)] ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="w-px h-6 bg-[var(--color-brand-border)] mx-1"></div>
        <button className="p-2 rounded-full hover:bg-[var(--color-brand-card)] transition-colors border border-transparent hover:border-[var(--color-brand-border)]">
          <svg className="w-5 h-5 text-[var(--color-brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
        <div className="w-9 h-9 rounded-[var(--radius-xl)] bg-[var(--color-brand-primary)] text-white flex items-center justify-center font-semibold shadow-sm">
          A
        </div>
      </div>
    </header>
  );
}