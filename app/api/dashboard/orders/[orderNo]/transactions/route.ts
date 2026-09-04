import { NextRequest, NextResponse } from 'next/server';
import { OrderFinancialService } from '@/services/financial/order-financial-service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest, 
  context: { params: Promise<{ orderNo: string }> | { orderNo: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(context?.params);
    const orderNo = resolvedParams?.orderNo;

    if (!orderNo) {
      return NextResponse.json({ success: false, message: 'Order number is required' }, { status: 400 });
    }

    const details = await OrderFinancialService.getOrderDetails(orderNo);

    if (!details) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      summary: details.summary,
      inventory: details.inventory,
      fedexDetails: details.fedexDetails,
      transactions: details.transactions
    });
  } catch (error: any) {
    console.error('[Order Details API] Error:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Unable to load order details.' }, { status: 500 });
  }
}
