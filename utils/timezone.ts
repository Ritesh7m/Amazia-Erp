/**
 * Centralized Timezone and Date Formatting utility.
 * Formats timestamps strictly in Asia/Kolkata (IST) without manual hour arithmetic.
 */

export function formatISTDate(
  dateInput: string | Date | null | undefined,
  fallback: string = 'N/A'
): string {
  if (!dateInput) return fallback;

  try {
    let d: Date;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      let str = String(dateInput).trim();
      if (!str) return fallback;
      // If it's a DuckDB timestamp like "2026-08-21 12:47:18", normalize to ISO
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str)) {
        str = str.replace(' ', 'T') + 'Z';
      } else if (!str.includes('Z') && !str.includes('+') && !str.includes('-')) {
        str = str + 'Z';
      }
      d = new Date(str);
    }

    if (isNaN(d.getTime())) return fallback;

    // Format strictly using Intl with Asia/Kolkata
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const parts = formatter.formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const year = parts.find((p) => p.type === 'year')?.value || '';
    const hour = parts.find((p) => p.type === 'hour')?.value || '';
    const minute = parts.find((p) => p.type === 'minute')?.value || '';
    const dayPeriod = (parts.find((p) => p.type === 'dayPeriod')?.value || '').toUpperCase();

    return `${day} ${month} ${year} • ${hour}:${minute} ${dayPeriod} IST`;
  } catch {
    return fallback;
  }
}
