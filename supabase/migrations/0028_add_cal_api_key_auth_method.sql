-- Add auth_method column to distinguish OAuth vs API key connections
ALTER TABLE public.client_cal_calendar
  ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'oauth'
  CHECK (auth_method IN ('oauth', 'api_key'));

-- Drop the old constraint that requires refresh_token for connected status
ALTER TABLE public.client_cal_calendar
  DROP CONSTRAINT IF EXISTS client_cal_calendar_connected_requires_refresh;

-- Add relaxed constraint: connected requires EITHER api_key auth OR a valid refresh token
ALTER TABLE public.client_cal_calendar
  ADD CONSTRAINT client_cal_calendar_connected_requires_auth
  CHECK (
    connection_status <> 'connected'
    OR auth_method = 'api_key'
    OR (refresh_token_present = true AND length(trim(cal_refresh_token)) > 0)
  );
