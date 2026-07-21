# Amazia ERP System Guide

## Introduction

**Amazia ERP** is a centralized data processing system that automates billing imports and inventory synchronization. It validates, normalizes, and stores data from multiple sources into DuckDB, providing a reliable foundation for reporting, reconciliation, and operational analytics.

---

# Core Architecture

```text
                                AMAZIA ERP
                                     │
              ┌──────────────────────┴──────────────────────┐
              │                                             │
              ▼                                             ▼
     Next.js Web Application                     Inventory Scheduler
          npm run dev                             npm run scheduler
              │                                             │
              ├── Dashboard                               ├── Runs every 6 hours
              ├── Upload Interface                        ├── Reads Google Sheets
              ├── Etsy Import API                         ├── Reads only new rows
              ├── FedEx Import API                        ├── Normalizes Order IDs
              ├── Dashboard APIs                          ├── Aggregates Quantities
              ├── Search API                              └── Saves data to DuckDB
              ├── Shipment Mapping
              ├── Financial Reporting
              └── DuckDB Reads/Writes
                                  │
                                  ▼
                               DuckDB
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
             ▼                    ▼                    ▼
        Etsy Sales         FedEx Expenses       Inventory Data
             │                    │                    │
             └────────────────────┼────────────────────┘
                                  │
                                  ▼
                        Order-to-AWB Mapping
                                  │
                                  ▼
                     Accounting Reconciliation
                                  │
                                  ▼
          Dashboard, Search, Details & CSV Reports
```

---

# System Workflow

The Amazia ERP platform operates through five major phases:

### Phase 1 – Billing Import

Imports, validates, normalizes, and stores FedEx or Etsy billing CSV data into DuckDB.

### Phase 2 – Inventory Synchronization

Synchronizes newly added Google Sheets inventory records into DuckDB using incremental processing.

### Phase 3 – Centralized Data Storage

Maintains DuckDB as the single source of truth for billing and inventory data.

### Phase 4 – Dashboard & Reporting

Retrieves processed data from DuckDB to generate fast and reliable dashboards and reports.

### Phase 5 – Data Management

Provides clean, validated, and centralized data for business analysis and operational reporting.

---

# Phase 1 – Data Ingestion & Synchronization

Amazia ERP acts as a central data hub, importing raw information from multiple independent sources. The application standardizes, validates, and stores curated records inside DuckDB.

---

## Etsy Statement Import (Sales Data)

The Etsy Statement Import module processes sales information via CSV upload.

**Target Table**

- `etsy_statement`

**Relevant Fields**

- `date`
- `type`
- `order_no`
- `net_amt`
- `created_at`

### Processing Rules & Validation

- Accept `.csv` and `.CSV` files (case-insensitive extension validation).
- Process only required Etsy transaction types (e.g. **Sale**).
- Extract order numbers from transaction descriptions.

Example:

```
Payment for Order #4105054431
```

↓

```
4105054431
```

- Normalize dates before database insertion.
- Store timestamps consistently.

### Example Record

```json
{
  "date": "2026-06-30",
  "type": "Sale",
  "order_no": "4105054431",
  "net_amt": 2810
}
```

---

## FedEx Billing Import (Expense Data)

The FedEx Billing Import module captures shipping, duty, tax, and transportation expenses.

**Target Table**

- `fedex_billing`

**Relevant Fields**

- `invoice_type`
- `invoice_date`
- `due_date`
- `awb_number`
- `air_waybill_total_amount`
- `book_expense_cost`
- `created_at`

### Book Expense Cost Calculation

Book Expense Cost is calculated automatically during import and rounded to standard financial precision.

**Formula**

```text
Book Expense Cost = Amount × 18 / 118
```

---

## Inventory Google Sheet

Inventory data is fetched dynamically from the **DB** tab of a configured Google Sheet.

### Required Source Columns

| Column | Description   |
| ------ | ------------- |
| B      | Order ID      |
| D      | Material Type |
| E      | Category      |
| F      | Color         |
| G      | Quantity      |

---

### Inventory Order Normalization

Google Sheets often contain item-level suffixes such as `-1`, `-2`.

Since the dashboard works at the **order level**, these suffixes are removed before storing data.

#### Example

| Original Order ID | Normalized Order ID |
| ----------------- | ------------------- |
| `4104705089-1`    | `4104705089`        |
| `4104705089-2`    | `4104705089`        |

---

### Quantity Aggregation

All quantities mapped to the same normalized Order ID are aggregated.

#### Input

| Order ID       | Quantity |
| -------------- | -------: |
| `4104705089-1` |      3.1 |
| `4104705089-2` |      3.0 |

#### Aggregated Result

```json
{
  "4104705089": 6.1
}
```

---

### Material Cost Calculation

The current hardcoded material-cost rate is:

```text
1 Quantity = some multiplyer
```

**Formula**

```text
Material Cost = Total Quantity × multiplyer50
```

Example

```text
6.1 × ₹250 = ₹1,525
```

---

## Order-to-AWB Mapping

The system safely supports all three mapping scenarios.

1. One Order → One AWB
2. One Order → Multiple AWBs
3. One AWB → Multiple Orders

### Example API Response

**GET**

```http
/api/shipments/orders/4074621797
```

```json
{
  "data": {
    "orderNo": "4074621797",
    "awbNumbers": ["873549431322"],
    "shipments": [
      {
        "awbNumber": "873549431322",
        "processCode": "P_7104",
        "shippingStatus": "SHIPPED",
        "customerName": "Gretchen Dziadosz",
        "shippedAt": "2026-06-25T17:34:33.147Z",
        "orders": ["4074621797"]
      }
    ]
  }
}
```

---

# Phase 2 – Accounting & Reconciliation Engine

All dashboard calculations and financial aggregations are performed on the Next.js backend in:

```text
lib/dashboard/dashboardQueries.ts
```

The frontend simply displays the processed results from DuckDB.

---

## Material Cost Reconciliation

**Formula**

```text
Material Cost = Total Quantity × multiplyer
```

---

## FedEx Shipping Cost Allocation

**Formula**

```text
Allocated Shipping Cost =
Total AWB Cost ÷ Number of Mapped Orders
```

### Example

AWB `873549431322`

Total Cost = ₹600

Mapped Orders

- 4104705089
- 4104705090
- 4104705091

Result

```text
₹600 ÷ 3 = ₹200 per order
```

---

## One Order with Multiple AWBs

**Formula**

```text
Order FedEx Cost =
Σ (AWB Cost ÷ Number of Orders Mapped to that AWB)
```

---

## Net Profit & Profit Margin

**Net Profit**

```text
Gross Sales
− Material Cost
− Duty Cost
− Transport Cost
```

**Profit Margin**

```text
(Net Profit ÷ Gross Sales) × 100
```

---

# Phase 3 – Dashboard Interface

The dashboard displays backend-calculated KPIs from DuckDB.

## Dashboard Metrics

1. Total Sales = SUM(Etsy Net Sales)

2. Total Material Cost = SUM(Order Material Costs)

3. Total FedEx Cost = Total Allocated Duty Cost + Total Allocated Transportation Cost

4. Total Expenses = Material Cost + Duty Cost + Transportation Cost

5. Gross Profit (Direct NPF)

```text
Total Sales − Total Expenses
```

6. Profit Margin

```text
(Gross Profit ÷ Total Sales) × 100
```

---

## Visualizations

The activity graph displays:

- Sales
- Expenses
- Net Profit

Default period:

```text
Last 12 Months
```

(configurable via `config.json`)

---

## Dynamic Date Filtering

The dashboard supports URL-driven preset filters including:

- 7D
- 30D
- 3M
- 6M
- 12M
- FY
- Custom

---

# Phase 4 – Search & Order Investigation

**Endpoint**

```http
GET /api/dashboard/search?q={query}
```

### Live Search

Users can search using:

- Etsy Order Number
- FedEx AWB Number

The search returns matching order and shipment information.

---

### Search Results

Results are displayed inside an interactive dropdown supporting:

- Loading states
- Keyboard navigation
- Click-outside support

---

### Order Details

Selecting a search result opens a detailed order page showing:

- Financial Metrics
- Shipment Information
- Order Details

The UI safely handles missing or invalid data.

---

# Phase 5 – Financial Report Export

The export workflow reads the active date range directly from the URL.

Example:

```text
from=2026-06-01
to=2026-06-30
```

---

# Scheduler Configuration

The inventory scheduler runs automatically every **6 hours** using the **Asia/Kolkata** timezone.

### Cron Expression

```text
0 */6 * * *
```

### Execution Times (IST)

- 12:00 AM
- 6:00 AM
- 12:00 PM
- 6:00 PM

# Amazia ERP Business Rules & Processing Guide

This document explains the core business rules, order processing logic, shipment mapping, cost allocation, and financial calculations used by Amazia ERP.

---

# Order Processing Logic

The Inventory Synchronization module processes Google Sheets data before it is stored in DuckDB. During this process, order IDs are normalized, quantities are aggregated, and material costs are calculated to ensure accurate downstream accounting and reporting.

---

## Inventory Order Normalization

Google Sheets often contain item-level order IDs with suffixes (for example, `-1`, `-2`). Since the dashboard and accounting engine operate at the **order level**, these suffixes are removed before processing.

### Example

| Original Order ID | Normalized Order ID |
| ----------------- | ------------------- |
| `4104705089-1`    | `4104705089`        |
| `4104705089-2`    | `4104705089`        |
| `4104705090-1`    | `4104705090`        |

---

## Quantity Aggregation

After normalization, all quantities belonging to the same Order ID are aggregated.

### Input

| Order ID       | Quantity |
| -------------- | -------: |
| `4104705089-1` |      3.1 |
| `4104705089-2` |      3.0 |
| `4104705090-1` |      2.5 |

### Aggregated Result

```json
{
  "4104705089": 6.1,
  "4104705090": 2.5
}
```

---

## Material Cost Calculation

Material cost is calculated after quantity aggregation.

### Current Rate

```text
1 Quantity = some multiplyer
```

### Formula

```text
Material Cost = Total Quantity × multiplyer
```

### Example

```text
Order Quantity = 6.1

Material Cost = 6.1 × ₹250

Material Cost = ₹1,525
```

---

# Order-to-AWB Mapping

Amazia ERP supports multiple shipment relationships between orders and Air Waybills (AWBs). This flexibility allows the system to correctly calculate shipping expenses for different logistics scenarios.

---

## Supported Mapping Relationships

### 1. One Order → One AWB

A single customer order is shipped using one AWB.

---

### 2. One Order → Multiple AWBs

A single order is fulfilled using multiple shipments.

---

### 3. One AWB → Multiple Orders

A single shipment contains multiple customer orders.

---

## Mapping Example

| Order ID     | AWB            |
| ------------ | -------------- |
| `4104705089` | `873549431322` |
| `4104705090` | `873549431322` |
| `4104705091` | `873549431322` |
| `4104705092` | `873549431400` |
| `4104705092` | `873549431401` |

This example demonstrates:

- **One AWB → Multiple Orders** (`873549431322`)
- **One Order → Multiple AWBs** (`4104705092`)

---

## Example API Response

### Endpoint

```http
GET /api/shipments/orders/4074621797
```

### Response

```json
{
  "data": {
    "orderNo": "4074621797",
    "awbNumbers": ["873549431322"],
    "shipments": [
      {
        "awbNumber": "873549431322",
        "processCode": "P_7104",
        "shippingStatus": "SHIPPED",
        "customerName": "Gretchen Dziadosz",
        "shippedAt": "2026-06-25T17:34:33.147Z",
        "orders": ["4074621797"]
      }
    ]
  }
}
```

---

# FedEx Shipping Cost Allocation

When multiple customer orders share the same shipment, Amazia ERP distributes the shipping cost equally across all mapped orders.

---

## Formula

```text
Allocated Shipping Cost =
Total AWB Cost ÷ Number of Orders Mapped to that AWB
```

---

## Example

### Shipment

| AWB            | Total Cost | Mapped Orders | Cost per Order |
| -------------- | ---------: | ------------: | -------------: |
| `873549431322` |       ₹600 |             3 |           ₹200 |

### Mapped Orders

- `4104705089`
- `4104705090`
- `4104705091`

### Result

```text
4104705089 → ₹200

4104705090 → ₹200

4104705091 → ₹200
```

---

# One Order with Multiple AWBs

Some customer orders are fulfilled using multiple shipments.

The total FedEx cost for that order is calculated by summing the allocated cost from every mapped AWB.

---

## Formula

```text
Order FedEx Cost =
Σ (AWB Cost ÷ Number of Orders Mapped to that AWB)
```

---

## Example

| AWB            | Total Cost | Orders Sharing AWB | Allocated Cost to Order `4104705092` |
| -------------- | ---------: | -----------------: | -----------------------------------: |
| `873549431400` |       ₹300 |                  1 |                                 ₹300 |
| `873549431401` |       ₹600 |                  3 |                                 ₹200 |

---

### Calculation

```text
Order 4104705092 FedEx Cost

= ₹300 + ₹200

= ₹500
```

---

### Final Result

```json
{
  "4104705092": 500
}
```

---

# Financial Calculations

The accounting engine combines Etsy sales, inventory costs, and FedEx expenses to calculate order profitability.

---

## Material Cost Formula

```text
Material Cost = Total Quantity × mutiplyer
```

---

## Allocated Shipping Cost Formula

```text
Allocated Shipping Cost =
Total AWB Cost ÷ Number of Orders Sharing that AWB
```

---

## Order FedEx Cost Formula

```text
Order FedEx Cost =
Σ (Allocated Shipping Cost)
```

---

## Net Profit Formula

```text
Net Profit =
Gross Sales
− Material Cost
− Duty Cost
− Transport Cost
```

---

## Profit Margin Formula

```text
Profit Margin (%) =
(Net Profit ÷ Gross Sales) × 100
```

---

# Business Rules Summary

The following business rules are enforced throughout the Amazia ERP platform:

- Order IDs are normalized by removing item-level suffixes.
- Quantities belonging to the same normalized order are aggregated.
- Material Cost is calculated using the configured cost per quantity.
- Orders and AWBs support one-to-one, one-to-many, and many-to-one relationships.
- Shipping costs are divided equally among all orders sharing an AWB.
- Orders shipped using multiple AWBs accumulate the allocated shipping cost from each shipment.
- Net Profit and Profit Margin are calculated using Etsy sales, material costs, and allocated FedEx expenses.
- All processed data is stored in DuckDB and used for dashboard reporting, search, and financial analytics.
