-- =========================================================
-- Blog Automation: SEO fields on blog_posts + scheduling
-- =========================================================

-- Add SEO & image columns to existing blog_posts table
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS featured_image_url   text,
  ADD COLUMN IF NOT EXISTS featured_image_alt   text,
  ADD COLUMN IF NOT EXISTS meta_title           text,
  ADD COLUMN IF NOT EXISTS meta_description     text,
  ADD COLUMN IF NOT EXISTS seo_keywords         text[];

-- =========================================================
-- Blog Schedules — "set it and leave it" automation
-- =========================================================
CREATE TABLE IF NOT EXISTS blog_schedules (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_active            boolean     NOT NULL DEFAULT true,
  days_of_week         text[]      NOT NULL DEFAULT '{}',   -- ['monday','thursday']
  word_count           integer     NOT NULL DEFAULT 600,
  auto_publish         boolean     NOT NULL DEFAULT false,
  generate_images      boolean     NOT NULL DEFAULT true,
  total_posts_target   integer     DEFAULT NULL,            -- NULL = unlimited / ongoing
  posts_generated      integer     NOT NULL DEFAULT 0,
  author_name          text        NOT NULL DEFAULT 'The Team',
  started_at           timestamptz NOT NULL DEFAULT now(),
  ends_at              timestamptz DEFAULT NULL,            -- derived from target if set
  last_run_at          timestamptz DEFAULT NULL,
  next_run_date        date        DEFAULT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)                                        -- one schedule per client
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_blog_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_schedules_updated_at
  BEFORE UPDATE ON blog_schedules
  FOR EACH ROW EXECUTE FUNCTION update_blog_schedules_updated_at();

-- RLS (service role manages via edge functions; admins via service role)
ALTER TABLE blog_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to blog_schedules"
  ON blog_schedules USING (true) WITH CHECK (true);
