-- Ensure the billing_products table exists with all required columns.
-- This migration is safe to run against an existing table: all DDL uses
-- IF NOT EXISTS / IF NOT EXISTS guards, so no data is lost.

CREATE TABLE IF NOT EXISTS public.billing_products (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    TEXT        NOT NULL,
  description             TEXT,
  billing_type            TEXT        NOT NULL
    CHECK (billing_type IN ('one_time', 'subscription', 'yearly')),
  amount_cents            INTEGER,          -- populated for one_time products
  monthly_price_cents     INTEGER,          -- populated for subscription / yearly products
  setup_fee_cents         INTEGER,          -- legacy field (not written by current code)
  currency                TEXT        NOT NULL DEFAULT 'usd',
  stripe_product_id       TEXT,
  stripe_price_id         TEXT,
  active                  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  bundled_with_product_id UUID        REFERENCES public.billing_products(id)
);

-- If the table already existed before this migration, the columns below
-- may be missing. ADD COLUMN IF NOT EXISTS is a no-op when the column
-- already exists, so this is always safe.
ALTER TABLE public.billing_products
  ADD COLUMN IF NOT EXISTS bundled_with_product_id UUID
    REFERENCES public.billing_products(id);

ALTER TABLE public.billing_products
  ADD COLUMN IF NOT EXISTS setup_fee_cents INTEGER;

ALTER TABLE public.billing_products
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- Enable RLS (idempotent)
ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;

-- Admin policy: full read/write access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'billing_products'
      AND policyname = 'Admins can manage billing products'
  ) THEN
    CREATE POLICY "Admins can manage billing products"
      ON public.billing_products
      FOR ALL
      TO authenticated
      USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
      )
      WITH CHECK (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
      );
  END IF;
END $$;

-- Read policy: authenticated users can read active products
-- (needed so client billing pages can display available products)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'billing_products'
      AND policyname = 'Authenticated users can read active billing products'
  ) THEN
    CREATE POLICY "Authenticated users can read active billing products"
      ON public.billing_products
      FOR SELECT
      TO authenticated
      USING (active = TRUE);
  END IF;
END $$;
