import { NextRequest, NextResponse } from 'next/server';
import { TrackingLookupService } from '@/services/trackingLookupService';
import { fetchQuery } from '@/database';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    console.log('[API /api/tracking/sync] Triggering tracking lookup sync...');
    const result = await TrackingLookupService.runSync();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          errors: result.errors,
          stats: result
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error: any) {
    console.error('[API /api/tracking/sync] Unhandled error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Internal server error during tracking lookup sync'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const [syncMeta, trackingMappingsCount, clubbedAllocationsCount] = await Promise.all([
      fetchQuery<any>(`
        SELECT * FROM sync_metadata 
        WHERE sync_name = 'tracking_lookup';
      `),
      fetchQuery<any>(`
        SELECT COUNT(*) AS total 
        FROM order_awb_mapping 
        WHERE source = 'Tracking API';
      `),
      fetchQuery<any>(`
        SELECT COUNT(*) AS total 
        FROM order_clubbed_allocations;
      `)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        syncMetadata: syncMeta[0] || null,
        totalTrackingApiMappings: Number(trackingMappingsCount[0]?.total || 0),
        totalClubbedAllocations: Number(clubbedAllocationsCount[0]?.total || 0)
      }
    });
  } catch (error: any) {
    console.error('[API /api/tracking/sync] Error in GET:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}
