-- App stores shift_date as d/M display strings (e.g. 4/6), not ISO dates.
ALTER TABLE public.invoice_shifts
  ALTER COLUMN shift_date TYPE TEXT
  USING TRIM(TO_CHAR(shift_date, 'FMDD') || '/' || TO_CHAR(shift_date, 'FMMM'));
