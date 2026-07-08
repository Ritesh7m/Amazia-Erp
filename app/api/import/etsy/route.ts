export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { processEtsyImport } from '@/services/etsyImporter';
import { HTTP_STATUS } from '@/constants';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file uploaded.' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Strict validation: Accept only .csv (case insensitive)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Only CSV files are allowed.' },
        { status: HTTP_STATUS.UNPROCESSABLE_ENTITY }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const result = await processEtsyImport(buffer, file.name, file.size);

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    console.error('[Etsy API] Unhandled error:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected server error occurred.' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}