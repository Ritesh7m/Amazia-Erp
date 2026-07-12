import { NextResponse } from 'next/server';
import { getSyncDates } from '@/lib/dashboard/dashboardQueries'; 

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dates = await getSyncDates();

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return '--';
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '--' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return NextResponse.json({
      success: true,
      data: {
        etsy: formatDate(dates.etsy),
        fedex: formatDate(dates.fedex),
        inventory: 'Live Synced'
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load sync status' }, { status: 500 });
  }
}