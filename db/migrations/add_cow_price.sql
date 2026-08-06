-- Add cow_price column if missing
ALTER TABLE public.booking_controls
  ADD COLUMN IF NOT EXISTS cow_price NUMERIC(10,2) DEFAULT 13000;

-- Copy existing generic price into cow_price for existing rows
UPDATE public.booking_controls
SET cow_price = COALESCE(price, 13000)
WHERE cow_price IS NULL;

-- (Optional) Enforce not null
-- ALTER TABLE public.booking_controls ALTER COLUMN cow_price SET NOT NULL;
