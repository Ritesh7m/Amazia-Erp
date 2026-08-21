export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { syncMappings } from '@/services/fedexMappingService';
import { HTTP_STATUS } from '@/constants';

export async function POST() {
  try {
    const result = await syncMappings();
    
    if (!result.success) {
      return NextResponse.json(
        result,
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }
    
    return NextResponse.json(result, { status: HTTP_STATUS.OK });
  } catch (error: any) {
    console.error('[FedEx API] Unhandled error during mapping sync:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected server error occurred.' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
