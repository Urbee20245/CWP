ALTER TABLE public.client_voice_integrations
  ADD COLUMN IF NOT EXISTS retell_workspace_id       TEXT,
  ADD COLUMN IF NOT EXISTS retell_workspace_api_key  TEXT,
  ADD COLUMN IF NOT EXISTS voice_monthly_budget_cents INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS voice_budget_alert_sent_at TIMESTAMPTZ;