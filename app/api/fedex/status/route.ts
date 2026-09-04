export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getFedExDiagnostics } from '@/services/fedexMappingService';
import { HTTP_STATUS } from '@/constants';

export async function GET() {
  try {
    const diagnostics = await getFedExDiagnostics();
    return NextResponse.json({
      success: true,
      diagnostics
    }, { status: HTTP_STATUS.OK });
  } catch (error: any) {
    console.error('[FedEx Status API] Error fetching diagnostics:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'An unexpected server error occurred.' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
