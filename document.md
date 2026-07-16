# Amazia ERP System Guide

1. `Introduction` -> **`Amazia ERP`** is a centralized data processing system that automates billing imports and inventory synchronization. It validates, normalizes, and stores data from multiple sources into DuckDB, providing a reliable foundation for reporting, reconciliation, and operational analytics.

2. `Core Architecture` -> 
                                AMAZIA ERP
                                    │
              ┌─────────────────────┴────────────────────┐
              │                                          │
              ▼                                          ▼
     Next.js Web Application                  Inventory Scheduler
          npm run dev                          npm run scheduler
              │                                          │
              │                                          │
              ├── Dashboard                              ├── Runs every 6 hours
              ├── Upload Interface                       ├── Reads Google Sheets
              ├── Etsy Import API                        ├── Reads only new rows
              ├── FedEx Import API                       ├── Normalizes order IDs
              ├── Dashboard APIs                         ├── Aggregates quantities
              ├── Search API                             └── Saves data to DuckDB
              ├── Shipment Mapping
              ├── Financial Reporting
              └── DuckDB Reads/Writes
                              │
                              ▼
                           DuckDB
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
      Etsy Sales        FedEx Expenses       Inventory Data
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
                    Order-to-AWB Mapping
                              │
                              ▼
                 Accounting Reconciliation
                              │
                              ▼
        Dashboard, Search, Details, and CSV Reports
    
`Phase 1: Billing Import` -> Imports, validates, normalizes, and stores FedEx or Etsy billing CSV data into DuckDB.

`Phase 2: Inventory Synchronization` -> Synchronizes newly added Google Sheet inventory records into DuckDB using incremental processing.

`Phase 3: Centralized Data Storage` -> Maintains DuckDB as the single source of truth for billing and inventory data.

`Phase 4: Dashboard & Reporting` -> Retrieves processed data from DuckDB to generate fast and reliable dashboards and reports.

`Phase 5: Data Management` -> Provides clean, validated, and centralized data for business analysis and operational reporting.

# Phase 1: Data Ingestion and Synchronization: 
Amazia ERP acts as a central data hub, importing raw information from multiple independent sources. The application standardizes, validates, and stores curated records inside DuckDB.

# Etsy Statements (Sales Data):  

The Etsy Statement Import module processes sales information via CSV upload.
 -> Target Table: etsy_statement
 ->  Relevant Fields: date, type, order_no, net_amt, created_at

# Etsy Processing Rules & Validation:

Accept .csv and .CSV files (case-insensitive extension validation)
Process only required Etsy transaction types (e.g., "Sale").
Extract order numbers from transaction descriptions (e.g., "Payment for Order #4105054431" → 4105054431).
Normalize dates before database insertion and store timestamps consistently.

Example: 
{
  "date": "2026-06-30",
  "type": "Sale",
  "order_no": "4105054431",
  "net_amt": 2810
}

# FedEx Billing (Expense Data): 

The FedEx Billing Import module captures shipping, duty, tax, and transportation expenses.
 -> Target Table: fedex_billing
 -> Relevant Fields: invoice_type, invoice_date, due_date, awb_number, air_waybill_total_amount, book_expense_cost, created_at

`Book Expense Cost Calculation`: Calculated automatically during import and rounded to standard financial precision.
 -> Formula: Book Expense Cost = Amount × 18 / 118

# Inventory Google Sheet

Inventory data is fetched dynamically from the "DB" tab of a configured Google Sheet.

Required Source Columns:

B: Order ID
D: Material Type
E: Category
F: Color
G: Quantity

`Inventory Order Normalization:`-> Google Sheets often contain item-level suffixes (e.g., -1, -2). The dashboard requires order-level data. The system strips the suffix.
Example: 
4104705089-1 becomes 4104705089
4104705089-2 becomes 4104705089 

`Quantity Aggregation:`-> All quantities mapped to the same normalized Order ID are summed together.

Input: 4104705089-1 → 3.1, 4104705089-2 → 3.0

Aggregated Result: {"4104705089": 6.1}

Material Cost Calculation: The current hardcoded material-cost rate is 1 Quantity = ₹250.

Formula: Material Cost = Total Quantity × ₹250
(Example: 6.1 × 250 = ₹1,525)

# Order-to-AWB Mapping

Supported Mapping Relationships: The system must safely handle all three scenarios:

1. One Order → One AWB

2. One Order → Multiple AWBs

3. One AWB → Multiple Orders

Example API Payload (GET /api/shipments/orders/4074621797):

{
  "data": {
    "orderNo": "4074621797",
    "awbNumbers": [
      "873549431322"
    ],
    "shipments": [
      {
        "awbNumber": "873549431322",
        "processCode": "P_7104",
        "shippingStatus": "SHIPPED",
        "customerName": "Gretchen Dziadosz",
        "shippedAt": "2026-06-25T17:34:33.147Z",
        "orders": [
          "4074621797"
        ]
      }
    ]
  }
}

# Phase 2: Accounting and Reconciliation Engine:
All dashboard calculations and financial aggregations are performed on the Next.js backend in **lib/dashboard/dashboardQueries.ts**, and the frontend simply displays the processed results from DuckDB.

`Material Cost Reconciliation`-> **Formula: Material Cost = Total Quantity × ₹250**

`FedEx Shipping Cost Allocation` -> **Formula: Allocated Shipping Cost = Total AWB Cost ÷ Number of Mapped Orders**

    Example: AWB 873549431322 (Cost: ₹600) maps to three distinct orders (4104705089, 4104705090, 4104705091).
    Result: The cost is divided equally among the orders (₹600 / 3 = ₹200 per order).   

`One Order with Multiple AWBs`->  **Formula: Order FedEx Cost = Σ (AWB Cost ÷ Number of Orders Mapped to that AWB)**

`Net Profit & Profit Margin Calculation`-> **Net Profit = Gross Sales − Material Cost − Duty Cost − Transport Cost**
                                           **Profit Margin Formula: Profit Margin (%) = (Net Profit ÷ Gross Sales) × 100**

# Phase 3: Dashboard Interface:

`**Dashboard Metrics**`-> The dashboard displays high-level key performance indicators (KPIs) calculated by the backend:

1. Total Sales: SUM(Etsy Net Sales)

2. Total Material Cost: SUM(Order Material Costs)

3. Total FedEx Cost: Total Allocated Duty Cost + Total Allocated Transportation Cost

4. Total Expenses: Material Cost + Duty Cost + Transportation Cost

5. Gross Profit (Direct NPF): Total Sales - Total Expenses

6. Profit Margin: (Gross Profit / Total Sales) × 100

`**Visualizations**`--> The activity graph plots financial performance over time, displaying Sales, Expenses, and Net Profit.
Default Period: Last 12 months (configurable via config.json).

`**Dynamic Date Filtering**`-> The dashboard supports robust, URL-driven preset date filters (e.g., 7D, 30D, 3M, 6M, 12M, FY, Custom).

# Phase 4: Search and Order Investigation: 

// GET /api/dashboard/search?q={query} 

1. `Live Search `-> The dashboard provides a debounced search that allows users to quickly find records using either an Etsy Order Number or a FedEx AWB Number, returning related order and shipment information.

2. `Search Results`-> Matching records are displayed in an interactive dropdown with loading states, keyboard navigation, and click-outside support for a smooth user experience.

3. `Order Details` -> Selecting a search result opens a detailed view showing financial metrics, shipment information, and order details, while safely handling missing or invalid data.

# Phase 5: Financial Report Export

`Export Workflow` -> Frontend reads the active date bounds from the URL (e.g., from=2026-06-01 and to=2026-06-30).

# Scheduler Configuration & Frequency

The scheduler runs every six hours based on the Asia/Kolkata timezone.
Cron Expression: 0 */6 * * *. Execution Times (IST): 12:00 AM, 6:00 AM, 12:00 PM, 6:00 PM.




