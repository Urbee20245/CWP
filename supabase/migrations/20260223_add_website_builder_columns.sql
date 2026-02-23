-- Migration: Add new website builder columns to website_briefs
-- These columns are required by the generate-website edge function and the AI builder UI.

ALTER TABLE website_briefs
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS services_offered text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#4F46E5',
  ADD COLUMN IF NOT EXISTS art_direction text,
  ADD COLUMN IF NOT EXISTS generation_status text DEFAULT 'draft'
    CHECK (generation_status IN ('draft', 'generating', 'complete', 'error')),
  ADD COLUMN IF NOT EXISTS generation_error text,
  ADD COLUMN IF NOT EXISTS client_slug text UNIQUE;

-- Back-fill new columns from old column names so existing rows keep their data
UPDATE website_briefs SET
  services_offered = COALESCE(services_offered, services, ''),
  primary_color    = COALESCE(primary_color, brand_color, '#4F46E5'),
  art_direction    = COALESCE(art_direction, art_direction_notes),
  generation_status = CASE WHEN is_generation_complete = true THEN 'complete' ELSE 'draft' END,
  client_slug      = COALESCE(client_slug, slug);
