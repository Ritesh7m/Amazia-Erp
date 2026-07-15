# Amazia ERP

Amazia ERP is a billing, expense, inventory, financial reconciliation, and business analytics platform built using Next.js, TypeScript, Tailwind CSS, and DuckDB.

The application imports Etsy sales statements and FedEx billing CSV files, synchronizes inventory information from Google Sheets, maps Etsy order numbers to FedEx Air Waybill (AWB) numbers, calculates order-level expenses and profitability, and displays business insights through a clean analytical dashboard.

The system is designed so that the dashboard reads only from DuckDB. External sources such as Google Sheets are processed independently through a scheduled synchronization worker and are not queried when the dashboard loads.

---

# Project Overview

Amazia ERP currently contains the following modules:

1. Business Analytics Dashboard
2. Etsy Statement Import
3. FedEx Billing Import
4. Google Sheets Inventory Synchronization
5. Order-to-AWB Shipment Mapping
6. Accounting and Reconciliation Engine
7. DuckDB Data Storage
8. Background Inventory Scheduler
9. Order and AWB Search
10. Order-Level Financial Analysis
11. Date Filtering
12. Financial CSV Report Export

---

# Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router |
| Backend | Next.js Route Handlers |
| Language | TypeScript |
| UI | React |
| Styling | Tailwind CSS |
| Database | DuckDB |
| CSV Parsing | `csv-parser` |
| File Upload | `FormData` and Fetch API |
| Inventory Source | Google Sheets |
| Scheduler | `node-cron` |
| Scheduler Runtime | `tsx` |
| Charts | Project chart library |
| Icons | Lucide React |

---

# Core Architecture

```text
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
```

---

# End-to-End Application Workflow

The application is divided into five major phases:

```text
Phase 1
Data Ingestion and Synchronization
                │
                ▼
Phase 2
Accounting and Reconciliation Engine
                │
                ▼
Phase 3
Dashboard and Business Analytics
                │
                ▼
Phase 4
Search and Order Investigation
                │
                ▼
Phase 5
Financial Report Export
```

---

# Phase 1: Data Ingestion and Synchronization

Amazia ERP acts as a central data hub.

The application imports raw information from multiple independent sources, standardizes the data, validates it, and stores curated records inside DuckDB.

The main data sources are:

```text
Etsy Statements

FedEx Billing Files

Google Sheets Inventory

Shipment Order-to-AWB Mapping
```

---

## 1. Etsy Statements

The Etsy Statement Import module provides sales information.

The importer captures:

- Sale date
- Transaction type
- Order number
- Net sales amount

The processed records are stored in:

```text
etsy_statement
```

Relevant fields:

```text
date

type

order_no

net_amt

created_at
```

Example source transaction:

```text
June 30, 2026

Sale

Payment for Order #4105054431

INR

₹2,810
```

Stored result:

```json
{
  "date": "2026-06-30",
  "type": "Sale",
  "order_no": "4105054431",
  "net_amt": 2810
}
```

---

## Etsy Processing Rules

- Accept `.csv` files.
- Accept `.CSV` files.
- File-extension validation is case-insensitive.
- Handle UTF-8 BOM characters.
- Match CSV headers case-insensitively.
- Trim whitespace from headers.
- Trim whitespace from values.
- Process only required Etsy transaction types.
- Extract order numbers from transaction descriptions.
- Remove currency symbols.
- Remove thousands separators.
- Convert valid monetary values into numbers.
- Normalize dates before database insertion.
- Validate all required values.
- Store timestamps consistently.
- Return useful validation errors.
- Display success and error feedback using toast notifications.

---

## 2. FedEx Billing

The FedEx Billing Import module provides shipping, duty, tax, and transportation expense information.

The importer captures:

- Invoice type
- Invoice date
- Due date
- AWB number
- Air Waybill total amount
- Book expense cost

The processed records are stored in:

```text
fedex_billing
```

Relevant fields:

```text
invoice_type

invoice_date

due_date

awb_number

air_waybill_total_amount

book_expense_cost

created_at
```

---

## Required FedEx CSV Fields

| Database Field | FedEx CSV Header |
|---|---|
| `invoice_type` | Invoice Type |
| `invoice_date` | Invoice Date |
| `due_date` | Due Date |
| `awb_number` | Air Waybill Number |
| `air_waybill_total_amount` | Air Waybill Total Amount |
| `book_expense_cost` | Calculated by the application |
| `created_at` | Import timestamp |

---

## Book Expense Cost

The application calculates Book Expense Cost using:

```text
Book Expense Cost =

Amount

-

((Amount / 118) × 100)
```

Equivalent formula:

```text
Book Expense Cost =

Amount × 18 / 118
```

The result is rounded according to the application's financial precision rules.

---

## FedEx Validation Rules

- Accept `.csv` files.
- Accept `.CSV` files.
- Perform case-insensitive extension validation.
- Validate all required FedEx headers.
- Ignore unused CSV columns.
- Preserve AWB numbers as text.
- Never convert AWB numbers into floating-point values.
- Prevent scientific notation.
- Preserve every AWB digit.
- Normalize supported date formats.
- Remove currency symbols.
- Remove thousands separators.
- Convert valid monetary values into numbers.
- Return row-level validation errors.

---

## AWB Business Rules

An AWB is a business identifier and must always be stored as text.

Do not store AWB values using:

```text
FLOAT

DOUBLE

REAL
```

Do not convert AWB values using:

```ts
Number(awbNumber);
```

Do not use:

```ts
parseFloat(awbNumber);
```

Multiple shipment records may use the same AWB number.

Therefore:

- AWB is not a unique database field.
- Do not reject a record only because its AWB already exists.
- Do not use AWB alone as a duplicate key.
- Do not add a unique constraint to `awb_number`.

---

## 3. Inventory Google Sheet

Inventory information is read from the `DB` tab of the configured Google Sheet.

Required source columns:

| Google Sheet Column | Field |
|---|---|
| B | Order ID |
| D | Material Type |
| E | Category |
| F | Color |
| G | Quantity |

The scheduler reads inventory information and stores normalized order-level data in DuckDB.

---

## Inventory Order Normalization

Google Sheets may contain item-level order numbers:

```text
4104705089-1

4104705089-2

4104705089-3
```

The suffix after `-` represents item-level information.

The dashboard requires order-level information.

Therefore:

```text
4104705089-1

becomes

4104705089
```

```text
4104705089-2

becomes

4104705089
```

```text
4104705089-3

becomes

4104705089
```

The database stores:

```text
4104705089
```

---

## Quantity Aggregation

Example input:

```text
4104705089-1 → 3.1

4104705089-2 → 3.0

4104705088 → 4.0
```

Aggregated result:

```json
{
  "4104705089": 6.1,
  "4104705088": 4
}
```

The inventory database contains order-level information rather than item-level information.

---

## Material Cost

The current material-cost rate is:

```text
1 Quantity = ₹250
```

Formula:

```text
Material Cost =

Total Quantity

×

₹250
```

Example:

```text
Total Quantity:

6.1
```

```text
Material Cost:

6.1 × ₹250

=

₹1,525
```

---

## 4. The Bridge: Order-to-AWB Mapping

Etsy contains:

```text
Order Number
```

FedEx contains:

```text
AWB Number
```

The application requires a relationship between the two identifiers.

The Order-to-AWB mapping layer acts as the bridge:

```text
Etsy Order

↓

Order-to-AWB Mapping

↓

FedEx AWB

↓

FedEx Billing Cost
```

The current development implementation may use dummy shipment APIs and local mapping information.

The mapping layer is isolated so it can later be connected to a production shipment service without rewriting dashboard components.

---

## Shipment API

Example endpoint:

```http
GET /api/shipments/orders/4074621797
```

Example response:

```json
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
```

---

## Supported Mapping Relationships

The mapping system supports:

```text
One Order

→

One AWB
```

```text
One Order

→

Multiple AWBs
```

```text
One AWB

→

Multiple Orders
```

The application must correctly handle all three relationships.

---

# Phase 2: Accounting Engine

Dashboard calculations are performed on the Next.js backend.

Primary query logic:

```text
lib/dashboard/dashboardQueries.ts
```

The backend reconciles:

```text
Etsy Sales

+

Inventory Usage

+

Order-to-AWB Mapping

+

FedEx Billing
```

The frontend receives processed financial results rather than calculating accounting values from raw records.

---

## Material Cost Reconciliation

The accounting engine matches Etsy orders with normalized inventory orders.

The current logic may use a `LIKE` condition to support item-level inventory IDs.

Example:

```text
Etsy Order:

4104705089
```

Possible inventory source values:

```text
4104705089

4104705089-1

4104705089-2
```

All matching quantities are aggregated.

Formula:

```text
Order Material Cost =

Total Matching Quantity

×

₹250
```

Order matching must not accidentally match unrelated order numbers.

---

# Fractional FedEx Cost Allocation

FedEx billing costs belong to AWB numbers.

Sales belong to Etsy order numbers.

The mapping bridge connects the two.

The application must prevent FedEx costs from being counted multiple times.

---

## Case 1: One Order Has One AWB

Example:

```text
Order:

4104705089
```

```text
AWB:

873549431322
```

```text
AWB Cost:

₹500
```

The order receives:

```text
₹500
```

---

## Case 2: One AWB Contains Multiple Orders

Example:

```text
AWB:

873549431322
```

Mapped orders:

```text
4104705089

4104705090

4104705091
```

Total AWB cost:

```text
₹600
```

Number of distinct orders:

```text
3
```

Allocated cost:

```text
₹600 / 3

=

₹200 per order
```

Formula:

```text
Allocated AWB Cost Per Order =

Total AWB Cost

÷

Number of Distinct Orders Mapped to the AWB
```

This prevents the same ₹600 expense from being counted against all three orders.

---

## Case 3: One Order Is Split Across Multiple AWBs

Example:

```text
Order:

4104705089
```

Connected AWBs:

```text
AWB 1

AWB 2
```

Allocated cost from AWB 1:

```text
₹200
```

Allocated cost from AWB 2:

```text
₹300
```

Total order FedEx cost:

```text
₹200 + ₹300

=

₹500
```

Do not divide the final cost by the number of AWBs.

---

## Complete Allocation Formula

```text
Order FedEx Cost =

SUM(

AWB Cost

÷

COUNT(DISTINCT Orders Mapped to the AWB)

)
```

The allocation is calculated independently for every AWB.

---

# Direct NPF Calculation

The application calculates Direct NPF for every order.

NPF means:

```text
Net Profit
```

Current formula:

```text
Direct NPF =

Gross Sales

-

Material Cost

-

Allocated Duty / FedEx Cost
```

If Duty and Transport are stored separately:

```text
Direct NPF =

Gross Sales

-

Material Cost

-

Allocated Duty Cost

-

Allocated Transport Cost
```

---

## Example

```text
Gross Sales:

₹10,000
```

```text
Material Cost:

₹2,500
```

```text
Allocated Duty Cost:

₹500
```

```text
Allocated Transport Cost:

₹1,000
```

Calculation:

```text
Direct NPF =

₹10,000

-

₹2,500

-

₹500

-

₹1,000
```

Result:

```text
Direct NPF = ₹6,000
```

---

## Profit Margin

Formula:

```text
Profit Margin (%) =

(Direct NPF / Gross Sales)

×

100
```

Example:

```text
Direct NPF:

₹6,000
```

```text
Gross Sales:

₹10,000
```

```text
Profit Margin:

60%
```

If Gross Sales is zero:

```text
Profit Margin = 0
```

The application must never return:

```text
NaN

Infinity

-Infinity
```

---

# Phase 3: Dashboard Interface

The processed accounting information is returned to the React frontend.

The dashboard provides business-level financial analytics for the active date range.

---

## Dashboard Metrics

The dashboard displays:

- Total Sales
- Total Expenses
- Gross Profit / Direct NPF
- Profit Margin

---

## Total Sales

```text
Total Sales =

SUM(Etsy Net Sales)
```

---

## Total Material Cost

```text
Total Material Cost =

SUM(Order Material Costs)
```

---

## Total FedEx Cost

```text
Total FedEx Cost =

Total Allocated Duty Cost

+

Total Allocated Transportation Cost
```

---

## Total Expenses

```text
Total Expenses =

Total Material Cost

+

Total FedEx Cost
```

Equivalent formula:

```text
Total Expenses =

Material Cost

+

Duty Cost

+

Transportation Cost
```

---

## Gross Profit / Direct NPF

```text
Gross Profit =

Total Sales

-

Total Expenses
```

---

## Profit Margin

```text
Profit Margin =

(Gross Profit / Total Sales)

×

100
```

---

# Dashboard Visualizations

## Business Activity Graph

The activity graph displays financial performance over time.

The graph can display:

- Sales
- Expenses
- Net Profit

The default dashboard period can be configured in:

```text
config.json
```

Default:

```text
Last 12 months
```

---

## Chart Hover Information

When the user hovers over a chart period, display:

```text
Total Sales

Material Cost

Duty Cost

Transportation Cost

Total FedEx Cost

Total Expenses

Net Profit

Profit Margin
```

Missing numeric values must display as:

```text
₹0.00
```

The chart must never display:

```text
undefined

null

NaN

Infinity
```

---

## Expense Breakdown

The expense pie or donut chart displays:

```text
Material Cost

FedEx Duty Cost

Transportation Cost
```

If Duty and Transportation are not stored separately, display the available FedEx expense category without inventing values.

The center value displays:

```text
Total Expenses
```

---

# Dynamic Date Filtering

The dashboard supports preset date filters.

Examples:

```text
7D

30D

3M

6M

12M

FY

Custom
```

When the user changes the selected period:

1. The frontend calculates the exact date range.

2. Dates are converted to:

```text
YYYY-MM-DD
```

3. URL query parameters are updated.

4. The page does not perform a complete browser reload.

5. The frontend requests updated dashboard data.

6. The backend runs new DuckDB queries.

7. KPI cards update.

8. Charts update.

9. Expense calculations update.

10. Profit calculations update.

---

# Phase 4: Search and Order Investigation

The dashboard provides a search system for investigating individual orders and shipments.

---

## Live Search

Typing in the search field triggers a debounced API request.

Endpoint:

```http
GET /api/dashboard/search?q={query}
```

Example:

```http
GET /api/dashboard/search?q=410470
```

The debounce prevents unnecessary requests for every keystroke.

---

## Dual Search

DuckDB searches across:

```text
Etsy Order Number

FedEx AWB Number
```

The user can search using either identifier.

---

## Search by Order Number

Example:

```text
4104705089
```

Possible result:

```text
Order:

4104705089


AWBs:

873549431322


Sales:

₹10,000


Status:

Profitable
```

---

## Search by AWB Number

Example:

```text
873549431322
```

Possible result:

```text
AWB:

873549431322


Orders:

4104705089


Sales:

₹10,000


Status:

Profitable
```

---

## Autocomplete Dropdown

Search results are displayed below the search input.

Results may contain:

- Order number
- Connected AWB numbers
- Sales amount
- Profitability status

The dropdown supports:

- Debounced searching
- Partial matching
- Loading state
- No-results state
- Keyboard navigation
- Arrow Up
- Arrow Down
- Enter
- Escape
- Click-outside closing

---

# Order Details Modal

Selecting a search result opens a centered order-details modal.

The modal displays:

```text
Order Number

Connected AWB Numbers

Gross Sales

Material Cost

Duty Cost

Transportation Cost

Book Expenses

Total Expenses

Direct NPF

Profit Margin

Shipment Information
```

Shipment information may include:

```text
Customer Name

Shipping Status

Shipment Date

Process Code
```

Missing values must display safely.

Do not display:

```text
undefined

null

NaN

Invalid Date
```

---

# Phase 5: Financial Report Export

The dashboard generates financial CSV reports for the active date range.

---

## Export Workflow

```text
User clicks Export Report
             │
             ▼
Read active dates from URL
             │
             ▼
Request all matching orders
             │
             ▼
Run backend reconciliation
             │
             ▼
Transform records into CSV
             │
             ▼
Preserve AWB values as text
             │
             ▼
Download financial report
```

---

## Date Retrieval

The export process uses the active date range stored in the URL.

Example:

```text
from=2026-06-01

to=2026-06-30
```

The exported report always matches the currently selected dashboard period.

---

## Mass Data Query

The backend retrieves every matching order within the selected period.

Maximum supported export:

```text
100,000 records
```

Financial calculations are performed on the backend.

The browser does not calculate report values from raw records.

---

## CSV Report Columns

The financial report contains:

```text
Order Number

AWB Numbers

Date

Sales

Material Cost

Duty Cost

Book Expenses

Net Profit
```

The exact labels must match the current implementation.

---

## Excel-Safe AWB Formatting

AWB numbers must remain text when the CSV is opened in Excel.

Export format:

```text
="873549431322"
```

This prevents Excel from displaying:

```text
8.73549E+11
```

AWB numbers must never lose digits.

---

## Multiple AWBs

If one order contains multiple AWB numbers, they must remain inside the same CSV column.

Values containing commas must be escaped using valid CSV formatting.

Example:

```csv
"=""873549431322"", ""873549431323"""
```

The CSV structure must remain aligned.

---

## Download File Name

Generated reports use:

```text
Amazia_ERP_Report_YYYY-MM-DD_to_YYYY-MM-DD.csv
```

Example:

```text
Amazia_ERP_Report_2026-06-01_to_2026-06-30.csv
```

---

# Dashboard Data Integrity Rules

1. Dashboard financial calculations run on the backend.

2. The dashboard reads curated information from DuckDB.

3. Google Sheets are not queried during dashboard loading.

4. Order numbers are stored and compared as text.

5. AWB numbers are stored and compared as text.

6. Inventory item suffixes are removed before reconciliation.

7. Inventory quantities are aggregated by normalized order number.

8. Material cost is calculated using the configured material rate.

9. Shared AWB costs are divided by the number of distinct mapped orders.

10. Costs from multiple AWBs connected to one order are added together.

11. Do not divide an order's total FedEx cost merely because it has multiple AWBs.

12. FedEx costs must not be duplicated through many-to-many database joins.

13. KPI cards use backend-calculated values.

14. Charts use the same financial formulas as KPI cards.

15. Search details use the same financial formulas as the dashboard.

16. CSV reports use the same financial formulas as the dashboard.

17. Date filters are applied consistently.

18. Missing numeric values default safely to zero.

19. Financial APIs must never return `NaN`.

20. Financial APIs must never return infinite values.

21. Exported AWB numbers must remain complete text identifiers.

---

# Google Sheets Incremental Synchronization

The scheduler does not process the complete Google Sheet during every execution.

Synchronization progress is stored in:

```text
sync_metadata
```

Example:

```text
sync_name:

inventory_google_sheet
```

```text
last_processed_row:

1250
```

```text
last_sync_at:

2026-07-15 12:00:00
```

During the next synchronization:

```text
Start Row:

last_processed_row + 1
```

```text
End Row:

Current Google Sheet Last Row
```

Only newly appended rows are processed.

---

# Background Inventory Scheduler

The scheduler runs independently from Next.js.

Development setup:

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run scheduler
```

---

## Scheduler Frequency

The scheduler runs every six hours.

Cron expression:

```text
0 */6 * * *
```

Timezone:

```text
Asia/Kolkata
```

Expected execution times:

```text
12:00 AM IST

6:00 AM IST

12:00 PM IST

6:00 PM IST
```

---

## Scheduler Responsibilities

The scheduler:

- Initializes DuckDB.
- Connects to Google Sheets.
- Reads `last_processed_row`.
- Finds newly appended rows.
- Reads only new rows.
- Validates source information.
- Normalizes order numbers.
- Aggregates quantities.
- Saves records to DuckDB.
- Updates synchronization metadata.
- Logs synchronization duration.
- Handles failures without terminating.
- Prevents overlapping synchronization runs.

---

# Database

DuckDB is the application's embedded analytical database.

Database file:

```text
database/AmaziaERP.db
```

Use the actual configured database path if it differs.

The application stores curated information inside the DuckDB database file.

A separate local CSV copy is not required after a successful import unless an export or backup feature explicitly creates one.

---

# Main Database Tables

## `etsy_statement`

Stores curated Etsy sales information.

Example structure:

```sql
CREATE TABLE IF NOT EXISTS etsy_statement (
    id BIGINT PRIMARY KEY,
    date DATE,
    type TEXT,
    order_no TEXT,
    net_amt DOUBLE,
    created_at TIMESTAMP
);
```

Important:

```text
order_no must be stored as TEXT
```

---

## `fedex_billing`

Stores normalized FedEx billing records.

Example structure:

```sql
CREATE TABLE IF NOT EXISTS fedex_billing (
    id BIGINT PRIMARY KEY,
    invoice_type TEXT,
    invoice_date DATE,
    due_date DATE,
    awb_number TEXT,
    air_waybill_total_amount DOUBLE,
    book_expense_cost DOUBLE,
    created_at TIMESTAMP
);
```

Important:

```text
awb_number must be stored as TEXT
```

---

## `inventory_table`

Stores normalized order-level inventory information.

Example structure:

```sql
CREATE TABLE IF NOT EXISTS inventory_table (
    id BIGINT PRIMARY KEY,
    order_no TEXT,
    material_type TEXT,
    category TEXT,
    color TEXT,
    quantity DOUBLE,
    material_cost DOUBLE,
    created_at TIMESTAMP
);
```

---

## `shipment_order_mapping`

Stores relationships between Etsy order numbers and FedEx AWB numbers.

Example structure:

```sql
CREATE TABLE IF NOT EXISTS shipment_order_mapping (
    id BIGINT PRIMARY KEY,
    order_no TEXT,
    awb_number TEXT,
    process_code TEXT,
    shipping_status TEXT,
    customer_name TEXT,
    shipped_at TIMESTAMP,
    created_at TIMESTAMP
);
```

Important:

```text
One order may have multiple AWBs.

One AWB may have multiple orders.
```

Do not add a unique constraint to only:

```text
order_no
```

Do not add a unique constraint to only:

```text
awb_number
```

---

## `sync_metadata`

Stores incremental synchronization progress.

```sql
CREATE TABLE IF NOT EXISTS sync_metadata (
    sync_name VARCHAR PRIMARY KEY,
    last_processed_row INTEGER,
    last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## `import_history`

Stores import audit information.

Example structure:

```sql
CREATE TABLE IF NOT EXISTS import_history (
    id BIGINT PRIMARY KEY,
    import_type TEXT,
    file_name TEXT,
    file_size BIGINT,
    file_hash TEXT,
    total_rows INTEGER,
    imported_rows INTEGER,
    failed_rows INTEGER,
    processing_time_ms INTEGER,
    status TEXT,
    error_message TEXT,
    imported_at TIMESTAMP
);
```

The actual database schema in the project is the source of truth.

---

# API Overview

## FedEx Import

```http
POST /api/import/fedex
```

Request:

```text
multipart/form-data
```

Example response:

```json
{
  "success": true,
  "totalRows": 1282,
  "importedRows": 1282,
  "failedRows": 0,
  "processingTimeMs": 2753,
  "processingTime": "2.75 sec",
  "errors": []
}
```

---

## Etsy Import

```http
POST /api/import/etsy
```

Example response:

```json
{
  "success": true,
  "totalRows": 40,
  "saleRows": 5,
  "importedRows": 5,
  "failedRows": 0,
  "processingTime": "0.02 sec",
  "errors": []
}
```

---

## Dashboard Summary

```http
GET /api/dashboard/summary
```

Example:

```http
GET /api/dashboard/summary?from=2025-07-15&to=2026-07-15
```

The endpoint returns financial metrics and chart information for the selected period.

---

## Dashboard Search

```http
GET /api/dashboard/search
```

Example:

```http
GET /api/dashboard/search?q=4104705089
```

The endpoint searches order numbers and AWB numbers.

---

## Shipment by Order

```http
GET /api/shipments/orders/{orderNo}
```

Example:

```http
GET /api/shipments/orders/4074621797
```

The endpoint returns connected AWB and shipment information.

---

## Financial Report Export

The export endpoint returns reconciled order-level information as a CSV file.

The exported report uses the active dashboard date range.

---

# Project Structure

```text
AMAZIA_ERP/
│
├── app/
│   ├── api/
│   │   ├── dashboard/
│   │   │   ├── summary/
│   │   │   ├── search/
│   │   │   └── export/
│   │   │
│   │   ├── shipments/
│   │   │   └── orders/
│   │   │
│   │   ├── import/
│   │   │   ├── etsy/
│   │   │   └── fedex/
│   │   │
│   │   └── inventory/
│   │
│   ├── dashboard/
│   ├── upload/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── dashboard/
│   ├── upload/
│   └── ui/
│
├── database/
│   ├── index.ts
│   └── AmaziaERP.db
│
├── lib/
│   ├── dashboard/
│   │   └── dashboardQueries.ts
│   │
│   ├── csv.ts
│   ├── duckdb.ts
│   ├── processor.ts
│   └── validation.ts
│
├── services/
│   ├── etsyImportService.ts
│   ├── fedexImportService.ts
│   ├── inventorySync.ts
│   └── shipmentService.ts
│
├── workers/
│   └── inventoryScheduler.ts
│
├── types/
│
├── utils/
│
├── public/
│
├── instrumentation.ts
│
├── config.json
│
├── .env.local
│
├── package.json
│
├── tsconfig.json
│
├── next.config.ts
│
└── README.md
```

The actual project structure is the source of truth.

Update this section if the implemented paths are different.

---

# Environment Configuration

Create:

```text
.env.local
```

Example:

```env
GOOGLE_SHEET_ID=your_google_sheet_id

GOOGLE_SHEET_TAB_NAME=DB

GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email

GOOGLE_PRIVATE_KEY="your_private_key"

RUN_INVENTORY_SYNC_ON_STARTUP=false
```

Never commit credentials.

Add environment files to `.gitignore`:

```gitignore
.env

.env.local

.env.production
```

---

# Installation

## Requirements

Install:

- Node.js
- npm
- Git

Recommended:

```text
Node.js 20 or later
```

Verify:

```bash
node --version
```

Verify npm:

```bash
npm --version
```

---

## Install the Project

Clone:

```bash
git clone <repository-url>
```

Open the project:

```bash
cd amazia_erp
```

Install dependencies:

```bash
npm install
```

---

# Run the Application

Start Next.js:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Run the Inventory Scheduler

Open another terminal:

```bash
npm run scheduler
```

Keep both terminals running.

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run scheduler
```

---

# Production

Create the production build:

```bash
npm run build
```

Start Next.js:

```bash
npm run start
```

Start the scheduler separately:

```bash
npm run scheduler
```

The Next.js application and inventory scheduler must run as separate processes.

---

# Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production Next.js server |
| `npm run scheduler` | Start the inventory synchronization worker |
| `npm run lint` | Run project lint checks |

The actual `package.json` is the source of truth.

---

# UI Design System

Amazia ERP uses a warm, minimal business interface.

```css
@theme {
  --color-brand-background: #F4EFE5;

  --color-brand-card: #FFFAF1;

  --color-brand-primary: #184B4D;

  --color-brand-primary-hover: #103638;

  --color-brand-border: #E4D4BA;

  --color-brand-muted: #677072;

  --color-brand-success: #E6F4EA;

  --color-brand-danger: #FDE9E8;

  --color-brand-gold: #F1E1B9;

  --radius-xl: 20px;

  --radius-2xl: 24px;

  --shadow-glass:
    0 12px 40px -12px rgba(24, 75, 77, 0.12),
    0 4px 16px -8px rgba(24, 75, 77, 0.08);
}
```

---

# UI Principles

- Minimal design
- Warm neutral background
- Off-white cards
- Dark teal primary actions
- Clear financial metrics
- Responsive layouts
- Consistent spacing
- Rounded cards
- Soft shadows
- Accessible contrast
- Toast notifications
- Paginated large datasets
- Responsive charts
- Clear financial breakdowns

---

# Error Handling

The application returns structured errors.

Example:

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "row": 14,
      "field": "Invoice Date",
      "message": "Invalid date."
    }
  ]
}
```

The frontend displays user-friendly toast notifications.

Technical information remains in server logs.

Do not expose:

- Database paths
- SQL internals
- Stack traces
- Environment variables
- Google credentials
- Internal implementation information

---

# Database Access Notes

DuckDB is an embedded database.

Avoid unnecessary simultaneous write access.

When opening the database using DBeaver:

1. Stop the Next.js application if required.

2. Stop the inventory scheduler.

3. Open DuckDB using DBeaver.

4. Run database queries.

5. Close the DBeaver connection.

6. Restart Next.js.

7. Restart the scheduler.

Do not delete the database to resolve normal application errors.

---

# Troubleshooting

## Unable to Connect to DuckDB

Possible causes:

- DBeaver holds a database lock.
- Another application holds the database file.
- Next.js and the scheduler are performing conflicting writes.
- The application stopped during a transaction.
- The configured database path is incorrect.

Recommended steps:

```text
1. Stop Next.js.

2. Stop the scheduler.

3. Close DBeaver.

4. Verify the database path.

5. Restart Next.js.

6. Restart the scheduler.
```

---

## AWB Displayed in Scientific Notation

Cause:

```text
The AWB was interpreted as a number.
```

Correct behavior:

```text
Store AWB as TEXT.
```

Do not use:

```ts
Number(awb);
```

Do not use:

```ts
parseFloat(awb);
```

For CSV export:

```text
="873549431322"
```

---

## Scheduler Missed Execution

The scheduler must run separately from Next.js.

Start it using:

```bash
npm run scheduler
```

Do not register the production scheduler inside Next.js instrumentation.

---

# Current Project Status

## Completed

- Next.js application
- TypeScript configuration
- Tailwind UI theme
- DuckDB integration
- Etsy CSV upload
- Etsy CSV parsing
- Etsy Sale extraction
- Etsy order-number extraction
- Etsy amount normalization
- FedEx CSV upload
- FedEx CSV parsing
- FedEx header mapping
- FedEx date normalization
- FedEx amount normalization
- AWB text preservation
- Book Expense Cost calculation
- Transaction-based FedEx import
- Google Sheets inventory integration
- Incremental inventory synchronization
- Inventory order-number normalization
- Quantity aggregation
- Material-cost calculation
- Six-hour scheduler
- Dedicated scheduler process
- Order-to-AWB mapping
- Dummy shipment API
- Fractional FedEx expense allocation
- Accounting reconciliation engine
- Direct NPF calculation
- Business dashboard
- Sales metrics
- Expense metrics
- Profit metrics
- Profit-margin metrics
- Business activity graph
- Expense breakdown
- URL-based date filtering
- Order-number search
- AWB-number search
- Debounced search
- Autocomplete dropdown
- Order details modal
- Financial CSV export
- Excel-safe AWB formatting

---

**Amazia ERP**

Sales ingestion, billing management, inventory synchronization, expense reconciliation, order-level profitability, business analytics, search, and financial reporting in one application.
