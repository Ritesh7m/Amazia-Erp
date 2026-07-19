# Dashboard & User Interface

The Amazia ERP frontend is built using **Next.js App Router** and provides a responsive dashboard for importing business data, monitoring financial performance, searching orders, and exporting reports.

---

# Dashboard Modules

## Dashboard Overview (`/`)

Displays real-time business metrics and analytics.

### Features

- KPI Summary Cards
- Business Performance Chart
- Expense Breakdown
- Order & AWB Search
- Financial Report Export
- Inventory Sync Status

---

## Etsy Statement Import

Upload Etsy Statement CSV files.

**API**

```http
POST /api/import/etsy
```

**Response**

```json
{
  "success": true,
  "totalRows": 40,
  "saleRows": 5,
  "importedRows": 5,
  "failedRows": 0,
  "processingTime": "0.02 sec"
}
```

---

## FedEx Billing Import

Upload FedEx Billing CSV files.

**API**

```http
POST /api/import/fedex
```

**Response**

```json
{
  "success": true,
  "totalRows": 1282,
  "importedRows": 1282,
  "failedRows": 0,
  "processingTime": "2.75 sec"
}
```

---

## Dashboard Summary

Displays overall financial KPIs.

**API**

```http
GET /api/dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Example Response**

```json
{
  "totalSales": 125000,
  "materialCost": 32500,
  "duty": 4200,
  "transportation": 7800,
  "totalExpenses": 44500,
  "netProfit": 80500,
  "profitMargin": 64.4
}
```

---

## Order & AWB Search

Search using either an Etsy Order Number or an Air Waybill Number.

**API**

```http
GET /api/dashboard/search?q={query}
```

---

## Shipment Details

Returns shipment information for an Etsy Order.

**API**

```http
GET /api/shipments/orders/{orderNo}
```

**Example Response**

```json
{
  "data": {
    "orderNo": "4074621797",
    "awbNumbers": ["873549431322"]
  }
}
```

---

## Financial Report Export

Exports the filtered financial report as CSV.

**API**

```http
GET /api/dashboard/export?from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Response**

```text
Content-Type: text/csv
```

---

# UI Components

- KPI Summary Cards
- Business Performance Charts
- Expense Breakdown Charts
- Order & AWB Search
- Data Tables
- CSV Upload Components
- Date Range Filters
- Toast Notifications
- Export Button

---

# Dashboard Workflow

```text
Upload Etsy Statement
        │
        ▼
Upload FedEx Billing
        │
        ▼
Inventory Synchronization
        │
        ▼
Accounting Engine
        │
        ▼
Dashboard KPIs & Charts
        │
        ▼
Search & Export Reports
```