# Deployment & Configuration

This file outlines environment requirements and best practices for running Amazia ERP in production.

## 1. Environment Configuration
Create a `.env.local` file at the root. **Never commit this file to GitHub.**

```env
GOOGLE_SHEET_ID="your_google_sheet_id"
GOOGLE_SHEET_TAB_NAME="DB"
GOOGLE_SERVICE_ACCOUNT_EMAIL="your_service_account_email"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

## 2. Production Build
To prepare for deployment:
```bash
# Create production build
npm run build

# Start the application
npm run start
```
*Note: Ensure the inventory scheduler process is running on your production server via a process manager like PM2 or Systemd.*

## 3. Troubleshooting
* **Database Locking:** DuckDB is an embedded database. Ensure no other process (like DBeaver or another script) is holding an exclusive lock on `database/AmaziaERP.db` during runtime.
* **AWB Formatting:** Always ensure exported CSVs use the `="AWB_NUMBER"` format to prevent Excel from converting tracking numbers into scientific notation.
* **Process Separation:** The Next.js server and the Inventory Scheduler are two separate processes. If your dashboard data is stale, check if the `npm run scheduler` process is running.