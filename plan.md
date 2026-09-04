PROJECT RESET / ARCHITECTURE AUDIT — AMAZIA ERP
================================================

We are rebuilding/fixing the ERP data architecture because the current data is mixed up and producing incorrect results.

DO NOT PATCH THE UI ONLY.

Before changing code, trace the complete data pipeline:

SOURCE
→ CSV/API PARSER
→ DATABASE
→ ORDER CREATION
→ AWB MAPPING
→ FEDEX BILLING
→ FEDEX COST ALLOCATION
→ ETSY FINANCIAL DATA
→ ORDER FINANCIAL CALCULATION
→ DASHBOARD API
→ ORDER API
→ UI

The goal is to have a deterministic, traceable architecture where every value has a clear source.

================================================
PART 1 — SOURCE ARCHITECTURE
================================================

We have multiple independent data sources.

1. ETSY CSV
   → Etsy sales
   → Etsy refunds
   → Etsy fees
   → Etsy Ads
   → Etsy listing fees
   → Etsy financial transactions
   → Etsy sales date
   → Etsy product/title/info

2. SHIPMENT API
   → shipment/order relationships
   → order ↔ AWB mappings
   → shipment information
   → shipping-related information

3. FEDEX BILLING CSV
   → FedEx billing records
   → AWB
   → FedEx billing cost
   → Shipper Reference 1
   → order ↔ AWB mapping
   → recipient country
   → invoice information

4. FUTURE EXTERNAL SALES API
   → non-Etsy order sales
   → non-Etsy sales date
   → non-Etsy product/order information

IMPORTANT:

Do NOT assume Shipment API is the source of every order.

Do NOT assume FedEx is the source of sales.

Do NOT infer sales from shipment data.

Do NOT infer sales date from FedEx invoice date.

Do NOT infer sales date from AWB mapping date.

================================================
PART 2 — ORDER PROVENANCE
================================================

We need to distinguish:

ORDER SOURCE
MAPPING SOURCE
SALES SOURCE

These are different concepts.

Example:

Order 4038257902

Could have:

order_source = FEDEX_BILLING_CSV

mapping_source = FEDEX_BILLING_CSV

sales_source = NONE

sales_amount = NULL

sales_date = NULL

Later, external API provides:

sales_amount = ₹26,435
sales_date = Apr 25 2026
sales_source = EXTERNAL_API

Do NOT overwrite the original order provenance incorrectly.

Similarly:

Etsy order:

order_source = ETSY_CSV
sales_source = ETSY_CSV

AWB may have:

mapping_source = FEDEX_BILLING_CSV

That is completely valid.

================================================
PART 3 — FEDEX AWB IS A CRITICAL P0 ISSUE
================================================

URGENT FIX:

We have a serious FedEx AWB parsing, duplication and cost calculation problem.

Example from the current UI:

AWB:
871000000000

Total AWB Cost:
₹9,54,991.30

Allocated Cost:
₹2,092.66

This AWB appears approximately 456 times.

This can cause:

- inflated AWB totals
- duplicated FedEx billing
- incorrect order costs
- incorrect NPF
- incorrect dashboard expenses
- incorrect margins

DO NOT PATCH THE UI.

Trace:

FedEx CSV Upload
→ CSV Parser
→ Parsed rows
→ Database
→ AWB normalization
→ Billing aggregation
→ Order extraction
→ Order ↔ AWB mapping
→ AWB total calculation
→ FedEx allocation
→ Order cost
→ Dashboard
→ UI

First identify the root cause.

================================================
PART 4 — AWB MUST ALWAYS BE TEXT
================================================

FedEx Air Waybill Number must ALWAYS be stored as:

VARCHAR / TEXT

Never:

INTEGER
BIGINT
DOUBLE
FLOAT
DECIMAL
JavaScript Number

Never use:

Number()
parseInt()
parseFloat()

for AWB values.

Never perform mathematical operations on AWBs.

Examples:

871000000000
873548507840
874910444981

must remain exactly:

"871000000000"
"873548507840"
"874910444981"

Only trim surrounding whitespace.

Example:

"873548507840 "
→
"873548507840"

Do NOT transform:

873548507840

into:

8.7354850784E+11

Do NOT allow Excel-style scientific notation to become the database value.

================================================
PART 5 — VERIFY THE RAW FEDEX CSV
================================================

Inspect the actual uploaded FedEx CSV.

Identify these columns:

Invoice Type
Air Waybill Number
Shipper Reference 1
Air Waybill Total Amount
Recipient Address Country/Territory
Invoice Date
Due Date

Before normalization, log several raw values.

Especially inspect:

871000000000

We need to determine whether the source CSV actually contains:

871000000000

OR whether:

CSV parser
→ Excel-style formatting
→ number conversion
→ scientific notation
→ normalization

is producing the wrong value.

Do NOT assume the UI value is correct.

The CSV itself is the source of truth.

================================================
PART 6 — DO NOT USE EXCEL-DISPLAYED VALUES
================================================

Excel may visually display:

871000000000

as:

8.71E+11

That does NOT mean the CSV contains scientific notation.

The importer must read the CSV value as TEXT.

The AWB parser must preserve the original string.

AWB normalization should ONLY:

- convert null/undefined safely
- trim whitespace
- normalize obvious CSV quoting

It must NOT:

- convert to Number
- parseFloat
- parseInt
- perform arithmetic
- convert scientific notation automatically
- remove meaningful digits

================================================
PART 7 — INVESTIGATE THE ~456 DUPLICATES
================================================

For:

AWB = '871000000000'

run diagnostics.

Check:

COUNT(*)
COUNT(DISTINCT order_no)
SUM(air_waybill_total_amount)
COUNT(DISTINCT invoice/reference rows)
COUNT(DISTINCT import_id)

Example:

SELECT
    awb_number,
    COUNT(*) AS row_count,
    COUNT(DISTINCT order_no) AS order_count,
    SUM(air_waybill_total_amount) AS total_cost
FROM fedex_billing
WHERE awb_number = '871000000000'
GROUP BY awb_number;

Also inspect:

- all invoice types
- invoice dates
- due dates
- shipper references
- raw source values
- import IDs
- file hashes
- duplicate row hashes

Determine whether the 456 records are:

A. legitimate FedEx billing lines
B. duplicate CSV rows
C. repeated upload of the same file
D. multiple invoices
E. multiple billing charges for one AWB
F. AWB parser corruption
G. incorrect normalization
H. database duplication
I. mapping duplication
J. aggregation duplication

DO NOT DELETE ANYTHING until the root cause is known.

================================================
PART 8 — BILLING LINE VS AWB VS ORDER
================================================

This distinction is mandatory.

FedEx data can contain:

BILLING LINE
    ↓
AWB / SHIPMENT
    ↓
ORDER

These are NOT the same entity.

One AWB may legitimately have multiple billing rows.

For example:

AWB 123

Billing line 1 → transportation
Billing line 2 → duty
Billing line 3 → surcharge

These may all belong to the same AWB.

Therefore:

COUNT(billing rows)
does NOT automatically mean:

COUNT(shipments)

The system must understand the actual FedEx CSV semantics before calculating AWB cost.

================================================
PART 9 — FEDEX BILLING COST
================================================

For every unique AWB:

AWB TOTAL COST

must equal:

the valid FedEx billing charges belonging to that AWB

according to the actual billing-file semantics.

Do NOT blindly do:

number of rows × amount

Do NOT double-count duplicated billing lines.

Do NOT sum the same source record multiple times because:

- it was uploaded twice
- it was mapped twice
- it was joined twice
- it appears under multiple orders

The original billing record must be identifiable.

================================================
PART 10 — FEDEX IMPORT IDENTITY
================================================

Every uploaded FedEx CSV must have an import record.

Create a deterministic file/import identity.

Prefer a cryptographic hash of the original file contents.

Example concept:

fedex_imports

id
file_name
file_hash
uploaded_at
row_count
status

If the EXACT SAME FILE is uploaded again:

DO NOT duplicate billing rows.

The operation must be idempotent.

Different files must accumulate.

Example:

June FedEx CSV
+
July FedEx CSV
+
August FedEx CSV

must produce:

June + July + August

without replacing previous data.

Uploading July again must NOT produce:

June + July + July

================================================
PART 11 — BILLING ROW IDENTITY
================================================

In addition to file-level identity, every billing row needs a deterministic identity/hash.

This is important because a single file may contain multiple legitimate rows for the same AWB.

The row identity should be based on the actual source fields needed to uniquely identify a billing transaction/line.

Do NOT use:

AWB alone

as the billing-row identity.

Do NOT use:

AWB + Order

unless that is genuinely unique in the source.

The goal is:

same source billing row
→ same identity

different legitimate billing rows
→ different identity

================================================
PART 12 — AWB TOTAL MUST BE DETERMINISTIC
================================================

For each AWB:

1. Identify all valid billing rows.
2. Remove exact duplicate imports/rows.
3. Apply actual FedEx billing semantics.
4. Aggregate valid charges.
5. Produce one authoritative AWB total.

Conceptually:

FedEx Billing Rows
        ↓
Deduplicated Billing Rows
        ↓
Group by AWB
        ↓
AWB Total Cost

The AWB total must be reproducible from source data.

================================================
PART 13 — ORDER ↔ AWB MAPPING
================================================

There are TWO mapping sources.

SOURCE A:

Shipment API

SOURCE B:

FedEx Billing CSV

Final mapping:

API mappings
UNION
FedEx CSV mappings

Deduplicate by:

(order_no, awb_number)

Do NOT allow one source to overwrite the other.

================================================
PART 14 — FEDEX CSV ORDER EXTRACTION
================================================

FedEx:

Shipper Reference 1

can contain:

4075071600_1306

Extract:

4075071600

Rule:

everything before the FIRST "_"

Example:

4075071600_1306
→
4075071600

If malformed:

4075071600

or:

ABC

or:

NULL

do not silently create incorrect order numbers.

Log invalid values.

================================================
PART 15 — FEDEx-ONLY ORDER MUST STILL EXIST
================================================

If:

FedEx CSV:

Shipper Reference 1 = 4038257902_XXXX

AWB = 872190434674

and Shipment API does NOT contain:

4038257902

we STILL store:

orders
4038257902

and:

order_awb_mapping
4038257902 → 872190434674

with:

source = FedEx Billing CSV

This is a valid external order shell.

But:

sales_amount = NULL

sales_date = NULL

until a sales source provides those values.

================================================
PART 16 — NEVER INVENT SALES DATE
================================================

This is another critical issue.

If the order is created from:

FedEx Billing CSV

the system MUST NOT use:

FedEx invoice date

as sales date.

It MUST NOT use:

created_at

as sales date.

It MUST NOT use:

shipment date

as sales date.

It MUST NOT use:

mapping date

as sales date.

If no sales source exists:

sales_date = NULL

UI:

Sales Date = N/A

Once a real sales source provides the date:

use that date.

================================================
PART 17 — SALES SOURCE
================================================

For Etsy:

Etsy CSV

is the sales source.

Therefore:

sales_source = ETSY_CSV

sales_amount = Etsy sales

sales_date = Etsy transaction/order date

For future external API:

sales_source = EXTERNAL_API

sales_amount = API sales

sales_date = API sales date

For FedEx-only order:

sales_source = NONE

sales_amount = NULL

sales_date = NULL

FedEx billing must NEVER create sales.

================================================
PART 18 — SOURCE COLUMN IN ORDER-AWB MAPPING
================================================

Current table:

order_awb_mapping

must contain provenance.

Minimum conceptual columns:

order_no
awb_number
source
created_at

Allowed source values:

API
FedEx Billing CSV

Because the same relationship can potentially be discovered from both sources, do NOT create duplicate mappings.

Example:

API:
4038257902 → 872190434674

FedEx CSV:
4038257902 → 872190434674

There must be one logical mapping.

Preserve provenance appropriately.

Possible implementation:

source = API

plus source = FedEx Billing CSV

or a separate mapping provenance table.

Choose the cleanest normalized implementation.

================================================
PART 19 — MANY-TO-MANY MAPPING
================================================

The relationship MUST support:

1 Order → 1 AWB

1 Order → Multiple AWBs

Multiple Orders → 1 AWB

Multiple Orders → Multiple AWBs

Example:

Order 4104705092
→ AWB 873549431400
→ AWB 873549431401

And:

AWB 873549431322
→ Order 4104705089
→ Order 4104705090
→ Order 4104705091

Do NOT make AWB unique.

Do NOT make order unique.

Unique logical relationship:

(order_no, awb_number)

================================================
PART 20 — COUNTRY
================================================

FedEx:

Recipient Address Country/Territory

must be stored against the relevant FedEx shipment/AWB data.

When mapped to an order, expose country.

If one order has multiple AWBs with different countries:

do NOT silently choose one.

Represent multiple countries clearly.

================================================
PART 21 — FEDEX ALLOCATION
================================================

For one AWB mapped to one order:

Full valid AWB cost
→ that order

For one AWB mapped to multiple orders:

divide the valid AWB cost among mapped orders.

Use deterministic rounding.

Example:

AWB cost = ₹1,000

3 orders:

₹333.33
₹333.33
₹333.34

Total:

₹1,000.00

The final order gets the rounding remainder.

For one order with multiple AWBs:

Order FedEx Cost
=
SUM(all valid AWB allocations)

For multiple orders + multiple AWBs:

apply the same mapping/allocation rules independently for each AWB.

================================================
PART 22 — NO FEDEX COST DOUBLE COUNTING
================================================

A FedEx cost must have one clear lineage:

Billing Row
→ AWB Total
→ Mapping
→ Allocation
→ Order FedEx Cost

Do NOT:

sum billing rows at one stage

AND

sum AWB totals again at another stage.

Do NOT join billing rows directly to multiple mapping rows in a way that multiplies cost.

This is a major SQL risk.

For example:

AWB has 3 billing rows
AWB maps to 3 orders

A naive JOIN can produce:

3 × 3 = 9 rows

and inflate the total.

The architecture must aggregate billing to AWB BEFORE joining to order mappings.

Correct conceptual order:

Billing rows
    ↓
Deduplicate
    ↓
Aggregate by AWB
    ↓
AWB total
    ↓
Join mapping
    ↓
Allocate
    ↓
Order total

================================================
PART 23 — ORDER FEDEX ALLOCATION TABLE
================================================

Conceptually:

order_fedex_allocations

should contain:

order_no
awb_number
allocated_cost
created_at

And preferably enough provenance to trace:

source/import
AWB total used
allocation basis

Do not create duplicate allocation rows for the same rebuild.

The allocation table can be a deterministic calculated snapshot.

If current implementation deletes and rebuilds allocations:

that is acceptable ONLY if the rebuild is deterministic.

================================================
PART 24 — FEDEX DATABASE TABLES
================================================

Audit the current schema.

Recommended logical structure:

fedex_imports

id
file_name
file_hash
uploaded_at
row_count
status

fedex_billing

id
import_id
billing_row_hash
invoice_type
awb_number
shipper_reference_1
order_no
air_waybill_total_amount
recipient_country
invoice_date
due_date
created_at

IMPORTANT:

awb_number = TEXT/VARCHAR

NOT numeric.

order_no = TEXT/VARCHAR

billing_row_hash should identify the source billing row.

Do not blindly add columns if the existing schema already provides equivalent functionality.

================================================
PART 25 — DATABASE INTEGRITY AUDIT
================================================

Audit:

orders
etsy_transactions
etsy_expenses
fedex_imports
fedex_billing
order_awb_mapping
order_fedex_allocations
sync_metadata

Check:

- duplicate AWBs
- duplicate billing rows
- duplicate imports
- duplicate mappings
- duplicate allocations
- numeric AWB types
- scientific notation
- malformed AWBs
- NULL AWBs
- invalid Shipper Reference 1
- invalid order numbers
- repeated file uploads
- repeated billing rows

IMPORTANT:

Do NOT create:

UNIQUE(awb_number)

because one AWB can legitimately have:

multiple billing rows

and:

multiple orders.

================================================
PART 26 — ETSY DATA MUST REMAIN SEPARATE
================================================

Do NOT mix FedEx-only/external orders into Etsy financial totals.

Etsy dashboard:

Etsy sales only.

External/FedEx-only orders:

should not contribute Etsy sales until an actual external sales source is imported.

If:

sales_amount = NULL

the order should not become:

₹0 Etsy sale

unless the business explicitly defines NULL as zero.

Prefer:

sales unavailable

for external orders without sales data.

================================================
PART 27 — ORDER UI
================================================

Default Orders view:

SHOW ETSY ORDERS

Separate toggle/filter:

SHOW EXTERNAL ORDERS

When OFF:

show only orders with Etsy sales/source.

When ON:

show external/non-Etsy orders separately.

External order example:

Order:
4038257902

Source:
FedEx Billing CSV

Sales:
N/A / unavailable

Sales Date:
N/A

AWB:
872190434674

FedEx Cost:
₹X

This order should NOT appear as an Etsy sale.

================================================
PART 28 — UI ORDER INFORMATION
================================================

Do NOT create unnecessary columns.

Order row should show:

ORDER
    Order number
    Country
    Product name

SALES DATE

AWB(S)

SALES

FEDEX COST

MATERIAL

LISTING EXPENSE

EXPENSE

DIRECT NPF

MARGIN

Product should come from actual sales source.

For Etsy:

Title + Info

Example:

New Hydrangea PJs - Notched Collar Style...

Do NOT show:

"Product: Etsy Order Item"

when actual Etsy product information exists.

Do NOT show raw JavaScript date strings.

================================================
PART 29 — EXPENSE SEPARATION
================================================

In Order Details, separate expenses into:

1. ORDER-LEVEL EXPENSES

2. LEAST PROPORTIONAL CHARGES

Use exact business terminology approved by the product owner.

The proportional section should contain expenses that are distributed across orders rather than directly attributable to one order.

Examples:

Etsy Ads
Etsy Listing Expense

if they are allocated proportionally across orders.

Order-level expenses contain expenses directly associated with that order.

Do NOT make it appear that Etsy Ads or Listing Expense originated directly from that individual order if they were allocated proportionally.

================================================
PART 30 — QUANTITY
================================================

Do not display quantity unless the source data provides a trustworthy quantity.

If quantity is unknown:

remove the Qty display.

Do NOT invent:

Qty: 1

Do NOT default unknown quantity to 1.

================================================
PART 31 — ORDER DETAIL FEDEX SECTION
================================================

Order details should show:

Order Number
Product
Country
Sales Date
Sales
Refund
AWB(s)
FedEx Cost
Material Cost
Etsy Expenses
Direct NPF
Margin

FedEx shipping detail:

AWB Number
Mapping Source
Total AWB Cost
Allocated Cost
Country

If multiple AWBs:

show each AWB separately.

Then show:

Total FedEx Cost

================================================
PART 32 — EXAMPLE OF CORRECT PROVENANCE
================================================

Example:

4038257902

Shipment API:
NOT FOUND

FedEx CSV:
FOUND

FedEx CSV:

Shipper Reference 1:
4038257902_XXXX

AWB:
872190434674

Expected:

orders:
4038257902

order_source:
FEDEX_BILLING_CSV

sales_source:
NONE

sales_amount:
NULL

sales_date:
NULL

order_awb_mapping:

4038257902
872190434674
FedEx Billing CSV

FedEx cost:
calculated from AWB billing

UI:

External Order
4038257902
FedEx Billing CSV
Sales: N/A
Sales Date: N/A
AWB: 872190434674
FedEx Cost: ₹X

================================================
PART 33 — EXAMPLE OF ETSY + FEDEX
================================================

Example:

Etsy CSV:

Order:
4075071600

Sales:
₹5,038

Sales Date:
Jul 31 2026

FedEx CSV:

Order:
4075071600_1306

AWB:
873549431322

Expected:

ONE order.

sales_source:
ETSY_CSV

sales_amount:
₹5,038

sales_date:
Jul 31 2026

mapping_source:
FedEx Billing CSV

FedEx cost:
from FedEx AWB allocation

This is valid.

================================================
PART 34 — EXAMPLE API + FEDEX
================================================

Shipment API:

4038257902
→ 872190434674

FedEx CSV:

4038257902
→ 872190434674

Expected:

ONE order

ONE logical mapping

NO duplicate FedEx cost

Provenance:

API + FedEx Billing CSV

================================================
PART 35 — CRITICAL FEDEX DIAGNOSTIC OUTPUT
================================================

Before changing calculations, produce diagnostic output for:

AWB:
871000000000

Show:

Raw CSV AWB
Normalized AWB
Billing row count
Unique billing row count
Unique invoice count
Unique order count
Unique import count
Raw cost sum
Deduplicated cost sum
Final AWB total
Mapped order count
Allocated total

Also show every source/import contributing to this AWB.

We specifically need to understand why approximately 456 records exist.

================================================
PART 36 — SALES DATE DIAGNOSTIC
================================================

For suspicious orders such as:

3448
3111100078
4038257902

trace:

order creation source
sales source
sales date source
sales transaction
shipment record
FedEx record
mapping record

Answer:

WHY is the UI showing Aug 04 2026?

If no sales source exists:

the correct value is:

N/A

Do not infer August from FedEx data.

================================================
PART 37 — DASHBOARD FINANCIAL ISOLATION
================================================

Dashboard totals must distinguish:

ETSY FINANCIAL DATA

from:

EXTERNAL ORDERS WITH NO SALES DATA

An external order with:

sales = NULL

FedEx cost = ₹1,500

must NOT automatically produce:

Sales = ₹0
Expense = ₹1,500
NPF = -₹1,500

unless the business explicitly wants this accounting treatment.

Prefer excluding incomplete external orders from sales/profit calculations until their sales source is available.

The UI can still show their FedEx cost separately.

================================================
PART 38 — REQUIRED TEST CASES
================================================

TEST 1:

AWB appears once.

Expected:
one valid billing record
correct AWB
correct cost

TEST 2:

AWB appears multiple times as legitimate billing lines.

Expected:
multiple billing rows
one AWB
correct aggregated AWB cost

TEST 3:

same CSV uploaded twice.

Expected:
no duplicate billing rows
no duplicate AWB cost

TEST 4:

same AWB belongs to multiple orders.

Expected:
one AWB total
multiple mappings
cost allocated correctly

TEST 5:

one order has multiple AWBs.

Expected:
multiple mappings
FedEx cost = sum of valid allocations

TEST 6:

API-only mapping.

Expected:
source = API

TEST 7:

FedEx CSV-only mapping.

Expected:
source = FedEx Billing CSV

TEST 8:

mapping exists in both.

Expected:
one logical mapping
both sources preserved
no duplicate cost

TEST 9:

FedEx-only order with no sales.

Expected:

sales = unavailable
sales_date = N/A
FedEx cost = available
excluded from Etsy financial totals

TEST 10:

Etsy order + FedEx AWB.

Expected:

sales from Etsy
sales date from Etsy
AWB from FedEx
FedEx cost from FedEx
one order

================================================
PART 39 — REQUIRED DIAGNOSTIC REPORT BEFORE CODING
================================================

DO NOT IMPLEMENT CHANGES YET.

First inspect and report:

1. Current database schema.
2. Every table related to orders.
3. Every table related to Etsy.
4. Every table related to FedEx.
5. Current AWB database type.
6. Current order number database type.
7. Current FedEx CSV parser.
8. Current AWB normalization function.
9. Current FedEx importer.
10. Current FedEx import deduplication.
11. Current billing-row deduplication.
12. Current AWB aggregation query.
13. Current order ↔ AWB mapping function.
14. Current Shipment API mapping function.
15. Current FedEx allocation function.
16. Current dashboard expense calculation.
17. Current order API calculation.
18. Current order details calculation.
19. Current source/badge logic.
20. Current sales date logic.
21. Exact source of order 4038257902.
22. Exact source of AWB 872190434674.
23. Exact source of sales ₹26,435 if valid.
24. Exact source of Apr 25 2026.
25. Exact source of Aug 04 2026 for suspicious external orders.
26. Exact reason AWB 871000000000 appears ~456 times.
27. Exact reason its cost becomes ₹9,54,991.30.
28. Whether ₹9,54,991.30 is actually correct or inflated.
29. Whether FedEx-only orders currently enter Etsy totals.
30. Whether unknown sales are being converted to ₹0.
31. Whether shipment/API dates are being used as sales dates.
32. Exact files/functions that must change.
33. Recommended schema changes.
34. Recommended migration/reset strategy.
35. Recommended UI changes.

================================================
PART 40 — IMPLEMENTATION RULE
================================================

After the diagnostic report is approved:

Implement the fix across the complete pipeline.

Do NOT patch only:

- dashboard
- order table
- badge
- API response

Fix the underlying data model and calculations.

The same source data must produce the same result every time.

================================================
FINAL ARCHITECTURE
================================================

                     ETSY CSV
                        ↓
                 Etsy Sales Data
                        ↓
                      ORDER
                        ↑
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        │        Shipment API       FedEx CSV
        │               │                │
        │               ↓                ↓
        │          Order ↔ AWB      Order ↔ AWB
        │               │                │
        └───────────────┴────────────────┘
                        ↓
                 FINAL MAPPING
                        ↓
                FEDEX AWB TOTAL
                        ↓
                 COST ALLOCATION
                        ↓
              ORDER FEDEX COST
                        ↓
             ORDER PROFIT ENGINE


Future:

External Sales API
        ↓
External Sales Data
        ↓
Existing External Order
        ↓
sales_amount
sales_date
product
        ↓
Complete financial calculation


CRITICAL PRINCIPLES:

1. AWB is always TEXT.
2. Order number is always TEXT.
3. Billing line ≠ AWB ≠ Order.
4. AWB can have multiple billing lines.
5. AWB can map to multiple orders.
6. Order can have multiple AWBs.
7. API and FedEx CSV are both valid mapping sources.
8. Same mapping must not be duplicated.
9. Same billing row must not be imported twice.
10. Same CSV must be idempotent.
11. FedEx must never create sales.
12. FedEx invoice date must never become sales date.
13. Shipment date must never become sales date.
14. Unknown sales must not silently become ₹0 unless explicitly required.
15. FedEx-only orders must be stored separately from Etsy financial orders.
16. FedEx cost must be calculated from deduplicated billing data.
17. AWB aggregation must happen BEFORE mapping joins to prevent multiplication.
18. Every financial value must be traceable to its source.
19. Do not fix the UI while leaving the database/calculation problem.
20. Do not modify unrelated Etsy logic unless a shared architecture change requires it.

FIRST DIAGNOSE.
THEN REPORT.
THEN IMPLEMENT.
THEN REBUILD/RECALCULATE.
THEN VALIDATE AGAINST THE SOURCE CSV/API DATA.