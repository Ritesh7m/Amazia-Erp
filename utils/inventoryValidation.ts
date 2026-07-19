import { z } from 'zod';

// Valid: "3506453055", "3556473800-1"
// Invalid: "3278-2" (too short), "Allison zumstein" (text)
// const orderIdRegex = /^\d{10}(-\d+)?$/;
const orderIdRegex = /^\d+(-\d+)?$/; // this accepts any number of digits, optionally followed by a hyphen and more digits, but does not enforce a strict 10-digit requirement

export const inventoryRowSchema = z.object({
  rowIndex: z.number(),
  date: z.string().min(1, "Date is required"),
  orderId: z.string().regex(orderIdRegex, { message: "Order ID must be exactly 10 digits (e.g., 1234567890 or 1234567890-1)" }),
  materialType: z.string().min(1),
  category: z.string().min(1),
  color: z.string().min(1),
  quantity: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: "Quantity must be numeric",
  }),
});