import { NextResponse } from 'next/server';
import { shipmentApi } from '@/services/shipmentApi';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ awbNumber: string }> }
) {
  try {
    const { awbNumber } = await params;

    if (!awbNumber) {
      return NextResponse.json(
        { success: false, message: 'AWB number is required' },
        { status: 400 }
      );
    }

    const result = await shipmentApi.getOrdersByAwb(awbNumber);

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
    console.error('Error in GET /api/shipments/awb/[awbNumber]:', error);
    return NextResponse.json(
      { success: false, message: 'Shipment service unavailable' },
      { status: 500 }
    );
  }
}