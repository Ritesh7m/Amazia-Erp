import { NextResponse } from 'next/server';
import { DUMMY_SHIPMENTS, AWB_TO_ORDERS_MAP } from '@/lib/dummyShipmentData';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ awbNumber: string }> } 
) {

  const { awbNumber } = await params;
  
  const orders = AWB_TO_ORDERS_MAP[awbNumber] || [];
  const details = DUMMY_SHIPMENTS[awbNumber];

  let shipments = [];
  
  if (details) {
    shipments.push({
      processCode: details.processCode,
      shippingStatus: details.shippingStatus,
      customerName: details.customerName,
      shippedAt: details.shippedAt,
      orders: orders
    });
  }

  return NextResponse.json({
    data: {
      awbNumber: awbNumber,
      orders: orders,
      shipments: shipments
    }
  });
}