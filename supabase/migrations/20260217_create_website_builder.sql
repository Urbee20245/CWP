-- Website Builder: AI-generated client websites
-- One row per client. Holds brief inputs + full AI-generated website JSON.

CREATE TABLE IF NOT EXISTS public.website_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Brief inputs (filled by admin)
    business_name TEXT NOT NULL,
    industry TEXT NOT NULL,
    services_offered TEXT NOT NULL,
    location TEXT NOT NULL,
    tone TEXT NOT NULL DEFAULT 'Professional' CHECK (tone IN ('Professional', 'Friendly', 'Bold', 'Luxurious')),
    art_direction TEXT,
    primary_color TEXT NOT NULL DEFAULT '#4F46E5',

    -- Generation state
    generation_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (generation_status IN ('draft', 'generating', 'complete', 'error')),
    generation_error TEXT,

    -- AI-generated website content (full JSON)
    website_json JSONB,

    -- Public URL slug: /site/[client_slug]
    client_slug TEXT UNIQUE,

    -- Publishing
    is_published BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id)
);

-- One website per client
CREATE UNIQUE INDEX IF NOT EXISTS website_briefs_client_id_unique ON public.website_briefs(client_id);

-- Fast slug lookups for public site rendering
CREATE INDEX IF NOT EXISTS website_briefs_slug_idx ON public.website_briefs(client_slug)
    WHERE client_slug IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_website_briefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_website_briefs_updated_at
    BEFORE UPDATE ON public.website_briefs
    FOR EACH ROW EXECUTE FUNCTION update_website_briefs_updated_at();

-- RLS
ALTER TABLE public.website_briefs ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage website briefs"
    ON public.website_briefs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Clients can read their own brief (to render the My Website page)
CREATE POLICY "Client reads own website brief"
    ON public.website_briefs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE clients.id = website_briefs.client_id
            AND clients.owner_profile_id = auth.uid()
        )
    );

-- Anyone (anon) can read published sites (for public /site/[slug] route)
CREATE POLICY "Public can view published sites"
    ON public.website_briefs FOR SELECT
    USING (is_published = TRUE);

-- Service role bypasses RLS (edge functions use service role)
CREATE POLICY "Service role full access"
    ON public.website_briefs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.website_briefs IS 'One row per client. Holds admin brief inputs and AI-generated website JSON.';
COMMENT ON COLUMN public.website_briefs.website_json IS 'Full website JSON: { global, seo, page_structure: [{ section_type, variant, content, editable_fields }] }';
COMMENT ON COLUMN public.website_briefs.client_slug IS 'URL-safe slug for /site/[slug] public route.';
COMMENT ON COLUMN public.website_briefs.editable_fields IS 'Array of dot-path strings clients are allowed to edit (e.g. content.phone).';
