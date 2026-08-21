# AMAZIA ERP — PRODUCTION FEDEX MAPPING + COST FLOW
# FINAL IMPLEMENTATION TASK

Act as a Senior Backend/Full-Stack Engineer specializing in:
- Next.js App Router
- TypeScript
- DuckDB
- REST API integrations
- Data pipelines
- Financial calculations
- Production-grade error handling

============================================================
IMPORTANT CURRENT STATE
============================================================

The following flows are already working and MUST NOT be broken:

1. Etsy Statement flow
2. Google Sheets Inventory flow
3. Dashboard financial calculations
4. Order search
5. Order details

We are now implementing/replacing ONLY the FedEx Billing flow.

The current database already contains FedEx billing records such as:

    invoice_type
    invoice_date
    due_date
    awb_number
    air_waybill_total_amount
    file_hash
    created_at

The current problem is:

    fedex_billing
        contains data

but:

    order_awb_mapping
        is empty

Therefore the missing pipeline is:

    FedEx Billing
        ↓
    Shipment API
        ↓
    orderToAwbs / awbToOrders
        ↓
    order_awb_mapping
        ↓
    FedEx Cost Allocation
        ↓
    Order Financials
        ↓
    Dashboard

============================================================
1. DO NOT MAKE ME MANUALLY CALL EXTERNAL APIs
============================================================

The user must NOT have to manually call:

    POST /api/auth/login

or:

    GET /api/dashboard/shipments

during normal application operation.

The Next.js backend must automatically perform both calls.

However, create ONE internal endpoint that can be manually triggered for retry/recovery:

    POST /api/fedex/sync-mapping

This endpoint belongs to Amazia ERP.

Example:

    curl -X POST http://localhost:3000/api/fedex/sync-mapping

This is ONLY a manual/admin recovery mechanism.

Normal production flow must be:

    User uploads FedEx CSV
            ↓
    FedEx CSV processing
            ↓
    FedEx mapping sync automatically starts
            ↓
    External API login
            ↓
    External shipment API
            ↓
    Save mappings
            ↓
    Calculate FedEx cost
            ↓
    Dashboard updated

============================================================
2. ENVIRONMENT VARIABLES
============================================================

Do NOT hardcode external API credentials in TypeScript/JavaScript.

Add:

    SHIPMENT_API_BASE_URL=http://100.125.123.94:4000
    SHIPMENT_API_USERNAME=ops
    SHIPMENT_API_PASSWORD=123

Use:

    process.env.SHIPMENT_API_BASE_URL
    process.env.SHIPMENT_API_USERNAME
    process.env.SHIPMENT_API_PASSWORD

Never expose these values to the frontend.

Never send the external password to the browser.

Never log the password.

Never log the JWT token.

============================================================
3. EXTERNAL AUTHENTICATION
============================================================

The backend must automatically call:

    POST {SHIPMENT_API_BASE_URL}/api/auth/login

Body:

    {
      "username": process.env.SHIPMENT_API_USERNAME,
      "password": process.env.SHIPMENT_API_PASSWORD
    }

Expected behavior:

    login
      ↓
    receive token
      ↓
    use token for shipment request

The token must remain server-side.

Create a reusable service such as:

    lib/services/shipment-api.ts

or an equivalent service according to the existing project architecture.

Do NOT put external API logic directly inside React components.

============================================================
4. SHIPMENT ENDPOINT
============================================================

After login, call:

    GET {SHIPMENT_API_BASE_URL}/api/dashboard/shipments

with:

    Authorization: Bearer <TOKEN>

Example:

    /api/dashboard/shipments
      ?from=2026-01-01T00:00:00%2B05:30
      &to=2027-01-01T00:00:00%2B05:30
      &groupBy=month

Do NOT hardcode this date range.

============================================================
5. DETERMINE DATE RANGE FROM FEDEX DATA
============================================================

The mapping request must be based on the relevant FedEx billing dataset.

Read the FedEx billing records from DuckDB.

Determine:

    earliest relevant date
    latest relevant date

Then create:

    from = earliest date at 00:00:00 +05:30

    to = day after latest date at 00:00:00 +05:30

Remember:

    from = inclusive
    to   = exclusive

Example:

    minimum date = 2026-04-01
    maximum date = 2026-04-30

Request:

    from = 2026-04-01T00:00:00+05:30
    to   = 2026-05-01T00:00:00+05:30

Do not unnecessarily request an entire year if the uploaded FedEx file covers only a smaller period.

============================================================
6. EXTERNAL API RESPONSE
============================================================

The shipment API response contains:

    data.filters
    data.summary
    data.series
    data.orderToAwbs
    data.awbToOrders
    data.shipments
    data.pagination

The mapping pipeline must process:

    orderToAwbs

AND:

    awbToOrders

Example:

    orderToAwbs:

    {
      "4104705089": [
        "873549431322"
      ],

      "4104705090": [
        "873549431322"
      ],

      "4104705091": [
        "873549431322"
      ],

      "4104705092": [
        "873549431400",
        "873549431401"
      ]
    }

Reverse mapping:

    awbToOrders:

    {
      "873549431322": [
        "4104705089",
        "4104705090",
        "4104705091"
      ],

      "873549431400": [
        "4104705092"
      ],

      "873549431401": [
        "4104705092"
      ]
    }

Do not assume the response always contains every key.

Safely handle:

    missing
    null
    empty
    malformed
    unexpected values

============================================================
7. NORMALIZE THE MAPPING
============================================================

Convert the API response into normalized relationships:

    order_no
    awb_number

Example:

    4104705089 | 873549431322
    4104705090 | 873549431322
    4104705091 | 873549431322
    4104705092 | 873549431400
    4104705092 | 873549431401

The normalized mapping must support:

    One Order → One AWB

    One Order → Multiple AWBs

    One AWB → Multiple Orders

    Many Orders ↔ Many AWBs

============================================================
8. DATABASE TABLE
============================================================

Use:

    order_awb_mapping

as the authoritative Order ↔ AWB relationship table.

Required conceptual structure:

    order_awb_mapping
    -------------------------
    order_no
    awb_number
    created_at

The relationship must be unique by:

    (order_no, awb_number)

Do NOT make:

    order_no

the only primary key.

Do NOT make:

    awb_number

the only primary key.

An AWB can belong to multiple orders.

An order can have multiple AWBs.

Use:

    PRIMARY KEY(order_no, awb_number)

or an equivalent UNIQUE constraint.

============================================================
9. SAFE UPSERT
============================================================

The mapping sync must be idempotent.

If the API returns:

    4104705089 → 873549431322

multiple times, the database must still contain only one relationship.

Use an appropriate DuckDB-safe:

    INSERT ... ON CONFLICT DO NOTHING

or equivalent implementation.

Repeated sync must NOT duplicate mappings.

============================================================
10. VERIFY BOTH DIRECTIONS
============================================================

Use both:

    orderToAwbs

and:

    awbToOrders

to validate the external response.

Example:

If:

    orderToAwbs["4104705089"]
    =
    ["873549431322"]

then:

    awbToOrders["873549431322"]

should contain:

    "4104705089"

If they disagree:

    log the inconsistency

but do NOT invent a relationship.

Do not silently hide mapping inconsistencies.

============================================================
11. FEDEX BILLING TABLE
============================================================

The FedEx billing table should contain only required fields.

Required:

    id
    invoice_type
    invoice_date
    due_date
    awb_number
    air_waybill_total_amount
    file_hash
    created_at

Do not keep obsolete FedEx columns unless repository inspection proves they are required.

The billing cost is:

    air_waybill_total_amount

============================================================
12. BOOK EXPENSE COST
============================================================

The existing accounting formula is:

    Book Expense Cost =
    Amount × 18 / 118

Example:

    Amount = ₹1,180

    Book Expense Cost =
    1180 × 18 / 118
    =
    ₹180

IMPORTANT:

Book Expense Cost is NOT an additional FedEx expense.

Do NOT calculate:

    FedEx Expense = Amount + Book Expense Cost

That would double count the expense.

The actual FedEx cost remains:

    air_waybill_total_amount

Book Expense Cost must not be separately added to:

    Total Expenses
    FedEx Cost
    Net Profit
    Profit Margin

============================================================
13. FEDEX COST MATCHING
============================================================

After mappings are saved:

    order_awb_mapping

must be joined with:

    fedex_billing

using:

    awb_number

Example:

    AWB = 873549431322
    FedEx Cost = ₹600

Mapping:

    873549431322
       ↓
    4104705089
    4104705090
    4104705091

Number of mapped orders:

    3

Therefore:

    ₹600 / 3
    =
    ₹200 per order

============================================================
14. AUTHORITATIVE ALLOCATION FORMULA
============================================================

Use exactly:

    Allocated Shipping Cost
    =
    Total AWB Cost
    /
    Number of Orders Mapped to that AWB

Do not allocate the full AWB cost to every order.

Do not use the number of AWBs as the divisor.

The divisor is:

    number of DISTINCT ORDERS mapped to that AWB

============================================================
15. ONE ORDER WITH MULTIPLE AWBs
============================================================

Example:

    Order:
        4104705092

AWB 1:

    873549431400
    Total Cost = ₹300
    Orders Sharing = 1

    Allocation = ₹300 / 1
               = ₹300

AWB 2:

    873549431401
    Total Cost = ₹600
    Orders Sharing = 3

    Allocation = ₹600 / 3
               = ₹200

Final:

    Order 4104705092 FedEx Cost
    =
    ₹300 + ₹200
    =
    ₹500

Therefore:

    Order FedEx Cost
    =
    SUM(all AWB allocations for that order)

============================================================
16. MULTIPLE ORDERS ON ONE AWB
============================================================

Example:

    AWB = 873549431322
    Total = ₹600

Orders:

    4104705089
    4104705090
    4104705091

Allocation:

    600 / 3 = ₹200

Result:

    4104705089 → ₹200
    4104705090 → ₹200
    4104705091 → ₹200

============================================================
17. ROUNDING
============================================================

Currency allocation must reconcile exactly.

Example:

    ₹1,000 / 3

Do not allow:

    ₹333.33 × 3 = ₹999.99

Instead use deterministic allocation:

    ₹333.33
    ₹333.33
    ₹333.34

Total:

    ₹1,000.00

The source AWB amount and total allocated amount must reconcile exactly.

============================================================
18. UNMATCHED AWB
============================================================

If:

    fedex_billing.awb_number

has no mapping in:

    order_awb_mapping

do NOT:

    delete it
    fabricate an order
    assign it randomly
    silently ignore it

Keep the billing record as:

    unmatched

Expose/log the unmatched AWB so it can be investigated.

============================================================
19. ORDER WITHOUT AWB
============================================================

If an Etsy order has no FedEx mapping:

    FedEx Cost = ₹0

The order must still appear normally.

Do not block financial calculations.

============================================================
20. INTERNAL API
============================================================

Create:

    POST /api/fedex/sync-mapping

This endpoint should:

    1. Validate that FedEx billing data exists.
    2. Determine relevant date range.
    3. Authenticate with external shipment API.
    4. Fetch shipment mappings.
    5. Validate response.
    6. Normalize orderToAwbs.
    7. Normalize awbToOrders.
    8. Validate both directions.
    9. Upsert order_awb_mapping.
    10. Recalculate FedEx allocations.
    11. Reconcile allocated cost against source AWB cost.
    12. Update FedEx sync status.
    13. Return a useful summary.

Example response:

    {
      "success": true,
      "billingRecords": 529,
      "mappingRows": 523,
      "newMappings": 523,
      "duplicateMappings": 0,
      "matchedAwbs": 500,
      "unmatchedAwbs": 29,
      "allocatedOrders": 510,
      "reconciliationPassed": true
    }

Do not return the JWT.

============================================================
21. AUTOMATIC TRIGGER AFTER UPLOAD
============================================================

After successful FedEx CSV upload:

    POST /api/upload/fedex

must automatically trigger:

    /api/fedex/sync-mapping

or, preferably, call the shared service directly rather than making an internal HTTP request.

Preferred architecture:

    Upload Route
         ↓
    FedEx Import Service
         ↓
    FedEx Mapping Service
         ↓
    Allocation Service

Do NOT unnecessarily do:

    Next.js API
       ↓ HTTP
    Another Next.js API
       ↓
    Service

Prefer shared server-side services.

The internal endpoint exists for manual retry/recovery.

============================================================
22. SERVICE STRUCTURE
============================================================

Follow the existing project structure.

If suitable, separate responsibilities into:

    fedex-import.service.ts
    shipment-api.service.ts
    fedex-mapping.service.ts
    fedex-allocation.service.ts
    fedex-reconciliation.service.ts

Do not create duplicate services if equivalent services already exist.

Reuse existing database utilities.

============================================================
23. SYNC STATUS
============================================================

After successful FedEx processing:

    sync_metadata

must contain:

    sync_name = 'fedex_billing'

    last_sync_at = ACTUAL successful completion timestamp

If processing:

    Sync in progress...

If never processed:

    Not synced yet

If failed:

    Sync failed

The UI must never show an old/stale timestamp as the latest successful sync.

============================================================
24. TIMEZONE
============================================================

Store timestamps consistently in UTC in DuckDB/application storage.

Display them in:

    Asia/Kolkata

Example:

Database:

    2026-08-21 06:42:18 UTC

UI:

    21 Aug 2026 • 12:12 PM IST

Do NOT manually add/subtract hours.

Use proper timezone conversion.

The displayed upload/sync time must represent the actual event.

============================================================
25. MANUAL CURL
============================================================

After implementation, this must work:

    curl -X POST \
      http://localhost:3000/api/fedex/sync-mapping

This is only for:

    testing
    debugging
    retry
    manual recovery

The user should NOT need to manually call:

    /api/auth/login

or:

    /api/dashboard/shipments

because the backend handles them automatically.

============================================================
26. ERROR HANDLING
============================================================

Handle all of these:

    invalid CSV
    missing AWB
    invalid amount
    duplicate CSV
    empty CSV
    shipment API unavailable
    authentication failure
    expired/invalid token
    malformed shipment response
    missing orderToAwbs
    missing awbToOrders
    database failure
    allocation failure
    reconciliation failure

If shipment API fails:

    Do not mark FedEx mapping sync successful.

If database transaction fails:

    rollback affected changes.

Never leave the database in a partially processed state.

============================================================
27. TRANSACTION SAFETY
============================================================

The mapping/allocation operation should be transactional where possible.

Conceptually:

    BEGIN

        Insert/update mappings
        Calculate allocations
        Validate reconciliation
        Update sync metadata

    COMMIT

If a critical error occurs:

    ROLLBACK

Do not update:

    last_sync_at

until the operation actually succeeds.

============================================================
28. RECONCILIATION
============================================================

For every matched AWB:

    FedEx Source Cost
    =
    SUM(Allocated Cost Across Orders)

Example:

    Source = ₹600

    Allocations:
        ₹200
        ₹200
        ₹200

    Allocated = ₹600

    PASS

If totals do not match:

    FAIL

Log the discrepancy.

Do not silently accept incorrect financial data.

============================================================
29. FINANCIAL INTEGRATION
============================================================

The authoritative order-level calculation must be:

    Gross Sales
    - Refund
    - Etsy Expenses
    - Material Cost
    - FedEx Cost
    =
    Direct NPF

FedEx Cost must come from:

    fedex_billing
        +
    order_awb_mapping
        +
    allocation logic

Do not calculate a second independent FedEx value in the frontend.

============================================================
30. EXISTING VIEWS
============================================================

Inspect:

    v_order_fedex_cost
    v_order_financials

and all dependent views.

Update them to use the new FedEx calculation.

Search repository dependencies before modifying or deleting views.

Do not create duplicate financial logic.

============================================================
31. ORDER DETAILS
============================================================

When searching an order, Order Details must show:

    Order Number
    Sale Date
    AWB(s)
    Gross Sales
    Refund
    Etsy Expenses
    Material Cost
    FedEx Cost
    Direct NPF
    Margin

If an order has multiple AWBs, show all of them.

Example:

    Order 4104705092

    AWB 873549431400
        FedEx Allocation: ₹300

    AWB 873549431401
        FedEx Allocation: ₹200

    Total FedEx Cost:
        ₹500

============================================================
32. DASHBOARD
============================================================

Update:

    Total Expenses
    Net Profit
    Profit Margin
    Expense Breakdown
    Monthly Business Performance
    Recent Orders

FedEx Cost must be included correctly.

Do not double count.

Book Expense Cost must NOT appear as another expense category.

============================================================
33. PERFORMANCE
============================================================

Do NOT call the external shipment API once for every AWB.

Do NOT call it once for every order.

One mapping sync should fetch the required shipment dataset efficiently.

Use:

    bulk inserts
    batch processing
    grouped SQL
    indexed joins

where appropriate.

============================================================
34. DATABASE INDEXES
============================================================

Ensure efficient lookups for:

    fedex_billing.awb_number
    order_awb_mapping.order_no
    order_awb_mapping.awb_number

Do not add unnecessary indexes.

============================================================
35. LOGGING
============================================================

Production logs should show:

    [FedEx] Upload started
    [FedEx] CSV validated
    [FedEx] Records imported
    [FedEx] Date range determined
    [FedEx] Authenticating shipment API
    [FedEx] Shipment API request started
    [FedEx] Shipment API response received
    [FedEx] orderToAwbs count
    [FedEx] awbToOrders count
    [FedEx] Mapping normalization completed
    [FedEx] New mappings
    [FedEx] Duplicate mappings
    [FedEx] Unmatched AWBs
    [FedEx] Allocation completed
    [FedEx] Reconciliation completed
    [FedEx] Sync completed

Never log:

    password
    JWT
    Authorization header

============================================================
36. TEST EXACT BUSINESS CASE
============================================================

Use this exact test:

Mappings:

    4104705089 → 873549431322
    4104705090 → 873549431322
    4104705091 → 873549431322

    4104705092 → 873549431400
    4104705092 → 873549431401

Costs:

    873549431322 = ₹600
    873549431400 = ₹300
    873549431401 = ₹600

Expected:

    4104705089 = ₹200 FedEx
    4104705090 = ₹200 FedEx
    4104705091 = ₹200 FedEx

    4104705092:
        ₹300 + ₹200
        = ₹500 FedEx

============================================================
37. DO NOT CREATE UNNECESSARY TABLES
============================================================

Before creating any new table:

    inspect the current schema.

Do not create:

    another FedEx billing table
    another mapping table
    another allocation table
    another sync table

if an existing table can correctly support the architecture.

Use:

    fedex_billing

and:

    order_awb_mapping

unless repository inspection proves another structure is necessary.

============================================================
38. REMOVE OBSOLETE CODE
============================================================

Search the complete repository for old FedEx logic.

Remove unused:

    services
    API routes
    parsers
    allocation functions
    shipment integrations
    test files
    migration files
    debug files
    temporary scripts

BUT:

Before deleting anything, verify repository-wide references.

Do NOT break:

    Etsy
    Inventory
    Dashboard
    Order Search
    Order Details
    shared database utilities

============================================================
39. FINAL VERIFICATION
============================================================

Before declaring completion verify:

[ ] FedEx CSV uploads successfully
[ ] Only required FedEx fields stored
[ ] File hash/idempotency works
[ ] Upload timestamp correct
[ ] External credentials come from .env
[ ] Credentials never reach frontend
[ ] Login API works
[ ] Shipment API works
[ ] Date range is dynamically generated
[ ] orderToAwbs processed
[ ] awbToOrders processed
[ ] Mapping saved automatically
[ ] order_awb_mapping no longer remains empty
[ ] One Order → One AWB works
[ ] One Order → Multiple AWBs works
[ ] One AWB → Multiple Orders works
[ ] Many-to-many works
[ ] Duplicate mappings prevented
[ ] Unmatched AWBs handled
[ ] FedEx allocation correct
[ ] Multiple AWBs summed correctly
[ ] Currency rounding reconciles
[ ] Source AWB cost reconciles with allocations
[ ] Book Expense Cost is not double counted
[ ] Order financials updated
[ ] Dashboard updated
[ ] Order Search updated
[ ] Order Details updated
[ ] Last Sync Status updated
[ ] IST display is correct
[ ] Manual POST /api/fedex/sync-mapping works
[ ] Automatic sync after upload works
[ ] Retry/recovery works
[ ] No duplicate FedEx systems remain
[ ] No obsolete FedEx code remains
[ ] Existing Etsy flow still works
[ ] Existing Inventory flow still works
[ ] TypeScript passes
[ ] Production build passes
[ ] No dummy FedEx data remains

============================================================
40. FINAL AGENT REPORT
============================================================

After implementation, report:

1. Exact files created
2. Exact files modified
3. Exact files deleted
4. Database changes
5. Existing tables retained
6. Existing tables removed
7. New FedEx service architecture
8. External API integration
9. Environment variables added
10. Mapping implementation
11. Allocation implementation
12. Reconciliation result
13. Automatic upload flow
14. Manual recovery endpoint
15. Tests performed
16. Any remaining issues

Do not claim completion unless the complete flow has actually been tested.

The final expected production flow is:

    USER
      │
      │ Upload FedEx CSV
      ▼
    Next.js Upload API
      │
      ▼
    fedex_billing
      │
      ▼
    FedEx Mapping Service
      │
      ├── POST external /api/auth/login
      │          │
      │          ▼
      │        JWT
      │
      └── GET external /api/dashboard/shipments
                   │
                   ▼
             orderToAwbs
             awbToOrders
                   │
                   ▼
          Normalize Relationships
                   │
                   ▼
          order_awb_mapping
                   │
                   ▼
          FedEx Allocation Service
                   │
                   ▼
          Order FedEx Cost
                   │
                   ▼
          Financial Views
                   │
                   ▼
             Dashboard

The user should only interact with the Amazia ERP UI.
The external API authentication and mapping retrieval must happen automatically on the server.