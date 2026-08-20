/**
 * Formats a given date string into a consistent dashboard display format.
 * Example: Aug 19, 2026 • 11:20 AM
 */
export const formatDashboardDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Not synced yet';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Not synced yet';

  const dateOpts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' };
  const timeOpts: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true };

  const datePart = new Intl.DateTimeFormat('en-US', dateOpts).format(d);
  const timePart = new Intl.DateTimeFormat('en-US', timeOpts).format(d);

  return `${datePart} • ${timePart} IST`;
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
