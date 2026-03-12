-- Add editable shift fields to fixed_shifts table
-- Allows weekly shift templates to carry their own rate, mileage defaults,
-- and NDIS reference number rather than always inheriting from the client

ALTER TABLE fixed_shifts
  ADD COLUMN IF NOT EXISTS hourly_rate    numeric,
  ADD COLUMN IF NOT EXISTS mileage        numeric,
  ADD COLUMN IF NOT EXISTS mileage_rate   numeric,
  ADD COLUMN IF NOT EXISTS expenses       text,
  ADD COLUMN IF NOT EXISTS reference_number text;
