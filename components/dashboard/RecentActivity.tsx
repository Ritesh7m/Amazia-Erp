'use client';
import Link from 'next/link';
import { ActivityData } from '@/lib/dashboard/dashboardTypes';

export default function RecentActivity({ data, isLoading }: { data: ActivityData[], isLoading: boolean }) {
  // Simple time ago formatter
  const timeAgo = (dateStr: string) => {
    const diff = (new Date().getTime() - new Date(dateStr).getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const getIcon = (source: string) => {
    if (source.includes('Etsy')) return '🏪';
    if (source.includes('FedEx')) return '🚚';
    return '📦';
  };

  return (
    <div className="bg-[var(--color-brand-card)] p-6 rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-[var(--color-brand-primary)]">Recent Activity</h3>
        <Link href="/dashboard/activity" className="text-sm px-3 py-1.5 border border-[var(--color-brand-border)] rounded-lg hover:bg-[var(--color-brand-background)] transition-colors text-[var(--color-brand-muted)] font-medium">
          View All
        </Link>
      </div>
      
      <div className="flex-1 space-y-6">
        {isLoading ? (
           <div className="text-center text-sm text-[var(--color-brand-muted)] py-4">Loading activity...</div>
        ) : data.length === 0 ? (
           <div className="text-center text-sm text-[var(--color-brand-muted)] py-4">No recent activity.</div>
        ) : (
          data.map((act, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--color-brand-background)] flex items-center justify-center text-lg shadow-sm border border-[var(--color-brand-border)] flex-shrink-0">
                {getIcon(act.source)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-brand-primary)] truncate">
                  {act.source} {act.action}
                </p>
                <p className="text-xs text-[var(--color-brand-muted)] truncate mt-0.5">
                  {act.rowsProcessed > 0 ? `${act.rowsProcessed.toLocaleString()} records processed` : 'System synchronization completed'}
                </p>
              </div>
              <div className="text-xs text-[var(--color-brand-muted)] whitespace-nowrap">
                {timeAgo(act.timestamp)}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-6 pt-4 border-t border-[var(--color-brand-border)]">
        <Link href="/dashboard/activity" className="text-sm text-[var(--color-brand-primary)] hover:underline font-medium flex items-center">
          View all activity logs <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </Link>
      </div>
    </div>
  );
}