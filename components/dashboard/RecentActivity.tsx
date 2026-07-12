'use client';
import { FileText, Upload, RefreshCw, Package } from 'lucide-react';

interface RecentActivityProps {
  data: any[]; // Using any to flexibly catch your real database structure
  isLoading: boolean;
}

export default function RecentActivity({ data, isLoading }: RecentActivityProps) {
  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'upload': return <Upload className="w-4 h-4 text-[var(--color-brand-primary)]" />;
      case 'sync': return <RefreshCw className="w-4 h-4 text-blue-600" />;
      case 'order': return <Package className="w-4 h-4 text-orange-600" />;
      default: return <FileText className="w-4 h-4 text-[var(--color-brand-muted)]" />;
    }
  };

  // Helper to format that ugly ISO string into a nice readable date!
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr; // Fallback if it's not a real date
    
    // Returns format: "Jul 11, 06:13 PM"
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-[var(--color-brand-card)] rounded-[var(--radius-xl)] border border-[var(--color-brand-border)] shadow-sm p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[16px] font-bold text-[var(--color-brand-primary)]">Recent Activity</h3>
        <button className="text-sm font-medium text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary)] transition-colors px-3 py-1 rounded-lg border border-transparent hover:border-[var(--color-brand-border)] hover:bg-[var(--color-brand-background)]">
          View All
        </button>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-[var(--color-brand-muted)]">Loading activity...</div>
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-[var(--color-brand-muted)]">No recent activity.</div>
        ) : (
          <div className="space-y-6">
            {data.map((activity, index) => {
              // Fallbacks in case your API uses different column names
              const title = activity.title || activity.action || activity.event || 'System Activity';
              const description = activity.description || activity.details || activity.message || '';
              const timeString = activity.timestamp || activity.created_at || activity.date;
              
              return (
                <div key={activity.id || index} className="flex gap-4 group">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-brand-background)] border border-[var(--color-brand-border)] flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      {getIcon(activity.type)}
                    </div>
                    {index !== data.length - 1 && (
                      <div className="absolute top-10 bottom-[-24px] left-1/2 -translate-x-1/2 w-px bg-[var(--color-brand-border)]"></div>
                    )}
                  </div>
                  <div className="pt-2 flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-brand-primary)] truncate">{title}</p>
                    {description && (
                      <p className="text-[13px] text-[var(--color-brand-muted)] mt-0.5 truncate">{description}</p>
                    )}
                  </div>
                  <div className="pt-2 whitespace-nowrap">
                    <span className="text-xs font-medium text-[var(--color-brand-muted)]">{formatTime(timeString)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--color-brand-border)]">
        <button className="text-sm font-semibold text-[var(--color-brand-primary)] hover:text-opacity-80 flex items-center transition-colors">
          View all activity logs
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      </div>
    </div>
  );
}