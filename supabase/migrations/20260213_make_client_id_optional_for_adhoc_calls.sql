-- Migration: Make client_id optional for ad-hoc calls
-- Date: 2026-02-13
-- Purpose: Allow admins to make calls to anyone, not just existing clients

-- Make client_id nullable
ALTER TABLE public.retell_scheduled_calls
  ALTER COLUMN client_id DROP NOT NULL;

-- Update comment to reflect the change
COMMENT ON COLUMN public.retell_scheduled_calls.client_id IS 'Optional: Reference to the client. NULL for ad-hoc calls to non-clients';
