-- =============================================================================
-- AI Agent Settings & Webhook Events Migration
-- Date: 2026-01-31
-- Description: Creates tables for per-client AI agent configuration,
--              webhook event logging, and extends appointment metadata.
--              Enables Retell AI agents to check availability and book meetings
--              via Google Calendar without any middleware (no n8n).
-- =============================================================================

-- 1. AI Agent Settings table (per-client agent configuration)
CREATE TABLE IF NOT EXISTS public.ai_agent_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Agent identity
    agent_name TEXT DEFAULT 'AI Assistant',
    system_prompt TEXT DEFAULT '',
    greeting_message TEXT DEFAULT '',

    -- Agent capabilities (what the Retell agent is allowed to do)
    can_check_availability BOOLEAN DEFAULT true,
    can_book_meetings BOOLEAN DEFAULT true,
    can_transfer_calls BOOLEAN DEFAULT false,
    can_send_sms BOOLEAN DEFAULT false,

    -- Booking configuration
    default_meeting_duration INTEGER DEFAULT 30, -- minutes
    booking_buffer_minutes INTEGER DEFAULT 15,   -- gap between meetings
    max_advance_booking_days INTEGER DEFAULT 30,  -- how far ahead callers can book
    allowed_meeting_types TEXT[] DEFAULT ARRAY['phone', 'video']::TEXT[],

    -- Business hours (JSON: {0: {start: "09:00", end: "17:00"}, ...} where 0=Sunday)
    business_hours JSONB DEFAULT '{
        "1": {"start": "09:00", "end": "17:00"},
        "2": {"start": "09:00", "end": "17:00"},
        "3": {"start": "09:00", "end": "17:00"},
        "4": {"start": "09:00", "end": "17:00"},
        "5": {"start": "09:00", "end": "17:00"}
    }'::JSONB,

    -- Timezone for this client's agent
    timezone TEXT DEFAULT 'America/New_York',

    -- Webhook URLs (your endpoints that Retell calls as custom functions)
    webhook_check_availability TEXT,
    webhook_book_meeting TEXT,
    webhook_call_started TEXT,
    webhook_call_ended TEXT,

    -- Retell custom function IDs (set after registering with Retell)
    retell_check_availability_fn_id TEXT,
    retell_book_meeting_fn_id TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Webhook Events table (audit log for all webhook calls)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,

    -- Event identification
    event_type TEXT NOT NULL, -- 'retell.call_started', 'retell.call_ended', 'retell.check_availability', 'retell.book_meeting'
    event_source TEXT NOT NULL DEFAULT 'retell', -- 'retell', 'google_calendar', 'internal'
    external_id TEXT, -- retell call_id or external reference

    -- Payload
    request_payload JSONB DEFAULT '{}'::JSONB,
    response_payload JSONB DEFAULT '{}'::JSONB,

    -- Status
    status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processing', 'completed', 'failed')),
    error_message TEXT,

    -- Metadata
    duration_ms INTEGER, -- how long webhook processing took
    ip_address TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add fields to appointments table for calendar sync
DO $$ BEGIN
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS caller_name TEXT;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS caller_phone TEXT;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS caller_email TEXT;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS meeting_notes TEXT;
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booked_by TEXT DEFAULT 'manual'
        CHECK (booked_by IN ('manual', 'ai_agent', 'web'));
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS retell_call_id TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 4. Enable RLS
ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for ai_agent_settings
DROP POLICY IF EXISTS "agent_settings_select" ON public.ai_agent_settings;
DROP POLICY IF EXISTS "agent_settings_insert" ON public.ai_agent_settings;
DROP POLICY IF EXISTS "agent_settings_update" ON public.ai_agent_settings;

CREATE POLICY "agent_settings_select"
    ON public.ai_agent_settings
    FOR SELECT
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
        )
    );

CREATE POLICY "agent_settings_insert"
    ON public.ai_agent_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        client_id IN (
            SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
        )
    );

CREATE POLICY "agent_settings_update"
    ON public.ai_agent_settings
    FOR UPDATE
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
        )
    )
    WITH CHECK (
        client_id IN (
            SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
        )
    );

-- 6. RLS Policies for webhook_events (admin read-only via service role, no client access)
DROP POLICY IF EXISTS "webhook_events_select" ON public.webhook_events;

CREATE POLICY "webhook_events_select"
    ON public.webhook_events
    FOR SELECT
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
        )
    );

-- 7. Updated_at triggers
DROP TRIGGER IF EXISTS update_agent_settings_updated_at ON public.ai_agent_settings;
CREATE TRIGGER update_agent_settings_updated_at
    BEFORE UPDATE ON public.ai_agent_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_agent_settings_client_id ON public.ai_agent_settings(client_id);
CREATE INDEX IF NOT EXISTS idx_agent_settings_active ON public.ai_agent_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_events_client_id ON public.webhook_events(client_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON public.webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_external_id ON public.webhook_events(external_id);
CREATE INDEX IF NOT EXISTS idx_appointments_google_event ON public.appointments(google_event_id);
CREATE INDEX IF NOT EXISTS idx_appointments_retell_call ON public.appointments(retell_call_id);
