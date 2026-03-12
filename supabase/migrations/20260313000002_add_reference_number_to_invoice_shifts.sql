-- Add reference_number to invoice_shifts table
-- Stores the NDIS support item reference number per shift, since different shifts
-- on the same invoice may use different support categories

ALTER TABLE invoice_shifts
  ADD COLUMN IF NOT EXISTS reference_number text;
