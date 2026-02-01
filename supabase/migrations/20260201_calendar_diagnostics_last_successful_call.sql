-- =============================================================================
-- Calendar Diagnostics: last_successful_calendar_call
-- Date: 2026-02-01
-- =============================================================================

ALTER TABLE public.client_google_calendar
  ADD COLUMN IF NOT EXISTS last_successful_calendar_call TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_client_google_calendar_last_success
  ON public.client_google_calendar (last_successful_calendar_call DESC);
