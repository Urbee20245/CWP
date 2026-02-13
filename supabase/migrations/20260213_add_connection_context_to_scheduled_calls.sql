-- Migration: Add connection context fields to retell_scheduled_calls
-- Date: 2026-02-13
-- Purpose: Store how the admin met the prospect for personalized agent scripts

ALTER TABLE public.retell_scheduled_calls
ADD COLUMN IF NOT EXISTS connection_type TEXT CHECK (connection_type IN ('referral', 'event', 'linkedin', 'website', 'direct', 'other')),
ADD COLUMN IF NOT EXISTS referrer_name TEXT,
ADD COLUMN IF NOT EXISTS event_name TEXT,
ADD COLUMN IF NOT EXISTS direct_context TEXT;

-- Add helpful comments
COMMENT ON COLUMN public.retell_scheduled_calls.connection_type IS 'How the admin connected with the prospect: referral, event, linkedin, website, direct, or other';
COMMENT ON COLUMN public.retell_scheduled_calls.referrer_name IS 'Name of person who referred the prospect (used when connection_type = referral)';
COMMENT ON COLUMN public.retell_scheduled_calls.event_name IS 'Name of event where admin met prospect (used when connection_type = event)';
COMMENT ON COLUMN public.retell_scheduled_calls.direct_context IS 'Brief context for direct connections (used when connection_type = direct)';
