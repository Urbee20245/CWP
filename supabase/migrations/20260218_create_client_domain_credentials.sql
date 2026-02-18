-- Store client domain registrar credentials so admin can log in on their behalf
-- Credentials are protected by RLS: clients can only see/edit their own row,
-- admins can read all rows.

CREATE TABLE IF NOT EXISTS client_domain_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  registrar_name  TEXT NOT NULL DEFAULT '',
  login_url       TEXT NOT NULL DEFAULT '',
  username        TEXT NOT NULL DEFAULT '',
  password        TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per client
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_domain_credentials_client_id
  ON client_domain_credentials(client_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_domain_credentials_updated_at
  BEFORE UPDATE ON client_domain_credentials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE client_domain_credentials ENABLE ROW LEVEL SECURITY;

-- Clients can INSERT / SELECT / UPDATE their own row
CREATE POLICY "clients_manage_own_domain_credentials"
  ON client_domain_credentials
  FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE owner_profile_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE owner_profile_id = auth.uid()
    )
  );

-- Admins can read all rows
CREATE POLICY "admins_read_domain_credentials"
  ON client_domain_credentials
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );
