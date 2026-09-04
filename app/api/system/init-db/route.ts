import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initializeDatabase();
    return NextResponse.json({ success: true, message: 'Database schemas and views initialized/refreshed successfully.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Failed to initialize database.' }, { status: 500 });
  }
}
