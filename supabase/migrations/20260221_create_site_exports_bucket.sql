-- ─── Site Exports: Storage Bucket + Policies ─────────────────────────────────
--
-- Creates the `site-exports` private storage bucket used by the
-- `export-site-zip` edge function. ZIPs are stored at:
--   site-exports/[client_id]/site-export.zip
--
-- Access is intentionally private (no public reads).  Clients receive a
-- signed URL valid for 24 hours — the only way to download their export.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Create the bucket (private) ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-exports',
  'site-exports',
  false,           -- private: objects are NOT publicly readable
  52428800,        -- 50 MB per object max (ZIP files)
  ARRAY['application/zip', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public              = EXCLUDED.public,
  file_size_limit     = EXCLUDED.file_size_limit,
  allowed_mime_types  = EXCLUDED.allowed_mime_types;

-- ── 2. RLS Policies ───────────────────────────────────────────────────────────

-- Admins can read any export (so they can verify / re-download)
CREATE POLICY "Admins can read site exports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'site-exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND   profiles.role = 'admin'
    )
  );

-- Admins can insert / upsert exports (edge function runs as service role which
-- bypasses RLS, but this covers any future admin-level UI usage)
CREATE POLICY "Admins can upload site exports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND   profiles.role = 'admin'
    )
  );

-- Admins can delete old exports to free storage
CREATE POLICY "Admins can delete site exports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'site-exports'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND   profiles.role = 'admin'
    )
  );

-- Note: The edge function uses the service-role key which bypasses RLS
-- entirely, so the upload in the edge function does not depend on the above
-- policies. These policies are here so admin users can manage exports directly
-- via the Supabase dashboard or a future admin UI if needed.
