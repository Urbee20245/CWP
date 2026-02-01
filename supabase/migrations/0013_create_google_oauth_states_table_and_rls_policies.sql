CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  state_token TEXT PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_oauth_states_insert_own ON public.google_oauth_states;
CREATE POLICY google_oauth_states_insert_own
  ON public.google_oauth_states
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS google_oauth_states_select_own ON public.google_oauth_states;
CREATE POLICY google_oauth_states_select_own
  ON public.google_oauth_states
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS google_oauth_states_admin_all ON public.google_oauth_states;
CREATE POLICY google_oauth_states_admin_all
  ON public.google_oauth_states
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_google_oauth_states_client_id ON public.google_oauth_states (client_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expires_at ON public.google_oauth_states (expires_at);
