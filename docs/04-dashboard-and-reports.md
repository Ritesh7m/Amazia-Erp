---

# Database Architecture

Amazia ERP uses **DuckDB** as an embedded analytical database. All imported CSV files are parsed and stored in DuckDB tables. The dashboard, charts, reports, and search functionality retrieve data directly from these tables using SQL queries.

**Database File**

```text
database/AmaziaERP.db
```

---

# Database Tables

## 1. Etsy Statement (`etsy_statement`)

Stores all Etsy sales transactions.

| Column | Type | Description |
|---------|------|-------------|
| id | INTEGER | Primary Key |
| order_no | VARCHAR | Etsy Order Number |
| date | DATE | Sale Date |
| type | VARCHAR | Transaction Type |
| net_amt | DECIMAL(15,2) | Net Sales Amount |
| created_at | TIMESTAMP | Import Timestamp |

---

## 2. FedEx Billing (`fedex_billing`)

Stores FedEx shipping invoices.

| Column | Type | Description |
|---------|------|-------------|
| id | INTEGER | Primary Key |
| invoice_type | VARCHAR | Duty/Tax or Transport |
| invoice_date | DATE | Invoice Date |
| due_date | DATE | Due Date |
| awb_number | VARCHAR | Air Waybill Number |
| air_waybill_total_amount | DECIMAL(15,2) | Invoice Amount |
| book_expense_cost | DECIMAL(15,2) | Shipping Expense |
| created_at | TIMESTAMP | Import Timestamp |

---

## 3. Inventory Table (`inventory_table`)

Stores synchronized inventory data.

| Column | Type | Description |
|---------|------|-------------|
| id | BIGINT | Primary Key |
| order_no | VARCHAR | Etsy Order Number |
| material_type | VARCHAR | Material Type |
| category | VARCHAR | Category |
| color | VARCHAR | Product Color |
| quantity | DOUBLE | Material Quantity |
| created_at | TIMESTAMP | Created Time |
| updated_at | TIMESTAMP | Updated Time |

---

## 4. Import History (`import_history`)

Stores CSV upload history.

| Column | Type | Description |
|---------|------|-------------|
| id | INTEGER | Primary Key |
| file_name | VARCHAR | Uploaded File |
| file_hash | VARCHAR | Duplicate Detection |
| file_size | INTEGER | File Size |
| invoice_type | VARCHAR | ETSY / FEDEX |
| total_rows | INTEGER | Total CSV Rows |
| imported_rows | INTEGER | Imported Rows |
| failed_rows | INTEGER | Failed Rows |
| processing_time | INTEGER | Processing Time |
| status | VARCHAR | SUCCESS / FAILED |
| created_at | TIMESTAMP | Upload Time |

---

## 5. Sync Metadata (`sync_metadata`)

Tracks inventory synchronization.

| Column | Type | Description |
|---------|------|-------------|
| sync_name | VARCHAR | Sync Name |
| last_processed_row | INTEGER | Last Synced Row |
| last_sync_at | TIMESTAMP | Last Sync Time |

---

# Database Relationships

```text
                    Shipment API
                          │
                          ▼
                 Order Number ↔ AWB Number
                          │
        ┌─────────────────┴────────────────┐
        │                                  │
        ▼                                  ▼
 etsy_statement                     fedex_billing
   (Sales Data)                  (Shipping Expenses)
        │
        ▼
 inventory_table
(Material Consumption)
```

---

# Dashboard SQL Queries

## Total Sales

Calculates total sales within a selected date range.

```sql
SELECT
    COALESCE(SUM(net_amt), 0) AS total_sales
FROM etsy_statement
WHERE date >= ?
  AND date <= ?;
```

---

## Total FedEx Expenses

Calculates total FedEx shipping expenses.

```sql
SELECT
    COALESCE(SUM(book_expense_cost), 0) AS total_fedex
FROM fedex_billing
WHERE invoice_date >= ?
  AND invoice_date <= ?;
```

---

## Total Material Cost

Material cost is calculated using the inventory quantity and the configured material cost rate.

```sql
SELECT
    COALESCE(SUM(i.quantity * ?), 0) AS total_material_cost
FROM etsy_statement e
JOIN inventory_table i
ON e.order_no = i.order_no
WHERE e.date >= ?
AND e.date <= ?;
```

---

## Monthly Sales

Used by the Business Performance chart.

```sql
SELECT
    strftime(date, '%Y-%m') AS month,
    SUM(net_amt) AS total
FROM etsy_statement
WHERE date >= ?
AND date <= ?
GROUP BY month
ORDER BY month;
```

---

## Monthly FedEx Expenses

```sql
SELECT
    strftime(invoice_date, '%Y-%m') AS month,
    SUM(book_expense_cost) AS total
FROM fedex_billing
WHERE invoice_date >= ?
AND invoice_date <= ?
GROUP BY month
ORDER BY month;
```

---

## Monthly Material Cost

```sql
SELECT
    strftime(e.date, '%Y-%m') AS month,
    SUM(i.quantity * ?) AS total
FROM etsy_statement e
JOIN inventory_table i
ON e.order_no = i.order_no
WHERE e.date >= ?
AND e.date <= ?
GROUP BY month
ORDER BY month;
```

---

## Recent Orders

```sql
SELECT
    e.order_no,
    e.date,
    e.net_amt,
    SUM(i.quantity * ?) AS material_cost
FROM etsy_statement e
LEFT JOIN inventory_table i
ON e.order_no = i.order_no
GROUP BY
    e.order_no,
    e.date,
    e.net_amt
ORDER BY e.date DESC
LIMIT ? OFFSET ?;
```

---

## Inventory Sync Status

```sql
SELECT
    sync_name,
    last_sync_at
FROM sync_metadata;
```

---

## Import History

```sql
SELECT
    invoice_type,
    MAX(created_at) AS last_import_at
FROM import_history
WHERE status = 'SUCCESS'
GROUP BY invoice_type;
```

---

# Financial Calculation Engine

The dashboard computes all financial metrics using imported data.

## Sales

```text
Sales = SUM(etsy_statement.net_amt)
```

## Material Cost

```text
Material Cost = SUM(quantity × MATERIAL_COST_RATE)
```

## Duty Cost

```text
Duty Cost = SUM(book_expense_cost WHERE invoice_type = 'Duty/Tax')
```

## Transportation Cost

```text
Transportation Cost = SUM(book_expense_cost WHERE invoice_type = 'Transport')
```

## Total Expenses

```text
Total Expenses =
Material Cost
+ Duty Cost
+ Transportation Cost
```

## Net Profit

```text
Net Profit =
Sales
- Material Cost
- Duty Cost
- Transportation Cost
```

---

# Data Processing Workflow

```text
                Etsy Statement CSV
                        │
                        ▼
               Parse & Validate CSV
                        │
                        ▼
              Store in etsy_statement
                        │
                        │
               FedEx Billing CSV
                        │
                        ▼
               Parse & Validate CSV
                        │
                        ▼
             Store in fedex_billing
                        │
                        │
           Inventory Synchronization
                        │
                        ▼
            Update inventory_table
                        │
                        ▼
              Shipment API Mapping
         (Order Number ↔ AWB Number)
                        │
                        ▼
          Financial Calculation Engine
         ├── Sales
         ├── Material Cost
         ├── Duty Cost
         ├── Transportation Cost
         └── Net Profit
                        │
                        ▼
             Dashboard KPIs & Charts
                        │
                        ▼
         Search, Reports & CSV Export
```