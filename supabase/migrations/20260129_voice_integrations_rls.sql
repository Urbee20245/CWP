-- Enable RLS on client_voice_integrations if not already enabled
ALTER TABLE public.client_voice_integrations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT from client_voice_integrations
-- (Admins need to read all clients' voice integration data)
CREATE POLICY IF NOT EXISTS "Authenticated users can read voice integrations"
  ON public.client_voice_integrations
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to INSERT into client_voice_integrations
CREATE POLICY IF NOT EXISTS "Authenticated users can insert voice integrations"
  ON public.client_voice_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to UPDATE client_voice_integrations
CREATE POLICY IF NOT EXISTS "Authenticated users can update voice integrations"
  ON public.client_voice_integrations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also ensure client_integrations is readable by authenticated users
-- (Admins need to check if clients have Twilio credentials configured)
ALTER TABLE public.client_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can read client integrations"
  ON public.client_integrations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can insert client integrations"
  ON public.client_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can update client integrations"
  ON public.client_integrations
  FOR UPDATE
  TO authenticated
  WITH CHECK (true);
