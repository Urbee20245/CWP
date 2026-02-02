-- Add billing fields to appointments to support free vs paid bookings
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS hosted_invoice_url TEXT NULL;

CREATE INDEX IF NOT EXISTS appointments_client_time_idx ON public.appointments (client_id, appointment_time DESC);
