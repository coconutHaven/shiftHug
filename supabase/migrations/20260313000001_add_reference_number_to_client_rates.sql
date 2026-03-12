-- Add reference_number to client_rates table
-- Allows each rate to be associated with an NDIS support item reference number

ALTER TABLE client_rates
  ADD COLUMN IF NOT EXISTS reference_number text;
