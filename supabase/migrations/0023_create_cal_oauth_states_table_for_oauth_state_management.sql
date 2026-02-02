-- Create cal_oauth_states table for OAuth state management
CREATE TABLE IF NOT EXISTS public.cal_oauth_states (
  state_token TEXT PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  return_to TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cal_oauth_states ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cal_oauth_states_client_id ON public.cal_oauth_states(client_id);
CREATE INDEX IF NOT EXISTS idx_cal_oauth_states_expires_at ON public.cal_oauth_states(expires_at);

-- RLS Policies
CREATE POLICY "cal_oauth_states_insert_own"
  ON public.cal_oauth_states
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );

CREATE POLICY "cal_oauth_states_select_own"
  ON public.cal_oauth_states
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );

CREATE POLICY "cal_oauth_states_admin_all"
  ON public.cal_oauth_states
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');