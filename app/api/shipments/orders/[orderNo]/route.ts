import { NextResponse } from 'next/server';
import { DUMMY_SHIPMENTS, ORDER_TO_AWBS_MAP, AWB_TO_ORDERS_MAP } from '@/lib/dummyShipmentData';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> } 
) {
  
  const { orderNo } = await params; 
  
  const awbNumbers = ORDER_TO_AWBS_MAP[orderNo] || [];

  const shipments = awbNumbers.map(awb => {
    const details = DUMMY_SHIPMENTS[awb];
    return {
      awbNumber: awb,
      processCode: details.processCode,
      shippingStatus: details.shippingStatus,
      customerName: details.customerName,
      shippedAt: details.shippedAt,
      orders: AWB_TO_ORDERS_MAP[awb] 
    };
  });

  return NextResponse.json({
    data: {
      orderNo: orderNo,
      awbNumbers: awbNumbers,
      shipments: shipments
    }
  });
}