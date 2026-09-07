Replace the two toggle buttons above the Recent Orders/Orders section with a proper tab-based navigation.

CURRENT UI:
- "Zero-Sales Orders (Other Stores)" toggle
- "Show Refunded Only" toggle

REMOVE BOTH TOGGLE BUTTONS COMPLETELY.

IMPLEMENT:
Create three tabs positioned on the LEFT side of the Orders section:

1. Orders
2. Zero Sales Orders
3. Refund Orders

TAB BEHAVIOR:

1. Orders
- Show normal/active orders with verified sales revenue.
- Exclude zero-sales orders from other stores.
- Exclude refunded orders from this default view according to the existing refund classification logic.
- Keep the existing order table columns and calculations.

2. Zero Sales Orders
- Show orders where verified Etsy sales revenue is ₹0.
- Include orders coming from other sources/stores as currently identified by the system.
- Do not treat missing FedEx/AWB data as a reason to classify an order as zero-sales.
- Zero sales must be determined from the actual sales data.

3. Refund Orders
- Show fully refunded orders.
- Show partially refunded orders.
- Preserve the existing refund classification and refund value calculation.
- The table must clearly indicate whether an order is Fully Refunded or Partially Refunded.

UI REQUIREMENTS:
- Tabs should be visually positioned on the LEFT side of the Orders card/header.
- Only one tab can be active at a time.
- Active tab should use the existing Amazia ERP design language.
- Do not introduce a new visual style.
- Remove the old toggle controls completely.
- Keep the existing "1063 total orders" count, but make it dynamically reflect the currently selected tab.
- The selected tab must remain visually obvious.

IMPORTANT:
Do NOT create three separate pages.
This should be one Orders component with a tab/filter state.

DATA/FILTER LOGIC:
Implement the filtering at the appropriate data/query/service layer rather than only hiding rows in the frontend.

The tab state should map to something like:

orders
zero_sales
refunds

Make sure switching tabs correctly requests/filters the corresponding dataset.

KEEP WORKING:
- Search by Order Number
- Search by AWB Number
- Date range filters
- 7D / 30D / 3M / 6M / 12M / FY
- Pagination
- Order details modal
- Sales
- FedEx Cost
- Material Cost
- Listing Expense
- Total Expense
- Direct NPF
- Margin
- Country
- AWB mapping

Do not change any existing accounting/calculation logic.

REFUND VIEW:
For Refund Orders, make sure both:
- Fully refunded orders
- Partially refunded orders

are included.

The refund value and margin must continue to come from the existing accounting engine and must not be recalculated differently just for the tab.

ZERO SALES VIEW:
Do not confuse:
- ₹0 sales
with
- missing Etsy data
with
- missing FedEx data
with
- an order that has not yet been processed.

Use the existing verified sales/revenue definition.

RESPONSIVE UI:
The tabs should remain usable on desktop and smaller screens. If necessary, allow horizontal scrolling rather than breaking the Orders layout.

FINAL RESULT:

Instead of:

[ Zero-Sales Orders toggle ]    [ Show Refunded Only toggle ]

show:

[ Orders ] [ Zero Sales Orders ] [ Refund Orders ]

with the active tab highlighted.

After implementation, test all three tabs with real database records and verify:
- correct order counts
- no duplicate orders
- correct refund classification
- correct zero-sales classification
- search still works
- date filters still work
- order details still work
- accounting values remain unchanged.