ALTER TABLE public.client_voice_integrations
ADD COLUMN IF NOT EXISTS manually_provisioned boolean DEFAULT false;