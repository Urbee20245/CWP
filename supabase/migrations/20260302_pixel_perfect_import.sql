-- Pixel-perfect site import: new columns and tables

-- Add source preservation columns to website_briefs
ALTER TABLE website_briefs
  ADD COLUMN IF NOT EXISTS source_files JSONB,
  ADD COLUMN IF NOT EXISTS asset_mapping JSONB,
  ADD COLUMN IF NOT EXISTS build_config JSONB,
  ADD COLUMN IF NOT EXISTS framework_type TEXT;

-- Form submissions table for imported sites
CREATE TABLE IF NOT EXISTS client_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  form_data JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  source_url TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_client
  ON client_form_submissions(client_id, submitted_at DESC);

-- Enable RLS
ALTER TABLE client_form_submissions ENABLE ROW LEVEL SECURITY;

-- Make client-assets bucket public for CDN delivery
UPDATE storage.buckets
  SET public = true,
      file_size_limit = 52428800,
      allowed_mime_types = NULL
  WHERE id = 'client-assets';

-- Storage policies for client-assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'client-assets public read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "client-assets public read"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'client-assets')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'client-assets service upload'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "client-assets service upload"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'client-assets')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'client-assets service update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "client-assets service update"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'client-assets')
    $policy$;
  END IF;

  -- Form submissions admin access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'client_form_submissions'
      AND policyname = 'admin full access form submissions'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin full access form submissions"
        ON client_form_submissions
        FOR ALL
        USING (auth.role() IN ('authenticated', 'service_role'))
        WITH CHECK (auth.role() IN ('authenticated', 'service_role'))
    $policy$;
  END IF;
END $$;
