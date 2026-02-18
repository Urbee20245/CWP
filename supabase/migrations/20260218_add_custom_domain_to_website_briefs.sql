-- Add custom_domain column to website_briefs
-- Clients can point their own domains (e.g. www.clientsite.com) to this platform.
-- The domain must also be added to the Vercel project to receive traffic.

ALTER TABLE website_briefs
  ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_website_briefs_custom_domain
  ON website_briefs(custom_domain)
  WHERE custom_domain IS NOT NULL;

COMMENT ON COLUMN website_briefs.custom_domain IS
  'Optional custom domain (e.g. www.clientsite.com). Must be registered on the Vercel project to receive traffic.';
