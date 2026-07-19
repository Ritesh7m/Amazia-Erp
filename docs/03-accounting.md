# Accounting Engine & Reconciliation

The Amazia ERP Accounting Engine acts as the central brain of the application. It takes the normalized data from DuckDB (`etsy_statement`, `fedex_billing`, and `inventory_table`) and calculates accurate profitability per order.

## 1. The Reconciliation Process

Reconciliation happens dynamically when the dashboard requests financial metrics. The engine performs a multi-step join across the DuckDB tables:

1. **Base Sales:** Retrieves the `net_amt` from the `etsy_statement` table using the `order_no`.
2. **Shipping & Duty Allocation:** 
   * Uses the `shipment_order_mapping` table to link the Etsy `order_no` to a FedEx `awb_number`.
   * Pulls the `air_waybill_total_amount` from the `fedex_billing` table.
3. **Cost of Goods Sold (COGS):** Maps the `order_no` to the `inventory_table` to calculate the total material and production costs based on order quantities.

---

## 2. Mathematical Calculations

The engine applies specific formulas to calculate costs, allocations, and final profit margins.

### **A. Material Cost**
Calculated using the total quantity of items produced for an order from the Google Sheets inventory data.
* **Formula:** `Total Quantity × ₹(multiplyer)` *(Base unit cost)*

### **B. Book Expense Cost**
Calculated directly from the FedEx Air Waybill (AWB) amount to extract the underlying expense (commonly used for reverse tax/GST calculations).
* **Formula:** `AWB Total Amount × (18 / 118)`

### **C. FedEx Cost Allocation**
If a single FedEx shipment (AWB) contains multiple Etsy orders, the total shipping cost is distributed equally among the mapped orders.
* **Formula:** `Total AWB Cost ÷ Number of Orders Mapped to that AWB`

### **D. Net Profit**
The absolute monetary profit made on a specific order after deducting all associated expenses.
* **Formula:** `Gross Sales (net_amt) − Material Cost − Duty Cost/Transport Cost`

### **E. Profit Margin (%)**
The percentage of revenue that remains as profit after all expenses are paid.
* **Formula:** `(Net Profit ÷ Gross Sales) × 100`

---

## 3. Reporting & Output

The resulting data is served to the frontend dashboard via Next.js Route Handlers. The dashboard visualizes:
* Total Revenue vs. Total Expenses
* Profit margins per Etsy Order
* Unmapped records (e.g., an Etsy sale missing a FedEx AWB, or a FedEx bill missing an Etsy order) to flag for manual review.