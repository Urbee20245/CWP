-- Migration: Create table for scheduling Retell AI calls
-- Date: 2026-02-13
-- Purpose: Allow admins to schedule outbound calls to prospects using Retell AI agents

CREATE TABLE IF NOT EXISTS public.retell_scheduled_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Client/Admin info
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Contact information
    prospect_name TEXT NOT NULL,
    prospect_phone TEXT NOT NULL,

    -- Scheduling
    scheduled_time TIMESTAMPTZ NOT NULL,
    timezone TEXT DEFAULT 'America/New_York',

    -- Retell configuration
    retell_agent_id TEXT NOT NULL,
    from_phone_number TEXT, -- The Retell phone number to call from

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'calling', 'completed', 'failed', 'cancelled')),

    -- Call metadata
    retell_call_id TEXT, -- Populated after call is initiated
    call_duration_seconds INTEGER,
    call_started_at TIMESTAMPTZ,
    call_ended_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,

    -- Notes and context
    admin_notes TEXT,
    call_metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_retell_scheduled_calls_client_id ON public.retell_scheduled_calls(client_id);
CREATE INDEX IF NOT EXISTS idx_retell_scheduled_calls_scheduled_time ON public.retell_scheduled_calls(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_retell_scheduled_calls_status ON public.retell_scheduled_calls(status);
CREATE INDEX IF NOT EXISTS idx_retell_scheduled_calls_created_by ON public.retell_scheduled_calls(created_by);
CREATE INDEX IF NOT EXISTS idx_retell_scheduled_calls_retell_call_id ON public.retell_scheduled_calls(retell_call_id) WHERE retell_call_id IS NOT NULL;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_retell_scheduled_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_retell_scheduled_calls_updated_at
    BEFORE UPDATE ON public.retell_scheduled_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_retell_scheduled_calls_updated_at();

-- RLS Policies (Admin-only access)
ALTER TABLE public.retell_scheduled_calls ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins can manage all scheduled calls"
    ON public.retell_scheduled_calls
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role bypass (for edge functions)
CREATE POLICY "Service role has full access"
    ON public.retell_scheduled_calls
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Add helpful comments
COMMENT ON TABLE public.retell_scheduled_calls IS 'Stores scheduled Retell AI calls to prospects initiated by admins';
COMMENT ON COLUMN public.retell_scheduled_calls.status IS 'Call status: pending (not yet scheduled), scheduled (job queued), calling (in progress), completed (successful), failed (error occurred), cancelled (manually cancelled)';
COMMENT ON COLUMN public.retell_scheduled_calls.retell_call_id IS 'The call ID returned by Retell AI after initiating the call';
COMMENT ON COLUMN public.retell_scheduled_calls.call_metadata IS 'Additional metadata such as call transcript, analysis, or custom data';
