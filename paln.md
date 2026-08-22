Act as a Senior Next.js / TypeScript / DuckDB Production Engineer and Codebase Architect.

The Amazia ERP project is now functionally complete.

I want you to perform a COMPLETE PRODUCTION CLEANUP and RESTRUCTURING of the entire project.

IMPORTANT:

DO NOT blindly delete files.

First inspect the entire repository and understand how the application works.

Your goal is:

1. Remove legacy code
2. Remove unused files
3. Remove unused components
4. Remove unused API routes
5. Remove obsolete services
6. Remove test/debug files that are no longer required
7. Remove duplicate implementations
8. Remove abandoned migration scripts
9. Remove unnecessary database scripts
10. Remove temporary development files
11. Organize the remaining project into a clean production-ready structure
12. Preserve every currently working feature

============================================================
CURRENT APPLICATION
============================================================

This is a Next.js App Router ERP application using:

- Next.js
- TypeScript
- DuckDB
- API routes
- Server-side services
- React components
- Environment configuration
- Etsy Statement import
- Inventory Sheet sync
- FedEx Billing import
- FedEx shipment/order ↔ AWB mapping
- Order-level FedEx cost allocation
- Dashboard
- Order search
- Order Details modal
- Financial calculations
- Database views
- Database backup system
- Scheduled sync/backup jobs

The application is production-ready functionally.

DO NOT break any of these features.

============================================================
PHASE 1 — FULL REPOSITORY AUDIT
============================================================

Before deleting anything, recursively inspect the entire repository.

Inspect:

- app/
- components/
- lib/
- services/
- database/
- scripts/
- config/
- public/
- types/
- utils/
- api/
- backups/
- migrations/
- tests/
- __tests__/
- docs/
- dev/
- import/
- reset scripts
- migration folders
- temporary folders
- root-level files

Also inspect:

- package.json
- package-lock.json
- tsconfig.json
- next.config.*
- eslint config
- prettier config
- postcss config
- Tailwind config
- .env files
- .gitignore
- README
- Docker files if present
- deployment files
- cron/scheduler registration
- database initialization
- database migration code
- backup code

Do NOT modify anything during the first audit.

============================================================
PHASE 2 — BUILD DEPENDENCY MAP
============================================================

For every candidate file, determine:

1. Is it imported anywhere?
2. Is it dynamically imported?
3. Is it referenced by an API route?
4. Is it referenced by a cron/scheduler?
5. Is it referenced by package.json scripts?
6. Is it referenced by database initialization?
7. Is it referenced by migrations?
8. Is it referenced by deployment configuration?
9. Is it referenced by environment configuration?
10. Is it required at runtime even if not imported directly?
11. Is it a database view/query dependency?
12. Is it required by another production service?

Use repository-wide search.

Do NOT rely only on filename.

============================================================
PHASE 3 — CLASSIFY EVERY FILE
============================================================

Classify each file as exactly one of:

A. REQUIRED — production runtime

B. REQUIRED — configuration

C. REQUIRED — database/schema/migration

D. REQUIRED — deployment/operations

E. OPTIONAL — documentation

F. LEGACY — safe to remove

G. UNUSED — safe to remove

H. TEST/DEBUG — safe to remove

I. DUPLICATE — safe to consolidate/remove

J. UNKNOWN — DO NOT DELETE

Anything classified as UNKNOWN must remain until proven unnecessary.

============================================================
PHASE 4 — PROTECT CRITICAL FILES
============================================================

Before cleanup, identify and protect:

- production API routes
- dashboard APIs
- order details APIs
- Etsy services
- FedEx services
- Inventory services
- database initialization
- database schema
- database views
- backup service
- scheduler
- authentication
- environment configuration
- shared utilities
- financial calculation logic

Do not remove anything merely because it appears unused.

============================================================
PHASE 5 — REMOVE LEGACY / TEST / DEBUG CODE
============================================================

Remove only files proven to be unused.

Examples of things to investigate:

- old test endpoints
- dummy endpoints
- temporary API routes
- manual debugging scripts
- console/debug utilities
- abandoned migration scripts
- old database reset scripts
- experimental folders
- duplicate services
- old FedEx implementation
- old Etsy implementation
- obsolete import implementation
- temporary CSV processors
- unused components
- unused hooks
- unused utilities
- unused types
- old views
- obsolete scripts
- development-only files
- temporary JSON files
- temporary CSV files
- test database files
- old backup copies committed into source control

DO NOT delete production backups automatically.

First determine whether the backup directory is runtime-generated or source-controlled.

============================================================
PHASE 6 — DATABASE CLEANUP
============================================================

Inspect the actual DuckDB schema and all database initialization code.

Current important production entities include:

- etsy_sales
- etsy_expenses
- etsy_allocation_batches
- etsy_order_allocations
- fedex_billing
- inventory_table
- order_awb_mapping

and production financial views such as:

- v_order_etsy_allocations
- v_order_etsy_expenses
- v_order_fedex_cost
- v_order_financials
- v_order_material_cost
- v_order_refunds
- v_order_sales

DO NOT delete any table/view until you verify:

1. No production code references it.
2. No view depends on it.
3. No API depends on it.
4. No calculation depends on it.
5. No migration recreates it intentionally.

Previously we encountered obsolete/duplicate concepts such as:

- etsy_statement
- import_history
- sync_metadata
- older import logic

Do NOT assume they are safe simply because they were previously considered unnecessary.

Verify the CURRENT codebase first.

If a table is no longer needed:

- remove its creation code
- remove its migration if obsolete
- remove code referencing it
- remove the table only if appropriate
- update dependent views/services

Do not leave code that recreates deleted tables when the application starts.

============================================================
PHASE 7 — DATABASE INITIALIZATION
============================================================

This is extremely important.

The application must have ONE clear database initialization path.

Find where DuckDB is initialized.

Find where tables are created.

Find where views are created.

Find where migrations are executed.

Remove duplicate initialization paths.

The following must NOT happen:

npm run dev

→ creates obsolete tables

→ creates duplicate tables

→ creates old Etsy tables

→ recreates deleted structures

There should be one authoritative schema/initialization strategy.

============================================================
PHASE 8 — FOLDER STRUCTURE
============================================================

After auditing, reorganize the project into a clean structure appropriate for Next.js App Router.

Use a structure similar to:

app/
├── api/
│   ├── dashboard/
│   ├── etsy/
│   ├── fedex/
│   ├── inventory/
│   └── ...
├── dashboard/
│   └── page.tsx
├── layout.tsx
└── page.tsx

components/
├── dashboard/
├── orders/
├── search/
├── upload/
├── sync/
└── ui/

lib/
├── db/
├── auth/
├── calculations/
├── validation/
└── utils/

services/
├── etsy/
├── fedex/
├── inventory/
├── backup/
└── sync/

database/
├── schema/
├── views/
├── migrations/
└── seeds/

scripts/
├── database/
├── maintenance/
└── deployment/

types/
└── ...

config/
└── ...

public/
└── ...

Do NOT blindly force this exact structure.

Use the existing architecture where appropriate.

The important requirement is:

CLEAR SEPARATION OF RESPONSIBILITIES.

============================================================
PHASE 9 — FEDEx STRUCTURE
============================================================

Ensure FedEx functionality is organized cleanly.

There should be a clear separation between:

1. CSV import
2. FedEx billing persistence
3. Shipment API authentication
4. Shipment API request
5. Order ↔ AWB mapping
6. AWB cost calculation
7. Order-level FedEx allocation
8. Reconciliation
9. Dashboard/order-details consumption

Do not keep old FedEx shipment implementations if they have been replaced.

Do not maintain two different FedEx mapping implementations.

============================================================
PHASE 10 — ETSY STRUCTURE
============================================================

Ensure Etsy functionality has one authoritative implementation.

Separate:

- CSV import
- sales
- expenses
- allocation
- refunds
- financial views

Remove abandoned Etsy statement/import implementations only after dependency verification.

============================================================
PHASE 11 — INVENTORY STRUCTURE
============================================================

Ensure Inventory Sheet sync has one implementation.

Remove:

- old sync code
- duplicate Google Sheet clients
- old import scripts
- unused parsers

only after dependency verification.

============================================================
PHASE 12 — BACKUP SYSTEM
============================================================

Inspect the backup implementation.

Ensure:

- backup service has one implementation
- scheduler has one implementation
- retention logic has one implementation
- DuckDB checkpoint handling is correct
- temporary backup files are not committed to source control

Previously we had:

EBUSY: resource busy or locked

during:

DuckDB checkpoint + database copy.

Do NOT ignore this.

If the current backup implementation still contains the unsafe copy logic, fix it as part of production cleanup.

The backup system must not corrupt the database or fail because the DB is actively locked.

Do not delete backup functionality.

============================================================
PHASE 13 — ENVIRONMENT VARIABLES
============================================================

Inspect all environment variables used by the project.

Create a clean environment configuration.

Example categories:

DATABASE
AUTH
ETSY
FEDEX
INVENTORY
BACKUP
APPLICATION

For FedEx mapping:

FEDEX_MAPPING_FROM
FEDEX_MAPPING_TO

must remain server-side environment variables.

Do not expose secrets through:

NEXT_PUBLIC_*

Remove unused environment variables from documentation/config only after verifying they are not referenced.

Do NOT expose:

- passwords
- tokens
- API keys
- database credentials

in source code.

============================================================
PHASE 14 — PACKAGE.JSON CLEANUP
============================================================

Inspect package.json.

For every dependency:

determine whether it is actually used.

Remove unused dependencies.

Then run:

npm install

or the appropriate package-manager command.

Do not remove a package only because direct imports are not obvious if it is required by configuration/build tooling.

Also inspect:

scripts

Remove obsolete commands such as:

- old test commands
- abandoned migration commands
- temporary debug commands
- obsolete import commands

only after verifying they are no longer needed.

============================================================
PHASE 15 — TYPESCRIPT CLEANUP
============================================================

Remove:

- unused types
- unused interfaces
- unused enums
- duplicate types
- dead utility functions
- unreachable code

Fix all TypeScript errors.

Run the project's TypeScript check.

There must be no new TypeScript errors after cleanup.

============================================================
PHASE 16 — NEXT.JS CLEANUP
============================================================

Inspect:

- server components
- client components
- API routes
- layouts
- pages
- loading states
- error states
- hooks

Remove unused client components.

Avoid unnecessary "use client".

Do not convert server components to client components without a reason.

Do not introduce unnecessary API calls.

Avoid N+1 database queries.

============================================================
PHASE 17 — CONSOLE / DEBUG CLEANUP
============================================================

Remove temporary debug logs such as:

console.log()

console.debug()

temporary FedEx diagnostic logs

temporary Etsy logs

temporary database debugging

BUT preserve production operational logs where useful.

Use consistent prefixes, for example:

[System]
[Database]
[FedEx]
[Etsy]
[Inventory]
[Backup]
[Scheduler]

Do not remove error logging.

============================================================
PHASE 18 — TEST FILE CLEANUP
============================================================

Find all:

*.test.*
*.spec.*
__tests__/
test/
tests/
temporary scripts

Do not automatically delete them.

Determine whether each is:

- useful production test
- required CI test
- obsolete test
- temporary developer test

Remove only obsolete/temporary tests.

If no automated test suite is actually used, do not invent a large testing framework just for cleanup.

============================================================
PHASE 19 — DEAD API ROUTES
============================================================

Find all API routes.

For each route determine:

- who calls it
- whether frontend uses it
- whether cron uses it
- whether external systems use it
- whether it is documented
- whether it is legacy

Remove only routes proven obsolete.

Pay special attention to:

old FedEx endpoints
old Etsy endpoints
dummy shipment endpoints
test endpoints
debug endpoints

============================================================
PHASE 20 — DOCUMENTATION
============================================================

After cleanup update README.md.

README should contain:

1. Project overview
2. Tech stack
3. Folder structure
4. Environment variables
5. Local setup
6. Database initialization
7. Development command
8. Production build
9. Production start
10. Etsy import flow
11. Inventory sync flow
12. FedEx billing flow
13. FedEx mapping flow
14. Order-level FedEx allocation
15. Backup system
16. Important API endpoints
17. Troubleshooting

Do not document deleted/obsolete functionality.

============================================================
PHASE 21 — GIT SAFETY
============================================================

Before deleting anything:

Show a cleanup report.

For every deletion include:

FILE
REASON
REFERENCES FOUND
SAFE TO DELETE

Example:

scripts/test-fedex.ts
Reason: temporary manual testing script
References: none
Status: SAFE TO DELETE


For anything uncertain:

Status: KEEP — UNKNOWN


Do not delete UNKNOWN files.

============================================================
PHASE 22 — BUILD VALIDATION
============================================================

After cleanup run:

npm run lint

npm run build

and the project's TypeScript validation command if separate.

Also start:

npm run dev

Verify:

- application starts
- DuckDB initializes
- database schema initializes correctly
- no obsolete tables are recreated
- dashboard loads
- search works
- Order Details works
- Etsy data works
- Inventory sync status works
- FedEx billing works
- FedEx mapping works
- order ↔ AWB mapping works
- order-level FedEx cost works
- backup scheduler starts
- no unexpected runtime errors

============================================================
PHASE 23 — DATABASE VALIDATION
============================================================

After startup inspect the database.

Verify there are no unexpected tables.

Verify no obsolete table is recreated automatically.

Verify all production views work.

Verify:

v_order_fedex_cost

correctly calculates order-level FedEx cost.

Verify:

order_awb_mapping

supports:

One Order → One AWB
One Order → Multiple AWBs
One AWB → Multiple Orders

============================================================
PHASE 24 — FINAL CLEANUP REPORT
============================================================

At the end provide:

1. Files deleted
2. Files moved
3. Files consolidated
4. Dependencies removed
5. API routes removed
6. Database tables removed
7. Database views changed
8. Database initialization changes
9. Environment variables added/removed
10. Backup changes
11. Folder structure after cleanup
12. Build result
13. Lint result
14. Runtime validation result
15. Any remaining technical debt

============================================================
CRITICAL RULES
============================================================

1. DO NOT blindly delete.
2. DO NOT delete anything without checking references.
3. DO NOT break working functionality.
4. DO NOT change business calculations.
5. DO NOT change Etsy calculation logic.
6. DO NOT change Inventory calculation logic.
7. DO NOT change FedEx allocation formulas.
8. DO NOT change dashboard financial calculations unless required to remove dead code.
9. DO NOT expose secrets.
10. DO NOT commit .env files containing secrets.
11. DO NOT delete production backups without explicit confirmation.
12. DO NOT delete unknown files.
13. DO NOT create duplicate implementations.
14. DO NOT create unnecessary abstractions.
15. Prefer simple production-grade architecture.
16. One source of truth per business calculation.
17. One implementation per integration.
18. One database initialization strategy.
19. One backup implementation.
20. One scheduler implementation.

MOST IMPORTANT:

Before making destructive changes, create a complete dependency-aware cleanup plan.

Then execute the plan safely.

If a file/table/script cannot be confidently classified as unused, KEEP IT and report it.

Do not mark the task complete until:

npm run build

passes successfully and the application starts cleanly with:

npm run dev