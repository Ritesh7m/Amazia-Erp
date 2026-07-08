export const SUPPORTED_INVOICE_TYPES = {
  FEDEX: 'FedEx Billing',
  ETSY: 'Etsy Statement',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;