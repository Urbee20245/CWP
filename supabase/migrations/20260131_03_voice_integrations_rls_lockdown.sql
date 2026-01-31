-- =============================================================================
-- Voice Integrations RLS Lockdown (Live Fix)
-- Date: 2026-01-31
-- Description:
--   Removes insecure/overly broad policies on client_voice_integrations
--   (including anon SELECT). Keeps service-role access implicit.
--   Ensures only admins and client owners can SELECT/UPDATE their rows.
-- =============================================================================

ALTER TABLE public.client_voice_integrations ENABLE ROW LEVEL SECURITY;

-- Drop insecure/broad policies (safe/idempotent)
DROP POLICY IF EXISTS "Anon can read voice integrations" ON public.client_voice_integrations;
DROP POLICY IF EXISTS "Authenticated users can read voice integrations" ON public.client_voice_integrations;
DROP POLICY IF EXISTS "Authenticated users can insert voice integrations" ON public.client_voice_integrations;
DROP POLICY IF EXISTS "Authenticated users can update voice integrations" ON public.client_voice_integrations;
DROP POLICY IF EXISTS "Authenticated users can delete voice integrations" ON public.client_voice_integrations;

-- Explicit client-owner update policy (select policy already exists in many envs)
DROP POLICY IF EXISTS "voice_integrations_client_owner_select" ON public.client_voice_integrations;
CREATE POLICY "voice_integrations_client_owner_select"
  ON public.client_voice_integrations
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "voice_integrations_client_owner_update" ON public.client_voice_integrations;
CREATE POLICY "voice_integrations_client_owner_update"
  ON public.client_voice_integrations
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );

-- Ensure explicit admin policy exists (mirrors appointments approach)
DROP POLICY IF EXISTS "voice_integrations_admin_all" ON public.client_voice_integrations;
CREATE POLICY "voice_integrations_admin_all"
  ON public.client_voice_integrations
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin')
  );
