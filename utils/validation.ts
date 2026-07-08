import { z } from 'zod';

// Regex for strict YYYY-MM-DD date format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const fedexRowSchema = z.object({
  invoice_type: z.string().min(1, "Invoice Type is required"),
  invoice_date: z.string().regex(dateRegex, "Invalid Invoice Date"),
  due_date: z.string().regex(dateRegex, "Invalid Due Date"),
  awb_number: z.string().min(1, "AWB Number is required"),
  air_waybill_total_amount: z.number(),
  book_expense_cost: z.number()
});

export const etsyRowSchema = z.object({
  order_no: z.string().min(1, "Order Number is required"),
  date: z.string().regex(dateRegex, "Invalid Date format"),
  type: z.literal("Sale"),
  net_amt: z.number()
});