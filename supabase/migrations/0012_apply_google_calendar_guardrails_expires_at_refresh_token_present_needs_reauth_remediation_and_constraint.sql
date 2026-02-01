ALTER TABLE public.client_google_calendar
  ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_token_present BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reauth_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

UPDATE public.client_google_calendar
SET refresh_token_present = (google_refresh_token IS NOT NULL AND length(trim(google_refresh_token)) > 0)
WHERE refresh_token_present = false;

UPDATE public.client_google_calendar
SET connection_status = 'needs_reauth',
    reauth_reason = COALESCE(reauth_reason, 'missing_refresh_token'),
    last_error = COALESCE(last_error, 'Refresh token missing.'),
    refresh_token_present = false
WHERE connection_status = 'connected'
  AND (google_refresh_token IS NULL OR length(trim(google_refresh_token)) = 0);

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

CREATE INDEX IF NOT EXISTS idx_client_google_calendar_status
  ON public.client_google_calendar (connection_status);
