-- Blog posts table for AI-generated client blog content (premium add-on)
CREATE TABLE IF NOT EXISTS blog_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title       text NOT NULL,
  slug        text NOT NULL,
  excerpt     text,
  content     text,    -- Full article content (HTML/markdown)
  category    text,
  author_name text DEFAULT 'The Team',
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, slug)
);

-- Index for fetching published posts by client
CREATE INDEX IF NOT EXISTS blog_posts_client_published_idx
ON blog_posts (client_id, is_published, published_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_blog_posts_updated_at();

-- RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Admins (service role) have full access — handled at app layer
-- Clients can read their own posts
CREATE POLICY "Clients can read their blog posts"
ON blog_posts FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE owner_profile_id = auth.uid()
  )
);

-- Public can read published posts (for the public website)
CREATE POLICY "Public can read published blog posts"
ON blog_posts FOR SELECT
TO anon
USING (is_published = true);

-- Add blog_enabled flag to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS blog_enabled boolean NOT NULL DEFAULT false;
