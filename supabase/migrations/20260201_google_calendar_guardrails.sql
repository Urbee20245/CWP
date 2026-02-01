-- =============================================================================
-- Google Calendar Integration Guardrails
-- Date: 2026-02-01
-- Description:
--   - Add expires_at + refresh_token_present + diagnostic fields
--   - Ensure UI cannot show "Connected" without a refresh token
--   - Mark broken legacy connections as needs_reauth
-- =============================================================================

-- 1) Add missing columns (safe, idempotent)
ALTER TABLE public.client_google_calendar
  ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token_present BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reauth_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 2) Backfill refresh_token_present based on stored refresh token (encrypted string)
UPDATE public.client_google_calendar
SET refresh_token_present = (google_refresh_token IS NOT NULL AND length(trim(google_refresh_token)) > 0)
WHERE refresh_token_present = false;

-- 3) Ensure no row can be "connected" without refresh token present
--    First, remediate any existing bad rows.
UPDATE public.client_google_calendar
SET connection_status = 'needs_reauth',
    reauth_reason = COALESCE(reauth_reason, 'missing_refresh_token'),
    last_error = COALESCE(last_error, 'Refresh token missing.'),
    refresh_token_present = false
WHERE connection_status = 'connected'
  AND (google_refresh_token IS NULL OR length(trim(google_refresh_token)) = 0);

-- 4) Add a CHECK constraint to prevent future false positives
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_google_calendar_connected_requires_refresh'
  ) THEN
    ALTER TABLE public.client_google_calendar
      ADD CONSTRAINT client_google_calendar_connected_requires_refresh
      CHECK (
        connection_status <> 'connected'
        OR (refresh_token_present = true AND length(trim(google_refresh_token)) > 0)
      );
  END IF;
END $$;

-- 5) Helpful index
CREATE INDEX IF NOT EXISTS idx_client_google_calendar_status
  ON public.client_google_calendar (connection_status);
