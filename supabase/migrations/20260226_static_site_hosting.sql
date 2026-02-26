-- ─────────────────────────────────────────────────────────────────────────────
-- Static Site Hosting — Migration
-- Adds site_type + static_dist_path to website_briefs, creates the
-- static_site_leads table, creates the static-sites storage bucket, and sets
-- storage policies for public reads / authenticated writes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Part 1: website_briefs columns ───────────────────────────────────────────

ALTER TABLE public.website_briefs
  ADD COLUMN IF NOT EXISTS site_type TEXT NOT NULL DEFAULT 'cwp'
    CHECK (site_type IN ('cwp', 'static')),
  ADD COLUMN IF NOT EXISTS static_dist_path TEXT;

COMMENT ON COLUMN public.website_briefs.site_type IS
  'cwp = rendered by CWP JSON engine; static = served from Supabase Storage';

COMMENT ON COLUMN public.website_briefs.static_dist_path IS
  'Storage path prefix for static sites, e.g. gapbridgecs/';

-- ── Part 1: static_site_leads table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.static_site_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_slug    TEXT NOT NULL,
  first_name     TEXT,
  last_name      TEXT,
  email          TEXT,
  phone          TEXT,
  topic          TEXT,
  timeline       TEXT,
  priority_score INT,
  future_date    TEXT,
  message        TEXT,
  source         TEXT,
  page_url       TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.static_site_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to static_site_leads" ON public.static_site_leads;
CREATE POLICY "Admin full access to static_site_leads"
  ON public.static_site_leads
  FOR ALL
  TO authenticated
  USING (true);

-- ── Part 2: static-sites storage bucket ──────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('static-sites', 'static-sites', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (drop first in case of re-run)
DROP POLICY IF EXISTS "Public read static sites" ON storage.objects;
CREATE POLICY "Public read static sites"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'static-sites');

DROP POLICY IF EXISTS "Admin upload static sites" ON storage.objects;
CREATE POLICY "Admin upload static sites"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'static-sites');

DROP POLICY IF EXISTS "Admin delete static sites" ON storage.objects;
CREATE POLICY "Admin delete static sites"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'static-sites');
