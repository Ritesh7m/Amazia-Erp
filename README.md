# Amazia ERP

Amazia ERP is a full-stack ERP platform for **billing, inventory management, shipment reconciliation, and financial analytics**. It imports Etsy sales statements, FedEx billing invoices, synchronizes inventory from Google Sheets, and calculates order-level profitability using an embedded DuckDB database.

---

# Features

- 📄 Etsy Statement CSV Import
- 📦 FedEx Billing CSV Import
- 📊 Google Sheets Inventory Synchronization
- 🔄 Automated Accounting & Reconciliation
- 🔗 Order ↔ AWB Mapping
- 💰 Net Profit & Profit Margin Calculation
- 📈 Business Performance Dashboard
- 📉 Expense Breakdown Analytics
- 🔍 Order & AWB Search
- 📤 Financial Report Export (CSV)
- 🦆 DuckDB Embedded Database
- ⏰ Automated Inventory Scheduler

---

# Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | Next.js (App Router) |
| Backend | Next.js Route Handlers |
| Language | TypeScript |
| Database | DuckDB |
| Styling | Tailwind CSS |
| CSV Parsing | csv-parser |
| Scheduler | Node Cron |
| Inventory Source | Google Sheets API |

---

# Core Architecture

```text
                        AMAZIA ERP
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
        ▼                                         ▼
 Next.js Web Application                Inventory Scheduler
      npm run dev                       npm run scheduler
        │                                         │
        ├── Dashboard                            ├── Runs every 6 hours
        ├── Upload Interface                     ├── Reads Google Sheets
        ├── Etsy Import API                      ├── Reads only new rows
        ├── FedEx Import API                     ├── Normalizes Order IDs
        ├── Dashboard APIs                       ├── Aggregates Quantities
        ├── Search APIs                          └── Saves data to DuckDB
        ├── Shipment Mapping
        ├── Financial Reports
        └── DuckDB Reads/Writes
                         │
                         ▼
                      DuckDB
```

---

# Project Structure

```text
AMAZIA-ERP/
│
├── app/                    # Next.js App Router
│   ├── api/                # Backend APIs
│   ├── dashboard/          # Dashboard Pages
│   └── upload/             # Upload Pages
│
├── components/             # Reusable UI Components
├── constants/              # Global Constants
├── database/               # DuckDB Database
├── lib/                    # SQL Queries & Business Logic
├── public/                 # Static Assets
├── services/               # Importers & Google Sheets Sync
├── types/                  # TypeScript Types
├── utils/                  # Helper Utilities
├── docs/                   # Project Documentation
│
├── package.json
└── README.md
```

---

# Database

Amazia ERP uses **DuckDB** as its embedded analytical database.

### Core Tables

- `etsy_statement`
- `fedex_billing`
- `inventory_table`
- `shipment_order_mapping`
- `sync_metadata`
- `import_history`

For complete database schema and table documentation, refer to:

**`docs/01-architecture-setup.md`**

---

# Getting Started

## 1. Clone the Repository

```bash
git clone <repository-url>
cd AMAZIA-ERP
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Create a `.env.local` file in the project root.

Example:

```env
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key
CRON_SECRET=your_secure_random_secret
```

---

## 4. Run the Development Server

```bash
npm run dev
```

Open your browser:

```
http://localhost:3000
```

---

## 5. Run the Inventory Scheduler

The inventory scheduler synchronizes Google Sheets inventory into DuckDB.

```bash
npm run scheduler
```

---

## 6. Production Build

Build the application:

```bash
npm run build
```

Run the production server:

```bash
npm start
```

---

# Available Scripts

| Command | Description |
|----------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm run scheduler` | Start the inventory synchronization scheduler |

---

# Manual Scheduler Trigger

The inventory synchronization can also be triggered manually using a secure API endpoint protected by the `CRON_SECRET`.

## Generate a Secure Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the generated value to your `.env.local` file:

```env
CRON_SECRET=your_generated_secret
```

## Trigger Inventory Sync

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
http://localhost:3000/api/inventory/sync
```

---

# Shipment Mapping Endpoint

Dummy endpoint used to generate Order ↔ AWB mappings.

### Request

```bash
curl -X POST http://localhost:3000/api/shipments/sync
```

### Sample Response

```json
{
  "success": true,
  "message": "Successfully mapped 6 AWB connections to orders in the database."
}
```

---

# Documentation

Complete project documentation is available inside the **docs/** directory.

| Document | Description |
|----------|-------------|
| `01-architecture-setup.md` | Architecture, Installation, Project Structure & Database |
| `02-data-ingestion.md` | Etsy, FedEx & Google Sheets Import Process |
| `03-accounting.md` | Accounting Engine & Reconciliation |
| `04-dashboard-and-reports.md` | Dashboard Features & Reports |
| `05-api-reference.md` | REST API Endpoints & Sample Responses |
| `06-deployment.md` | Deployment, Environment Variables & Troubleshooting |

---

# License

This project is intended for **internal business use** and **financial reconciliation** within the Amazia ERP platform.