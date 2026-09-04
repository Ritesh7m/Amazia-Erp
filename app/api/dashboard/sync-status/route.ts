import { NextResponse } from 'next/server';
import { OrderFinancialService } from '@/services/financial/order-financial-service';

// Force recompile after database schema update
export async function GET() {
  try {
    const dates = await OrderFinancialService.getSyncStatuses();

    return NextResponse.json({
      success: true,
      data: dates
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load sync status' }, { status: 500 });
  }
}