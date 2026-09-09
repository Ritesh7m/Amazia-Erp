import { NextRequest, NextResponse } from 'next/server';
import { ShopifySyncService } from '@/services/shopifySync';
import { fetchQuery } from '@/database';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    console.log('[API /api/shopify/sync] Triggering manual Shopify sales sync...');
    const result = await ShopifySyncService.runSync();
    
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          error: result.error,
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
    console.error('[API /api/shopify/sync] Unhandled error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Internal server error during Shopify sync'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const [latestImport, syncMeta] = await Promise.all([
      fetchQuery<any>(`
        SELECT * FROM shopify_imports 
        ORDER BY started_at DESC 
        LIMIT 5;
      `),
      fetchQuery<any>(`
        SELECT * FROM sync_metadata 
        WHERE sync_name = 'shopify_sales';
      `)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        syncMetadata: syncMeta[0] || null,
        recentImports: latestImport || []
      }
    });
  } catch (error: any) {
    console.error('[API /api/shopify/sync] Failed to fetch sync status:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Unable to retrieve Shopify sync status'
      },
      { status: 500 }
    );
  }
}
