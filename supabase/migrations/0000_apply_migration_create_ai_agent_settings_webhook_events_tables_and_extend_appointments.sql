-- =============================================================================
-- AI Agent Settings & Webhook Events (Live Fix)
-- Date: 2026-01-31
-- Description:
--   Creates missing ai_agent_settings + webhook_events tables (if missing)
--   and extends appointments for Retell/Google Calendar booking auditability.
--   Designed for v1: one agent row per client, but supports resolving client
--   by retell_agent_id.
-- =============================================================================

-- 1) ai_agent_settings (one row per client)
CREATE TABLE IF NOT EXISTS public.ai_agent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Retell agent linkage (v1 supports resolving client from agent id)
  retell_agent_id TEXT UNIQUE,

  -- Agent identity
  agent_name TEXT DEFAULT 'AI Assistant',
  system_prompt TEXT DEFAULT '',
  greeting_message TEXT DEFAULT '',

  -- Capabilities
  can_check_availability BOOLEAN NOT NULL DEFAULT true,
  can_book_meetings BOOLEAN NOT NULL DEFAULT true,
  can_transfer_calls BOOLEAN NOT NULL DEFAULT false,
  can_send_sms BOOLEAN NOT NULL DEFAULT false,

  -- Booking rules
  default_meeting_duration INT NOT NULL DEFAULT 30,
  booking_buffer_minutes INT NOT NULL DEFAULT 0,
  max_advance_booking_days INT NOT NULL DEFAULT 60,

  -- Meeting types and hours
  allowed_meeting_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Webhook URLs
  webhook_check_availability TEXT,
  webhook_book_meeting TEXT,
  webhook_call_started TEXT,
  webhook_call_ended TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;

-- Index to speed agent resolution
CREATE INDEX IF NOT EXISTS idx_ai_agent_settings_retell_agent_id ON public.ai_agent_settings(retell_agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_settings_client_id ON public.ai_agent_settings(client_id);

-- Keep updated_at current
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_ai_agent_settings'
  ) THEN
    CREATE TRIGGER set_updated_at_ai_agent_settings
      BEFORE UPDATE ON public.ai_agent_settings
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- RLS policies: admins + client owners can read/write; edge functions use service role
DROP POLICY IF EXISTS "ai_agent_settings_admin_all" ON public.ai_agent_settings;
CREATE POLICY "ai_agent_settings_admin_all"
  ON public.ai_agent_settings
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "ai_agent_settings_client_owner_select" ON public.ai_agent_settings;
CREATE POLICY "ai_agent_settings_client_owner_select"
  ON public.ai_agent_settings
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "ai_agent_settings_client_owner_insert" ON public.ai_agent_settings;
CREATE POLICY "ai_agent_settings_client_owner_insert"
  ON public.ai_agent_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "ai_agent_settings_client_owner_update" ON public.ai_agent_settings;
CREATE POLICY "ai_agent_settings_client_owner_update"
  ON public.ai_agent_settings
  FOR UPDATE
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );


-- 2) webhook_events (audit log)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

  event_source TEXT NOT NULL,
  event_type TEXT NOT NULL,

  -- Retell identifiers
  agent_id TEXT,
  retell_call_id TEXT,
  external_id TEXT,

  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  status TEXT NOT NULL DEFAULT 'received',
  duration_ms INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_client_created_at ON public.webhook_events(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source_type_created_at ON public.webhook_events(event_source, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retell_call_id ON public.webhook_events(retell_call_id);

-- RLS: allow admins to read all; client owners can read their own (no direct inserts/updates)
DROP POLICY IF EXISTS "webhook_events_admin_select" ON public.webhook_events;
CREATE POLICY "webhook_events_admin_select"
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (SELECT profiles.id FROM public.profiles WHERE profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "webhook_events_client_owner_select" ON public.webhook_events;
CREATE POLICY "webhook_events_client_owner_select"
  ON public.webhook_events
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE owner_profile_id = auth.uid())
  );


-- 3) appointments extensions
DO $$
BEGIN
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS caller_name TEXT;
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS caller_phone TEXT;
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS caller_email TEXT;
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS meeting_notes TEXT;
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booked_by TEXT DEFAULT 'web';
  ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS retell_call_id TEXT;
EXCEPTION WHEN others THEN
  -- best-effort for idempotency
  NULL;
END $$;

-- Ensure booked_by constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_booked_by_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_booked_by_check
      CHECK (booked_by IN ('manual','ai_agent','web'));
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_appointments_retell_call_id ON public.appointments(retell_call_id);
CREATE INDEX IF NOT EXISTS idx_appointments_google_event_id ON public.appointments(google_event_id);