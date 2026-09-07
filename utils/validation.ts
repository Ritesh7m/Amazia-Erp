import { z } from 'zod';

// Regex for strict YYYY-MM-DD date format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Detects if a string is in scientific notation (e.g. 8.70E+11, 8.70e+11, 8.7E11, 8.70123456789E+11).
 * Case-insensitive check.
 */
export const isScientificNotation = (val: string | number | null | undefined): boolean => {
  if (val == null) return false;
  const str = String(val).trim().replace(/^["']+|["']+$/g, '');
  if (!str) return false;
  return /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/i.test(str);
};

export const fedexRowSchema = z.object({
  invoice_type: z.string(),
  invoice_date: z.string().regex(dateRegex, "Invalid Invoice Date").or(z.string().length(0)),
  due_date: z.string().regex(dateRegex, "Invalid Due Date").or(z.string().length(0)),
  awb_number: z
    .string()
    .min(1, "AWB Number is required")
    .refine((val) => !isScientificNotation(val), {
      message: "Air Waybill Number cannot be in scientific notation"
    }),
  air_waybill_total_amount: z.number(),
  order_no: z.string().optional(),
  country: z.string().optional(),
  shipper_reference_1: z.string().optional(),
  parsed_order_no: z.string().optional(),
  recipient_country: z.string().optional()
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