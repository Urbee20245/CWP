-- Create client_cal_calendar table for Cal.com OAuth integration
CREATE TABLE IF NOT EXISTS public.client_cal_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  
  -- Cal.com OAuth tokens (encrypted)
  cal_access_token TEXT NOT NULL DEFAULT '',
  cal_refresh_token TEXT NOT NULL DEFAULT '',
  
  -- Token metadata
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_present BOOLEAN NOT NULL DEFAULT false,
  
  -- Connection status
  connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'needs_reauth')),
  reauth_reason TEXT,
  last_error TEXT,
  
  -- Cal.com specific
  cal_user_id TEXT,
  default_event_type_id TEXT,
  
  -- Diagnostics
  last_synced_at TIMESTAMPTZ,
  last_successful_calendar_call TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_cal_calendar ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_cal_calendar_client_id ON public.client_cal_calendar(client_id);
CREATE INDEX IF NOT EXISTS idx_client_cal_calendar_status ON public.client_cal_calendar(connection_status);

-- Constraint: connected status requires refresh token
ALTER TABLE public.client_cal_calendar
  ADD CONSTRAINT client_cal_calendar_connected_requires_refresh
  CHECK (
    connection_status <> 'connected'
    OR (refresh_token_present = true AND length(trim(cal_refresh_token)) > 0)
  );

-- RLS Policies
CREATE POLICY "client_cal_calendar_admin_all"
  ON public.client_cal_calendar
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE POLICY "client_cal_calendar_client_owner_select"
  ON public.client_cal_calendar
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );

CREATE POLICY "client_cal_calendar_client_owner_update"
  ON public.client_cal_calendar
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_client_cal_calendar
  BEFORE UPDATE ON public.client_cal_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();