import { formatISTDate } from '@/utils/timezone';

export { formatISTDate };

/**
 * Formats a given date string into a consistent dashboard display format.
 * Example: 21 Aug 2026 • 06:17 PM IST
 */
export const formatDashboardDate = (dateStr: string | null | undefined): string => {
  return formatISTDate(dateStr, 'Not synced yet');
};

/**
 * Formats Indian Currency with compact notation for chart axes.
 * e.g., ₹10K, ₹1.5L, ₹1Cr
 */
export const formatIndianCurrencyCompact = (val: number): string => {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(1)}Cr`;
  } else if (val >= 100000) {
    return `₹${(val / 100000).toFixed(1)}L`;
  } else if (val >= 1000) {
    return `₹${(val / 1000).toFixed(0)}K`;
  }
  return `₹${val}`;
};

/**
 * Standard formatting for tooltips (e.g., ₹12,34,567)
 */
export const formatCurrency = (val: number): string => {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(val)}`;
};
