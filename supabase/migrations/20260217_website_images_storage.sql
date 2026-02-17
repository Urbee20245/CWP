-- Create website-images storage bucket for logos and hero images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-images',
  'website-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users (admins) to upload images
CREATE POLICY IF NOT EXISTS "Admins can upload website images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'website-images');

-- Allow authenticated users to update/replace images
CREATE POLICY IF NOT EXISTS "Admins can update website images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'website-images');

-- Allow authenticated users to delete images
CREATE POLICY IF NOT EXISTS "Admins can delete website images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'website-images');

-- Allow public read access for published website images
CREATE POLICY IF NOT EXISTS "Public can view website images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'website-images');
