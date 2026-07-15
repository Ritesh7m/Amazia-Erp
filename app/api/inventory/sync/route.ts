// app\api\inventory\sync\route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { runInventorySync } from '@/services/inventorySync';

export async function GET(req: Request) {
  try {
    // Basic security to prevent unauthorized triggers
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runInventorySync();
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}