# Amazia ERP

Amazia ERP is a billing, expense, inventory, and business analytics platform built using Next.js, TypeScript, Tailwind CSS, and DuckDB.

The application imports Etsy sales statements and FedEx billing CSV files, synchronizes inventory data from Google Sheets, processes and normalizes business data, stores curated records in DuckDB, and presents sales, expenses, profit, and operational insights through a minimal business dashboard.

The system is designed so that the dashboard reads only from DuckDB. External sources such as Google Sheets are handled independently through a scheduled synchronization worker and are not queried when the dashboard loads.

---

## Project Overview

Amazia ERP currently contains the following modules:

1. Business Analytics Dashboard
2. Etsy Statement Import
3. FedEx Billing Import
4. Google Sheets Inventory Synchronization
5. DuckDB Data Storage
6. Background Inventory Scheduler
7. Search, Filtering, Reporting, and Pagination

---

## Technology Stack

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

## Core Architecture

```text
                         AMAZIA ERP
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
 Next.js Web Application              Inventory Scheduler Worker
      npm run dev                          npm run scheduler
          │                                       │
          │                                       │
          ├── Dashboard                            ├── Runs every 6 hours
          ├── Upload Interface                     ├── Reads Google Sheets
          ├── Etsy Import API                      ├── Reads only new rows
          ├── FedEx Import API                     ├── Normalizes order numbers
          ├── Dashboard APIs                       ├── Aggregates quantities
          └── DuckDB Reads/Writes                  └── Saves data to DuckDB
                         │
                         ▼
                      DuckDB
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
     Etsy Sales     FedEx Expenses    Inventory
```

---

## Application Workflow

### Sales Workflow

```text
Etsy CSV Statement
        │
        ▼
Upload from the application
        │
        ▼
Validate CSV file
        │
        ▼
Parse statement rows
        │
        ▼
Keep Sale transactions
        │
        ▼
Extract required values
        │
        ▼
Normalize dates and amounts
        │
        ▼
Validate order numbers
        │
        ▼
Save curated sales records to DuckDB
        │
        ▼
Dashboard reads sales data
```

### Expense Workflow

```text
FedEx Billing CSV
        │
        ▼
Upload from the application
        │
        ▼
Validate CSV file and headers
        │
        ▼
Parse billing records
        │
        ▼
Map required FedEx columns
        │
        ▼
Normalize dates and monetary values
        │
        ▼
Calculate Book Expense Cost
        │
        ▼
Validate all rows
        │
        ▼
Insert all valid records using a transaction
        │
        ▼
Dashboard reads expense data
```

### Inventory Workflow

```text
Google Sheet
     │
     │ Read only
     ▼
Inventory Scheduler
Runs every 6 hours
     │
     ▼
Read last_processed_row from DuckDB
     │
     ▼
Get the current last row from the sheet
     │
     ▼
Check for newly appended rows
     │
     ├── No new rows
     │       │
     │       ▼
     │    End synchronization
     │
     └── New rows
             │
             ▼
       Read only new rows
             │
             ▼
       Validate source values
             │
             ▼
       Normalize order numbers
             │
             ▼
       Aggregate order quantities
             │
             ▼
       Save records to DuckDB
             │
             ▼
       Update last_processed_row
```

---

# Dashboard

The dashboard provides a consolidated overview of sales, expenses, profitability, inventory costs, and recent business activity.

## Dashboard Features

- Total Sales
- Total Expenses
- Gross Profit
- Profit Margin
- Monthly Business Performance
- Sales and Expense Comparison
- Expense Breakdown
- Recent Orders
- Recent Import Activity
- Inventory Synchronization Status
- Date-range filtering
- Quick time filters
- Search by:
  - Order number
  - Air Waybill number
  - Invoice type
- Report export
- Configurable chart period
- Paginated data tables

The dashboard does not directly query Google Sheets.

All dashboard information is loaded from DuckDB.

---

## Dashboard Metrics

### Total Sales

Total sales are calculated using imported Etsy sale transactions.

```text
Total Sales = SUM(Etsy Net Amount)
```

### Total Expenses

Total expenses are calculated using imported FedEx billing records and inventory/material costs.

```text
Total Expenses =
FedEx Expenses
+
Material or Inventory Expenses
```

### Gross Profit

```text
Gross Profit =
Total Sales
-
Total Expenses
```

### Profit Margin

```text
Profit Margin (%) =
(Gross Profit / Total Sales) × 100
```

If total sales are zero, the profit margin must return `0` to prevent division-by-zero errors.

---

# Etsy Statement Import

The Etsy module imports sales transaction data from Etsy CSV statements.

## Required Etsy Data

Only the required business fields are extracted from the source CSV.

| Database Field | Source |
|---|---|
| `date` | Etsy transaction date |
| `type` | Etsy transaction type |
| `order_no` | Extracted Etsy order number |
| `net_amt` | Etsy net transaction amount |
| `created_at` | Import timestamp |

Example source row:

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

## Etsy Processing Rules

- Accept `.csv` and `.CSV` files.
- File extension validation is case-insensitive.
- Handle UTF-8 BOM characters.
- Match required CSV headers case-insensitively.
- Trim whitespace from headers and values.
- Process only required Etsy transaction types.
- Extract the order number from transaction descriptions.
- Remove currency symbols.
- Remove commas from monetary values.
- Convert monetary values into valid numeric values.
- Normalize dates before database insertion.
- Validate all required values.
- Store timestamps consistently.
- Prevent invalid rows from being silently inserted.
- Return useful validation errors to the API.
- Display success and failure feedback using toast notifications.

---

# FedEx Billing Import

The FedEx module imports invoice and shipping expense information from FedEx billing CSV files.

## Required FedEx Fields

| Database Field | CSV Header |
|---|---|
| `invoice_type` | Invoice Type |
| `invoice_date` | Invoice Date |
| `due_date` | Due Date |
| `awb_number` | Air Waybill Number |
| `air_waybill_total_amount` | Air Waybill Total Amount |
| `book_expense_cost` | Calculated by the application |
| `created_at` | Import timestamp |

## Book Expense Cost

The application calculates the expense cost using:

```text
Book Expense Cost =
Amount - ((Amount / 118) × 100)
```

Equivalent formula:

```text
Book Expense Cost =
Amount × 18 / 118
```

The result is rounded according to the application's financial precision rules.

## FedEx Validation Rules

- Accept `.csv` and `.CSV` files.
- Perform case-insensitive file extension validation.
- Validate all required CSV headers.
- Ignore unused source columns.
- Preserve Air Waybill numbers as text.
- Never convert Air Waybill numbers to floating-point values.
- Avoid scientific notation.
- Preserve all AWB digits.
- Normalize supported date formats.
- Remove currency symbols.
- Remove thousands separators.
- Convert valid amount values into numbers.
- Return row-level validation errors.

## AWB Business Rule

Multiple shipments or records may use the same Air Waybill number.

Therefore:

- AWB is not a unique database field.
- Do not reject records only because the AWB already exists.
- Do not use AWB alone as a duplicate key.
- Do not add a unique constraint to `awb_number`.

---

# Atomic Import Transactions

FedEx imports use transaction-based processing.

```text
BEGIN TRANSACTION
        │
        ▼
Validate and insert all rows
        │
        ├── All operations succeed
        │           │
        │           ▼
        │         COMMIT
        │
        └── Any operation fails
                    │
                    ▼
                 ROLLBACK
```

This prevents incomplete imports.

Expected behavior:

```text
Either all valid rows are committed,
or no rows are committed.
```

The application must not leave partially inserted billing data after a failed atomic import.

---

# Google Sheets Inventory Synchronization

Inventory information is imported from the `DB` tab of a configured Google Sheet.

## Source Columns

| Sheet Column | Field |
|---|---|
| B | Order ID |
| D | Material Type |
| E | Category |
| F | Color |
| G | Quantity |

## Order Number Normalization

Google Sheets may contain item-level order IDs:

```text
4098751354-1
4098751354-2
4098751352
```

The suffix represents item-level information.

The inventory database stores order-level information only.

Normalized values:

```text
4098751354-1 → 4098751354

4098751354-2 → 4098751354

4098751352 → 4098751352
```

The application always removes the item suffix after `-`.

## Quantity Aggregation

Example input:

```text
4098751354-1 → 3.1

4098751354-2 → 3.0

4098751352 → 3.0
```

Aggregated output:

```json
{
  "4098751354": 6.1,
  "4098751352": 3
}
```

## Material Cost Rule

```text
1 Quantity = ₹250
```

Therefore:

```text
Material Cost =
Total Quantity × 250
```

Example:

```text
Total Quantity = 6.1

Material Cost =
6.1 × ₹250

Material Cost =
₹1,525
```

---

# Incremental Inventory Synchronization

The scheduler does not read and process the entire Google Sheet during every execution.

It stores synchronization progress in DuckDB.

Example metadata:

```text
sync_name:
inventory_google_sheet

last_processed_row:
1250

last_sync_at:
2026-07-12 12:00:00
```

On the next synchronization:

```text
Read:

last_processed_row + 1

through:

current sheet last row
```

Only newly appended source rows are processed.

This improves performance and prevents repeated full-sheet processing.

---

# Background Scheduler

The inventory scheduler runs independently from Next.js.

## Development Processes

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run scheduler
```

## Schedule

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

## Why the Scheduler Is Separate

The scheduler is not registered inside the Next.js application because an internal scheduler may be affected by:

- Development hot reload
- Application recompilation
- Node.js event-loop blocking
- Application restarts
- Multiple application instances
- Serverless process shutdowns
- Duplicate cron registration

The separate worker improves reliability and keeps background synchronization independent from dashboard traffic.

---

# Scheduler Safety

The scheduler prevents overlapping executions.

Example:

```ts
let isSyncRunning = false;
```

If a previous synchronization is still active:

```text
Previous synchronization is still running.

Current scheduled execution is skipped.
```

The lock is reset after success or failure.

The scheduler:

- Initializes DuckDB when the worker starts.
- Registers only one scheduled task.
- Uses the `Asia/Kolkata` timezone.
- Logs synchronization start time.
- Logs synchronization completion.
- Logs processing duration.
- Handles errors without terminating the worker.
- Supports graceful shutdown.
- Preserves synchronization metadata.

---

# Database

DuckDB is used as the local analytical and application database.

The database is stored as a local database file.

Example:

```text
database/AmaziaERP.db
```

Use the actual configured path in the project if it differs.

DuckDB stores data inside the database file. It is not necessary to maintain a separate CSV copy after a successful import unless an export or backup feature is explicitly implemented.

---

## Main Database Tables

### `fedex_billing`

Stores normalized FedEx billing records.

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
awb_number must be stored as TEXT.
```

Do not store AWB numbers using:

```text
FLOAT

DOUBLE

REAL
```

Numeric storage may display values using scientific notation and can affect identifier precision.

---

### `etsy_statement`

Stores curated Etsy sales transactions.

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
order_no must be stored as TEXT.
```

---

### `inventory_table`

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

### `sync_metadata`

Stores incremental synchronization progress.

```sql
CREATE TABLE IF NOT EXISTS sync_metadata (
    sync_name VARCHAR PRIMARY KEY,
    last_processed_row INTEGER,
    last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### `import_history`

Stores file-import audit information.

Typical fields:

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

The exact schema must match the implementation in the project.

---

# Project Structure

```text
AMAZIA_ERP/
│
├── app/
│   ├── api/
│   │   ├── dashboard/
│   │   ├── import/
│   │   │   ├── etsy/
│   │   │   └── fedex/
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
│   ├── csv.ts
│   ├── duckdb.ts
│   ├── processor.ts
│   └── validation.ts
│
├── services/
│   ├── etsyImportService.ts
│   ├── fedexImportService.ts
│   └── inventorySync.ts
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

The actual folder and file names in the repository are the source of truth. Update this section if the implementation uses different paths.

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

Do not commit credentials.

Add environment files to `.gitignore`:

```gitignore
.env
.env.local
.env.production
```

---

# Dashboard Configuration

The dashboard displays a configurable number of months.

Example:

```json
{
  "dashboard": {
    "defaultMonths": 12
  }
}
```

Default:

```text
12 months
```

The dashboard must read the value from configuration rather than hardcoding it throughout the UI.

---

# Installation

## Prerequisites

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

```bash
npm --version
```

---

## Clone the Project

```bash
git clone <repository-url>
```

Move into the project:

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

Expected output:

```text
[Inventory Scheduler] Worker started.

[Inventory Scheduler] Timezone: Asia/Kolkata

[Inventory Scheduler] Schedule: Every 6 hours.

[Inventory Scheduler] Next automatic synchronization is registered.
```

Keep both processes running.

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run scheduler
```

---

# Production Build

Create a production build:

```bash
npm run build
```

Start the production web application:

```bash
npm run start
```

Start the scheduler separately:

```bash
npm run scheduler
```

The web application and scheduler must remain separate processes.

---

# Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Create production build |
| `npm run start` | Start production Next.js server |
| `npm run scheduler` | Start inventory synchronization worker |
| `npm run lint` | Run lint checks |

The available scripts must match the current `package.json`.

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

Expected successful response:

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

Example successful response:

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
GET /api/dashboard/summary?from=2025-07-12&to=2026-07-12
```

The endpoint returns dashboard metrics for the selected date range.

---

# UI Design System

Amazia ERP uses a warm, minimal business interface.

## Theme

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

## UI Principles

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
- Toast notifications for import feedback
- Pagination instead of very long tables
- No unnecessary dashboard scrolling for large datasets

---

# Error Handling

The application returns structured error responses.

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

The UI displays user-friendly toast notifications.

Technical errors remain in server logs.

Do not expose:

- Database file paths
- SQL internals
- Stack traces
- Environment variables
- Credentials
- Internal implementation details

---

# Data Integrity Rules

1. Store identifiers as text.

2. Do not store AWB numbers as floating-point values.

3. Do not use AWB as a unique key.

4. Preserve complete AWB values.

5. Normalize item-level inventory order numbers to order-level values.

6. Aggregate quantities for matching normalized order numbers.

7. Use database transactions for atomic imports.

8. Roll back failed atomic imports.

9. Do not leave partial data after a failed atomic import.

10. Preserve `sync_metadata.last_processed_row`.

11. Process only newly appended Google Sheet rows.

12. Do not query Google Sheets while loading the dashboard.

13. Run only one inventory scheduler instance.

14. Keep scheduler database operations short and transactional.

15. Never delete the database automatically after an error.

---

# Database Access Notes

DuckDB is an embedded database.

Avoid opening the same database file from multiple write processes unnecessarily.

When inspecting the database using DBeaver:

1. Stop the Next.js application if required.
2. Stop the inventory scheduler.
3. Open the DuckDB database in DBeaver.
4. Run read or maintenance queries.
5. Close the DBeaver connection.
6. Restart the application and scheduler.

This reduces file-lock conflicts.

Do not delete the database file to resolve normal import errors.

---

# Troubleshooting

## Unable to Connect to DuckDB

Possible causes:

- Another application holds a database lock.
- DBeaver is connected while the application is writing.
- The scheduler and application are attempting conflicting writes.
- The application was terminated during a transaction.
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

Do not immediately delete the database.

---

## CSV Extension Error

File validation must be case-insensitive.

Correct:

```ts
const isCSV =
  file.name.toLowerCase().endsWith(".csv");
```

This accepts:

```text
invoice.csv

invoice.CSV

Invoice.Csv
```

---

## AWB Displayed in Scientific Notation

Cause:

```text
AWB was interpreted as a numeric value.
```

Fix:

```text
Store and process AWB as TEXT.
```

Do not convert AWB using:

```ts
Number(awb)
```

or:

```ts
parseFloat(awb)
```

---

## Scheduler Missed Execution Warning

If the scheduler runs inside Next.js, application compilation or blocking work can delay cron execution.

The production-safe solution is to run:

```bash
npm run scheduler
```

as a separate process.

---

# Current Project Status

## Completed

- Next.js application setup
- Tailwind UI theme
- DuckDB integration
- FedEx CSV upload
- FedEx CSV parsing
- FedEx header mapping
- FedEx date normalization
- FedEx amount normalization
- Book Expense Cost calculation
- Transaction-based FedEx imports
- Etsy statement upload
- Etsy Sale extraction
- Etsy order-number extraction
- Etsy amount normalization
- Google Sheets inventory integration
- Incremental inventory synchronization
- Inventory order-number normalization
- Quantity aggregation
- Material-cost calculation
- Six-hour scheduler
- Dedicated scheduler worker architecture
- Business dashboard
- Sales metrics
- Expense metrics
- Gross-profit metrics
- Profit-margin metrics
- Monthly performance chart
- Expense breakdown
- Search
- Date filtering
- Report export
- Paginated records

## Future Improvements

- Authentication and role-based access
- User management
- Advanced report builder
- PDF report generation
- Excel report export
- Import-history page
- Manual inventory synchronization
- Scheduler health monitoring
- Database backup automation
- Audit logs
- Notification system
- Deployment monitoring
- Automated integration tests
- Dashboard caching
- Advanced financial forecasting

---

# Security

- Never commit `.env.local`.
- Never expose Google credentials to the browser.
- Keep Google Sheets access on the server.
- Validate all uploaded files.
- Validate all parsed values.
- Use parameterized database queries.
- Do not expose raw database errors to users.
- Keep technical logs server-side.
- Do not trust CSV content without validation.

---

# License

This project is private and intended for Amazia ERP business operations.

Unauthorized copying, redistribution, or commercial use is not permitted unless approved by the project owner.

---

# Project

**Amazia ERP**

Billing, inventory, expense management, sales analytics, and business reporting in one application.
