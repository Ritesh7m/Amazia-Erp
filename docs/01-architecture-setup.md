# Architecture, Setup & Database

## 1. System Architecture
Amazia ERP is built using a modern full-stack JavaScript ecosystem, with a focus on local, fast data processing for order reconciliation.

* **Frontend:** Next.js (App Router), React, Tailwind CSS
* **Backend:** Next.js Route Handlers (API), Node.js
* **Database:** DuckDB (Embedded file-based SQL database for rapid analytical queries)

## 2. Installation & Setup

### Prerequisites
* Node.js (v20 or higher)
* npm or yarn

### Environment Variables
Create a `.env.local` file in the root directory. This securely connects your app to Google Sheets for inventory syncing.
```env
GOOGLE_SHEET_ID="your_google_sheet_id_here"
GOOGLE_SHEET_TAB_NAME="DB"
GOOGLE_SERVICE_ACCOUNT_EMAIL="your_service_email@gserviceaccount.com"
GOOGLE_PRIVATE_KEY="your_private_key"
```
*(Note: Never commit your `.env.local` file to version control.)*

### Running the Application
The system requires both the Next.js server and the background scheduler to run simultaneously for live data syncing. Open two separate terminal windows:

```bash
# Install dependencies first
npm install

# Terminal 1: Start the Next.js Frontend & API
npm run dev

# Terminal 2: Start the Inventory Scheduler
npm run scheduler
```
## 3. Database Schema (DuckDB)

Amazia ERP uses **DuckDB**. Data imported from Etsy Statements, FedEx Billing CSVs, and Google Sheets Inventory is validated, normalized, and stored in DuckDB before being used by the Accounting Engine and Dashboard.

The core tables responsible for reconciliation include:

### **`etsy_statement`**
Stores sales transaction data imported from Etsy Statement CSV files.

**Key Fields:**

- `date` – Sale transaction date
- `type` – Transaction type (e.g., Sale)
- `order_no` – Extracted Etsy Order Number
- `net_amt` – Net sales amount
- `created_at` – Import timestamp

---

### **`fedex_billing`**
Stores shipping, duty, tax, and transportation expenses imported from FedEx Billing CSV files.

**Key Fields:**

- `invoice_type` – Invoice Type
- `invoice_date` – Invoice Date
- `due_date` – Due Date
- `awb_number` – Air Waybill Number
- `air_waybill_total_amount` – Air Waybill Total Amount
- `book_expense_cost` – Calculated by the application
- `created_at` – Import timestamp

---

### **`inventory_table`**
Stores normalized inventory data synchronized automatically from the **DB** worksheet of the configured Google Sheet.

**Source Columns:**

| Google Sheet Column | Field |
|---------------------|-------|
| B | Order ID |
| D | Material Type |
| E | Category |
| F | Color |
| G | Quantity |

The scheduler normalizes Order IDs, aggregates quantities, calculates material costs, and stores order-level inventory records in DuckDB.

---

### **`shipment_order_mapping`**
Maintains the relationship between Etsy Orders and FedEx Air Waybill (AWB) numbers, enabling accurate shipping cost allocation and financial reconciliation.

---

### **`sync_metadata`**
Tracks the last processed Google Sheet row and synchronization timestamp to support incremental inventory synchronization.

---

### **`import_history`**
Stores audit information for every Etsy and FedEx import, including processing time, imported rows, failed rows, and error details.