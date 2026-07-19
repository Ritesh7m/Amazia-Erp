# API Reference

Amazia ERP exposes a set of REST APIs for importing data, retrieving dashboard analytics, searching orders and shipments, synchronizing inventory, and exporting financial reports.

---

# Import APIs

These endpoints import and process external data into DuckDB.

## 1. Import FedEx Billing CSV

**Endpoint**

```http
POST /api/import/fedex
```

**Content-Type**

```text
multipart/form-data
```

**Purpose**

Imports FedEx Billing CSV files, validates the data, calculates Book Expense Cost, and stores normalized records in the `fedex_billing` table.

**Response**

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

## 2. Import Etsy Statement CSV

**Endpoint**

```http
POST /api/import/etsy
```

**Content-Type**

```text
multipart/form-data
```

**Purpose**

Imports Etsy Statement CSV files, extracts Order Numbers, normalizes data, and stores processed records in the `etsy_statement` table.

**Response**

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

# Dashboard APIs

These endpoints provide business analytics for the dashboard.

---

## 1. Dashboard Summary

**Endpoint**

```http
GET /api/dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Purpose**

Returns dashboard KPI metrics including:

- Total Sales
- Material Cost
- Duty Cost
- Transportation Cost
- Total Expenses
- Net Profit
- Profit Margin

---

## 2. Business Performance

**Endpoint**

```http
GET /api/dashboard/performance?from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Purpose**

Returns time-series data for the Business Performance chart.

Typical metrics include:

- Sales
- Expenses
- Net Profit

---

## 3. Expense Breakdown

**Endpoint**

```http
GET /api/dashboard/expense-breakdown?from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Purpose**

Returns categorized expense distribution for:

- Material Cost
- Duty
- Transportation

---

## 4. Recent Activity

**Endpoint**

```http
GET /api/dashboard/activity
```

**Purpose**

Returns recent dashboard activities, imports, and synchronization events.

---

## 5. Dashboard Search

**Endpoint**

```http
GET /api/dashboard/search?q={query}
```

**Purpose**

Provides debounced search across:

- Etsy Order Numbers
- FedEx Air Waybill (AWB) Numbers

Supports partial matching for fast order lookup.

---

## 6. Dashboard Sync Status

**Endpoint**

```http
GET /api/dashboard/sync-status
```

**Purpose**

Returns the latest inventory synchronization status including:

- Last Sync Time
- Last Processed Row
- Scheduler Status

---

## 7. Financial Report Export

**Endpoint**

```http
GET /api/dashboard/export?from=YYYY-MM-DD&to=YYYY-MM-DD
```

**Purpose**

Generates a downloadable financial report as an Excel-safe CSV.

**Response**

```text
Content-Type: text/csv
```

The exported report includes:

- Sales
- Material Cost
- Duty
- Transportation
- Total Expenses
- Net Profit
- Profit Margin

---

# Shipment APIs

These APIs provide Order ↔ AWB relationship information.

---

## 1. Shipment Mapping by Order

**Endpoint**

```http
GET /api/shipments/orders/{orderNo}
```

**Purpose**

Returns all Air Waybill Numbers (AWBs) mapped to a specific Etsy Order.

**Example Response**

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

## 2. Shipment Details by AWB

**Endpoint**

```http
GET /api/shipments/awb/{awbNumber}
```

**Purpose**

Returns shipment details and all associated Etsy Orders for the specified Air Waybill Number.

---

## 3. Shipment Synchronization

**Endpoint**

```http
GET /api/shipments/sync
```

**Purpose**

Triggers or retrieves the latest shipment synchronization status, depending on the implementation.

---

# Inventory APIs

---

## Inventory Synchronization

**Endpoint**

```http
GET /api/inventory/sync
```

**Purpose**

Runs the Google Sheets inventory synchronization process.

The synchronization process:

- Reads newly added Google Sheet rows
- Normalizes Order IDs
- Aggregates quantities
- Calculates Material Cost
- Updates DuckDB
- Records synchronization metadata

---

# Common Response Format

Successful API responses generally follow this structure:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully."
}
```

Validation or processing errors return:

```json
{
  "success": false,
  "errors": [
    "Error description"
  ]
}
```

---

# API Summary

| Module | Method | Endpoint | Description |
|---------|--------|----------|-------------|
| Import | POST | `/api/import/etsy` | Import Etsy Statement CSV |
| Import | POST | `/api/import/fedex` | Import FedEx Billing CSV |
| Dashboard | GET | `/api/dashboard/summary` | Dashboard KPI metrics |
| Dashboard | GET | `/api/dashboard/performance` | Business performance chart |
| Dashboard | GET | `/api/dashboard/expense-breakdown` | Expense distribution |
| Dashboard | GET | `/api/dashboard/activity` | Recent dashboard activity |
| Dashboard | GET | `/api/dashboard/search` | Order & AWB search |
| Dashboard | GET | `/api/dashboard/export` | Export financial report |
| Dashboard | GET | `/api/dashboard/sync-status` | Inventory sync status |
| Shipments | GET | `/api/shipments/orders/{orderNo}` | Shipment details by Order |
| Shipments | GET | `/api/shipments/awb/{awbNumber}` | Shipment details by AWB |
| Shipments | GET | `/api/shipments/sync` | Shipment synchronization |
| Inventory | GET | `/api/inventory/sync` | Google Sheets inventory synchronization |