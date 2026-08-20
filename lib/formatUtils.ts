/**
 * Formats a given date string into a consistent dashboard display format.
 * Example: Aug 19, 2026 • 11:20 AM
 */
export const formatDashboardDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Not synced yet';
  // If dateStr lacks timezone, append Z to ensure UTC interpretation
  const safeDateStr = (!dateStr.includes('Z') && !dateStr.includes('+')) ? dateStr + 'Z' : dateStr;
  const d = new Date(safeDateStr);
  if (isNaN(d.getTime())) return 'Not synced yet';

  let formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);

  // en-IN usually formats as "20 Aug 2026, 5:22 pm"
  // Normalize to "20 Aug 2026 • 05:22 PM IST"
  formatted = formatted.replace(',', ' •').toUpperCase();
  
  if (!formatted.includes('IST')) {
    formatted += ' IST';
  }

  return formatted;
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
