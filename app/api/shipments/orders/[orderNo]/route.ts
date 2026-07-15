import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderNo: string } }
) {
  const orderNo = params.orderNo;

  // Dummy response structure
  return NextResponse.json({
    data: {
      orderNo: orderNo,
      awbNumbers: ["873549431322"],
      shipments: [
        {
          awbNumber: "873549431322",
          processCode: "P_7104",
          shippingStatus: "SHIPPED",
          customerName: "Gretchen Dziadosz",
          shippedAt: "2026-06-25T17:34:33.147Z",
          orders: [orderNo]
        }
      ]
    }
  });
}