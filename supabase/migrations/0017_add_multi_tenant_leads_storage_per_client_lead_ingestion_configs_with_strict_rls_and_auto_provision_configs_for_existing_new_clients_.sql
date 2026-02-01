-- Create a secure per-client configuration table for public lead ingestion
CREATE TABLE IF NOT EXISTS public.client_lead_ingest_configs (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  ingest_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  enabled BOOLEAN NOT NULL DEFAULT true,
  allowed_origins TEXT[] NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep updated_at current (function already exists in this project)
DROP TRIGGER IF EXISTS set_updated_at ON public.client_lead_ingest_configs;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.client_lead_ingest_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Leads table (multi-tenant)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  message TEXT NULL,
  source TEXT NULL,
  page_url TEXT NULL,
  referrer TEXT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT NULL,
  ip_address TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_client_created_at_idx ON public.leads (client_id, created_at DESC);

-- RLS (REQUIRED)
ALTER TABLE public.client_lead_ingest_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS client_lead_ingest_configs_admin_all ON public.client_lead_ingest_configs;
CREATE POLICY client_lead_ingest_configs_admin_all
ON public.client_lead_ingest_configs
FOR ALL TO authenticated
USING (
  auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin')
)
WITH CHECK (
  auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin')
);

DROP POLICY IF EXISTS leads_admin_all ON public.leads;
CREATE POLICY leads_admin_all
ON public.leads
FOR ALL TO authenticated
USING (
  auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin')
)
WITH CHECK (
  auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin')
);

-- Client-owner access (no anon access)
DROP POLICY IF EXISTS client_lead_ingest_configs_client_select ON public.client_lead_ingest_configs;
CREATE POLICY client_lead_ingest_configs_client_select
ON public.client_lead_ingest_configs
FOR SELECT TO authenticated
USING (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.owner_profile_id = auth.uid())
);

DROP POLICY IF EXISTS client_lead_ingest_configs_client_update ON public.client_lead_ingest_configs;
CREATE POLICY client_lead_ingest_configs_client_update
ON public.client_lead_ingest_configs
FOR UPDATE TO authenticated
USING (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.owner_profile_id = auth.uid())
)
WITH CHECK (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.owner_profile_id = auth.uid())
);

-- Leads: clients can read/update their own leads (inserts happen via Edge Function/service role)
DROP POLICY IF EXISTS leads_client_select ON public.leads;
CREATE POLICY leads_client_select
ON public.leads
FOR SELECT TO authenticated
USING (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.owner_profile_id = auth.uid())
);

DROP POLICY IF EXISTS leads_client_update ON public.leads;
CREATE POLICY leads_client_update
ON public.leads
FOR UPDATE TO authenticated
USING (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.owner_profile_id = auth.uid())
)
WITH CHECK (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.owner_profile_id = auth.uid())
);

-- Ensure every client has a config row
INSERT INTO public.client_lead_ingest_configs (client_id)
SELECT id FROM public.clients
ON CONFLICT (client_id) DO NOTHING;

-- Auto-create config when new client is created
CREATE OR REPLACE FUNCTION public.create_default_lead_ingest_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.client_lead_ingest_configs (client_id)
  VALUES (NEW.id)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_client_created_lead_ingest ON public.clients;
CREATE TRIGGER on_client_created_lead_ingest
AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.create_default_lead_ingest_config();
