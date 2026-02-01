-- SECURITY: Lock down lead ingest config secrets to Admin only

-- Remove client-level SELECT/UPDATE on client_lead_ingest_configs
DROP POLICY IF EXISTS client_lead_ingest_configs_client_select ON public.client_lead_ingest_configs;
DROP POLICY IF EXISTS client_lead_ingest_configs_client_update ON public.client_lead_ingest_configs;

-- Ensure Admin full access policy exists (idempotent)
DROP POLICY IF EXISTS client_lead_ingest_configs_admin_all ON public.client_lead_ingest_configs;
CREATE POLICY client_lead_ingest_configs_admin_all
ON public.client_lead_ingest_configs
FOR ALL TO authenticated
USING (auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin'))
WITH CHECK (auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin'));