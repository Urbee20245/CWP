-- Add Retell workspace billing columns to client_voice_integrations
-- Each client has their own Retell workspace with a separate API key
ALTER TABLE public.client_voice_integrations
  ADD COLUMN IF NOT EXISTS retell_workspace_id       TEXT,
  ADD COLUMN IF NOT EXISTS retell_workspace_api_key  TEXT,
  ADD COLUMN IF NOT EXISTS voice_monthly_budget_cents INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS voice_budget_alert_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.client_voice_integrations.retell_workspace_id IS 'The Retell AI workspace ID for this client (admin-managed)';
COMMENT ON COLUMN public.client_voice_integrations.retell_workspace_api_key IS 'Per-client Retell workspace API key (admin-managed, service-role access only)';
COMMENT ON COLUMN public.client_voice_integrations.voice_monthly_budget_cents IS 'Client monthly AI voice budget in cents. Minimum 1000 ($10.00). Default 1000.';
COMMENT ON COLUMN public.client_voice_integrations.voice_budget_alert_sent_at IS 'Timestamp of last 90% budget alert email sent to avoid duplicate alerts';
