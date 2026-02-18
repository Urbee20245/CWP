-- Platform-wide settings table.
-- Used for settings that apply across all client sites (e.g. Google reCAPTCHA site key).
-- Site key is publicly readable so client-side contact forms can use it without auth.

CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the reCAPTCHA site key row (admin fills it in via Admin Settings)
INSERT INTO platform_settings (key) VALUES ('recaptcha_site_key')
  ON CONFLICT (key) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Public (anonymous) can read the reCAPTCHA site key.
-- Required so unauthenticated contact forms on client sites can load it.
CREATE POLICY "public_read_recaptcha_site_key"
  ON platform_settings FOR SELECT
  TO anon, authenticated
  USING (key = 'recaptcha_site_key');

-- Admins can read and write all settings
CREATE POLICY "admins_manage_platform_settings"
  ON platform_settings FOR ALL
  TO authenticated
  USING   (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));
