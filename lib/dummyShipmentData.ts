// lib/dummyShipmentData.ts

// 1. Define the core shipments based on your real FedEx AWBs
export const DUMMY_SHIPMENTS: Record<string, any> = {
  "890000000000": {
    processCode: "P_7104",
    shippingStatus: "SHIPPED",
    customerName: "Alex Smith",
    shippedAt: "2026-04-16T10:30:00.000Z",
  },
  "884000000000": {
    processCode: "P_7124",
    shippingStatus: "IN_TRANSIT",
    customerName: "Gretchen Dziadosz",
    shippedAt: "2026-04-16T14:45:00.000Z",
  },
  "887000000000": {
    processCode: "P_7199",
    shippingStatus: "DELIVERED",
    customerName: "John Doe",
    shippedAt: "2026-04-16T09:15:00.000Z",
  }
};

// 2. Define the consistent many-to-many mapping using your real Etsy Orders
export const AWB_TO_ORDERS_MAP: Record<string, string[]> = {
  "890000000000": ["4105054431", "4103047120"], // 1 AWB -> 2 Orders
  "884000000000": ["4103047120", "4103046186"], // Order 4103047120 is split across two AWBs!
  "887000000000": ["4102942268", "4104705089"], // 1 AWB -> 2 Orders
};

// 3. Generate the reverse mapping automatically (Order -> AWBs)
export const ORDER_TO_AWBS_MAP: Record<string, string[]> = {};
for (const [awb, orders] of Object.entries(AWB_TO_ORDERS_MAP)) {
  for (const order of orders) {
    if (!ORDER_TO_AWBS_MAP[order]) ORDER_TO_AWBS_MAP[order] = [];
    ORDER_TO_AWBS_MAP[order].push(awb);
  }
}