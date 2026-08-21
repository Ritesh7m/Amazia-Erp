import { z } from 'zod';

// Regex for strict YYYY-MM-DD date format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const fedexRowSchema = z.object({
  invoice_type: z.string(),
  invoice_date: z.string().regex(dateRegex, "Invalid Invoice Date").or(z.string().length(0)),
  due_date: z.string().regex(dateRegex, "Invalid Due Date").or(z.string().length(0)),
  awb_number: z.string().min(1, "AWB Number is required"),
  air_waybill_total_amount: z.number()
});

export const etsyRowSchema = z.object({
  order_no: z.string().min(1, "Order Number is required"),
  date: z.string().regex(dateRegex, "Invalid Date format"),
  type: z.literal("Sale"),
  net_amt: z.number()
});

export const etsyExpenseRowSchema = z.object({
  order_no: z.string(), // Can be empty for non-order expenses like listing fees
  expense_type: z.string().min(1, "Expense type is required"),
  expense_amount: z.number().min(0, "Expense amount must be non-negative"),
  source_transaction_type: z.string(),
  source_description: z.string(),
  listing_id: z.string().nullable(),
  import_reference: z.string(),
});