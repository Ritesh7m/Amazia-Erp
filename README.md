# Amazia ERP

Amazia ERP is a full-stack ERP platform for billing, inventory management, shipment reconciliation, and financial analytics. It imports Etsy sales statements, FedEx billing invoices, synchronizes inventory from Google Sheets, and calculates order-level profitability using an embedded DuckDB database.

---

# Features

- Etsy Statement CSV Import
- FedEx Billing CSV Import
- Google Sheets Inventory Synchronization
- Automated Accounting & Reconciliation
- Order ↔ AWB Mapping
- Net Profit & Profit Margin Calculation
- Business Performance Dashboard
- Expense Breakdown Analytics
- Order & AWB Search
- Financial Report Export (CSV)
- DuckDB Embedded Database
- Inventory Scheduler

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

# Getting Started

## Clone the Repository

```bash
git clone <repository-url>
```

```bash
cd AMAZIA-ERP
```

---

## Install Dependencies

```bash
npm install
```

---

## Configure Environment Variables

Create a `.env.local` file.

Example:

```env
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key
```

---

## Run Development Server

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

---

## Run Inventory Scheduler

The inventory scheduler synchronizes Google Sheets inventory into DuckDB.

```bash
npm run scheduler
```

---

## Build for Production

```bash
npm run build
```

```bash
npm start
```

---

# Project Structure

```text
AMAZIA-ERP/
│
├── app/                    # Next.js App Router
│   ├── api/                # Backend APIs
│   ├── dashboard/          # Dashboard pages
│   └── upload/             # Upload pages
│
├── components/             # Reusable UI Components
│
├── config/                 # Application Configuration
│
├── constants/              # Global Constants
│
├── database/               # DuckDB Database
│
├── lib/                    # SQL Queries & Business Logic
│
├── public/                 # Static Assets
│
├── services/               # Importers & Google Sheets Sync
│
├── types/                  # TypeScript Types
│
├── utils/                  # Helper Utilities
│
├── docs/                   # Project Documentation
│
├── package.json
└── README.md
```

---

# Documentation

The complete documentation is available in the **docs/** directory.

| Document | Description |
|----------|-------------|
| [01-architecture-setup.md](docs/01-architecture-setup.md) | Architecture, Installation, Project Structure & Database |
| [02-data-ingestion.md](docs/02-data-ingestion.md) | Etsy, FedEx & Google Sheets Import Process |
| [03-accounting.md](docs/03-accounting.md) | Accounting Engine & Reconciliation |
| [04-dashboard-and-reports.md](docs/04-dashboard-and-reports.md) | Dashboard Features & Reports |
| [05-api-reference.md](docs/05-api-reference.md) | REST API Endpoints & Sample Responses |
| [06-deployment.md](docs/06-deployment.md) | Deployment, Environment Variables & Troubleshooting |

---

# Database

Amazia ERP uses **DuckDB** as its embedded analytical database.

Core tables include:

- `etsy_statement`
- `fedex_billing`
- `inventory_table`
- `shipment_order_mapping`
- `sync_metadata`
- `import_history`

Detailed schema documentation is available in **01-architecture-setup.md**.

---

# Available Scripts

```bash
npm run dev          # Start development server

npm run build        # Production build

npm start            # Run production server

npm run scheduler    # Start inventory synchronization
```

---

# License

This project is intended for internal business use and financial reconciliation within the Amazia ERP platform.