# Amazia ERP System Guide

 Project Introduction -> The **`Amazia ERP system`** is a web-based application designed to automate two critical business operations:

 1. **`Billing Import`** --> Imports billing statements from providers such as FedEx and Etsy, validates and normalizes the data, prevents duplicate imports using SHA-256 hashing, and stores the processed records in DuckDB. 

 2. **`Inventory Synchronization`** --> Automatically synchronizes inventory data from Google Sheets into DuckDB using a scheduler. Instead of re-reading the entire sheet, the scheduler processes only newly added rows using a lastProcessedRow checkpoint, ensuring efficient incremental synchronization.

 # High-Level System Overview

                     Amazia ERP
                         │
      ┌──────────────────┴──────────────────┐
      │                                     │
      ▼                                     ▼
 Billing Import Module          Inventory Sync Module
      │                                     │
      ▼                                     ▼
 Parse & Validate CSV          Read New Google Sheet Rows
      │                                     │
      ▼                                     ▼
 Normalize Data               Normalize & Aggregate
      │                                     │
      ▼                                     ▼
      DuckDB Database (Single Source of Truth)
                         │
                         ▼
              Dashboard & Reporting

# Root Directory Structure
Amazia-ERP/
│
├── app/
├── components/
├── constants/
├── database/
├── services/
├── types/
├── utils/
│
├── .env.local
├── .gitignore
├── eslint.config.mjs
├── instrumentation.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── README.md
└── tsconfig.json

# Technology Stack

1. DuckDB-> Stores all billing and inventory data locally and serves as the primary reporting database.
2. Google APIs-> Reads inventory data from Google Sheets during synchronization.
3. node-cron-> Executes the inventory synchronization scheduler at predefined intervals.
4. csv-parser-> Parses uploaded CSV files from different billing providers.
5. dayjs-> Handles date parsing and formatting throughout the application.
6. Zod-> Validates request payloads and user input.
7. Sonner-> Displays success, warning, and error notifications in the user interface.
8. React Hook Form-> Manages form handling in the upload interface.



# Directory Structure & Responsibilities

    1. app/api/: Backend API endpoints.
      -->import/etsy/route.ts & import/fedex/route.ts: Dedicated routes for handling data ingestion from Etsy and FedEx.
      -->inventory/sync/route.ts: Endpoint for triggering inventory synchronization.

    2. components/: Contains reusable UI elements, notably the UploadCard.tsx in the upload directory.

    3. database/: Stores the local AmaziaERP.db file and its main entry point (index.ts).

    4. services/: Contains the core business logic responsible for parsing, importing, processing, and synchronizing data across the application.

# 3. database/: these are the tables in the database 
    --> etsy_statement
    --> fedex_billing
    --> import_history
    --> inventory_table
    --> sync_metadata 
1. See all Etsy statement records
SELECT
    id,
    order_no,
    date,
    type,
    net_amt
FROM etsy_statement
ORDER BY date DESC;

2. See all FedEx billing records
SELECT
    id,
    invoice_type,
    invoice_date,
    due_date,
    awb_number,
    air_waybill_total_amount,
    book_expense_cost
FROM fedex_billing
ORDER BY invoice_date DESC;

3. See all inventory records
SELECT
    id,
    order_no,
    material_type,
    category,
    color,
    quantity,
    updated_at
FROM inventory_table
ORDER BY updated_at DESC;

4. See all import history
SELECT
    id,
    file_name,
    invoice_type,
    status,
    total_rows,
    imported_rows,
    failed_rows,
    processing_time,
    created_at
FROM import_history
ORDER BY created_at DESC;

5. View inventory synchronization status
SELECT
    sync_name,
    last_processed_row,
    last_sync_at
FROM sync_metadata;

# Quick Troubleshooting Map
| Problem                     | First table to check           |
| --------------------------- | ------------------------------ |
| File not importing          | `import_history`               |
| Duplicate file upload       | `import_history` (`file_hash`) |
| Import partially completed  | `import_history`               |
| Missing FedEx invoice       | `fedex_billing`                |
| Incorrect AWB billing       | `fedex_billing`                |
| Missing Etsy transaction    | `etsy_statement`               |
| Incorrect Etsy order amount | `etsy_statement`               |
| Inventory not updated       | `inventory_table`              |
| Duplicate inventory record  | `inventory_table`              |
| Inventory sync stopped      | `sync_metadata`                |
| Sync resumed from wrong row | `sync_metadata`                |

# If you only remember one thing:

import_history tracks every file import and its processing status.
fedex_billing stores imported FedEx invoice and shipping cost details.
etsy_statement stores imported Etsy transaction records.
inventory_table is the primary inventory dataset used by the application.
sync_metadata tracks inventory synchronization progress and enables incremental syncs.

# For most debugging:

Start with import_history to verify the file was imported successfully.
Check fedex_billing or etsy_statement to confirm the imported data exists.
Verify inventory_table if inventory values appear incorrect or missing.
Finally, check sync_metadata if inventory synchronization did not complete or resumed from an unexpected row.

    # 4 services/: 
    etsyImporter.ts: Handles the import workflow for Etsy statement files, including validation, parsing, and database insertion.





