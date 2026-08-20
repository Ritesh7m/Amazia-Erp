import { NextResponse } from 'next/server';
import { fetchQuery } from '@/database';

export async function GET() {
  try {
    const result = await fetchQuery("SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory_table'");
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
