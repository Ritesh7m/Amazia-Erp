import { NextResponse } from 'next/server';
import { fetchQuery } from '@/database';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    const result = await fetchQuery(query);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
