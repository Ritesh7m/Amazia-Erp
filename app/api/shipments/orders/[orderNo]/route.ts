import { NextResponse } from 'next/server';
import { shipmentApi } from '@/services/shipmentApi';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const { orderNo } = await params;

    if (!orderNo) {
      return NextResponse.json(
        { success: false, message: 'Order number is required' },
        { status: 400 }
      );
    }

    const result = await shipmentApi.getAwbsByOrder(orderNo);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || 'Shipment service unavailable' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      data: result.data,
    });
  } catch (error: any) {
    console.error('Error in GET /api/shipments/orders/[orderNo]:', error);
    return NextResponse.json(
      { success: false, message: 'Shipment service unavailable' },
      { status: 500 }
    );
  }
}