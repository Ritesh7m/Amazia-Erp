# Data Ingestion & Sync

Amazia ERP relies on three primary data sources. Data imported from Etsy Statements, FedEx Billing CSVs, and Google Sheets Inventory is validated, normalized, and stored in DuckDB before being used by the Accounting Engine.

## Order-to-AWB Mapping

The system dynamically links Etsy sales to FedEx shipments. It must safely handle all three scenarios to prevent double-counting expenses:
1. **One Order → One AWB:** Standard shipment.
2. **One Order → Multiple AWBs:** Split shipments (e.g., backorders or multi-box orders).
3. **One AWB → Multiple Orders:** Combined shipments (e.g., one box containing three different orders for the same customer).

## Accounting and Reconciliation Engine

All dashboard calculations and financial aggregations are performed on the Next.js backend in `lib/dashboard/dashboardQueries.ts`. The frontend simply displays the processed results from DuckDB.

### Core Financial Formulas

* **Material Cost Reconciliation:**
  `Material Cost = Total Quantity × (multiplyer)`
* **FedEx Shipping Cost Allocation:**
  Calculates the cost when multiple orders share one AWB.
  `Allocated Shipping Cost = Total AWB Cost ÷ Number of Mapped Orders`
  *(Example: AWB 873549431322 costs ₹600 and maps to 3 distinct orders. The cost is divided equally: ₹600 / 3 = ₹200 per order.)*
* **One Order with Multiple AWBs:**
  Calculates the cost when one order is split across several shipments.
  `Order FedEx Cost = Σ (AWB Cost ÷ Number of Orders Mapped to that AWB)`
* **Net Profit:**
  `Net Profit = Gross Sales − Material Cost − Duty Cost − Transport Cost`
* **Profit Margin:**
  `Profit Margin (%) = (Net Profit ÷ Gross Sales) × 100`

## 1. Etsy Statement Import
Etsy sales transaction data is imported via CSV files downloaded from the Etsy seller dashboard.

* **Process:** Users upload the statement CSV through the Amazia ERP dashboard.
* **Handling:** The backend parses the CSV, extracts relevant order details, and inserts or updates records in the `etsy_statement` DuckDB table.
* **Audit Trail:** Every import logs processing time, rows imported, and failed rows into the `import_history` table.

**Example Etsy Statement Data Format:**

| date | type | order_no | net_amt | created_at |
|---|---|---|---|---|
| 2026-07-15 | Sale | 123456789 | ₹45.00 | 2026-07-19 10:00:00 |
| 2026-07-16 | Sale | 123456790 | ₹20.00 | 2026-07-19 10:00:00 |

---

## 2. FedEx Billing Import
FedEx shipping, duty, tax, and transportation expenses are imported manually via CSV uploads.

* **Process:** Users upload the FedEx billing CSV through the dashboard.
* **Handling:** The system extracts the invoice details and Air Waybill (AWB) numbers, storing them in the `fedex_billing` table.
* **Mapping:** The `shipment_order_mapping` table maintains the relationship between Etsy Orders (`order_no`) and FedEx AWBs (`awb_number`) for accurate cost allocation.
* **Audit Trail:** Import statistics and error details are recorded in `import_history`.

**Example FedEx Billing Data Format:**

| invoice_type | invoice_date | due_date | awb_number | air_waybill_total_amount | book_expense_cost |
|---|---|---|---|---|---|
| Shipping | 2026-07-10 | 2026-07-24 | 771234567890 | ₹10.00 | ₹1.50 |
| Duty/Tax | 2026-07-11 | 2026-07-25 | 771234567891 | ₹6.00 | ₹0.50 |

---

## 3. Google Sheets Inventory Sync
Inventory data is synchronized automatically from the **DB** worksheet of the configured Google Sheet.

* **Process:** A background scheduler normalizes Order IDs, aggregates quantities, calculates material costs, and stores order-level inventory records in the `inventory_table`.
* **Incremental Sync:** The system utilizes the `sync_metadata` table to track the last processed Google Sheet row and synchronization timestamp, ensuring only new or updated rows are fetched.

**Google Sheets (DB Tab) Column Mapping:**

| Google Sheet Column | Field | Example Data |
|---|---|---|
| B | Order ID | 123456789 |
| D | Material Type | Cotton / Resin |
| E | Category | Apparel |
| F | Color | Navy Blue |
| G | Quantity | 2 |