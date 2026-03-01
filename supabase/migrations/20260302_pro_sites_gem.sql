-- Pro Sites GEM: add onboarding token + client link to checkouts
ALTER TABLE public.pro_sites_checkouts
  ADD COLUMN IF NOT EXISTS onboarding_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS onboarding_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pro_sites_checkouts_onboarding_token_idx
  ON public.pro_sites_checkouts(onboarding_token);

-- Pro Sites GEM progress table
CREATE TABLE IF NOT EXISTS public.pro_sites_gem_progress (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id           uuid NOT NULL UNIQUE REFERENCES public.pro_sites_checkouts(id) ON DELETE CASCADE,
  profile_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  account_linked        boolean NOT NULL DEFAULT false,
  phone_setup_status    text NOT NULL DEFAULT 'pending',
  preferred_area_code   text,
  phone_carrier_name    text,
  phone_notes           text,
  cal_setup_status      text NOT NULL DEFAULT 'pending',
  a2p_submitted         boolean NOT NULL DEFAULT false,
  a2p_data              jsonb NOT NULL DEFAULT '{}',
  brand_assets_uploaded boolean NOT NULL DEFAULT false,
  brand_notes           text,
  addon_requests        text[] NOT NULL DEFAULT '{}',
  current_step          text NOT NULL DEFAULT 'auth_check',
  completed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.pro_sites_gem_progress ENABLE ROW LEVEL SECURITY;

-- Allow anon to upsert (token-validated via edge function; checkout_id is the guard)
CREATE POLICY "gem_progress_insert_anon" ON public.pro_sites_gem_progress
  FOR INSERT WITH CHECK (true);

CREATE POLICY "gem_progress_upsert_anon" ON public.pro_sites_gem_progress
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "gem_progress_select_anon" ON public.pro_sites_gem_progress
  FOR SELECT USING (true);

-- Admins can see all
CREATE POLICY "gem_progress_admin_all" ON public.pro_sites_gem_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE public.pro_sites_gem_progress IS
  'Tracks step-by-step GEM onboarding progress for each Pro Sites checkout.';
