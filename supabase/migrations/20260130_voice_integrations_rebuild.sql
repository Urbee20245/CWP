-- =============================================================================
-- AI Call Management Rebuild Migration
-- Date: 2026-01-30
-- Description: Ensures client_voice_integrations and client_integrations tables
--              have proper structure, RLS policies, and constraints for the
--              rebuilt AI call management feature.
-- =============================================================================

-- 1. Ensure client_voice_integrations table exists with all required columns
CREATE TABLE IF NOT EXISTS public.client_voice_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
    retell_agent_id TEXT,
    retell_phone_id TEXT,
    phone_number TEXT,
    number_source TEXT DEFAULT 'platform' CHECK (number_source IN ('client', 'platform')),
    voice_status TEXT DEFAULT 'inactive' CHECK (voice_status IN ('inactive', 'active', 'failed')),
    a2p_status TEXT DEFAULT 'not_started' CHECK (a2p_status IN ('not_started', 'pending_approval', 'approved', 'rejected')),
    a2p_registration_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add any missing columns (safe to run if they already exist)
DO $$ BEGIN
    ALTER TABLE public.client_voice_integrations ADD COLUMN IF NOT EXISTS retell_phone_id TEXT;
    ALTER TABLE public.client_voice_integrations ADD COLUMN IF NOT EXISTS phone_number TEXT;
    ALTER TABLE public.client_voice_integrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Ensure client_integrations table exists
CREATE TABLE IF NOT EXISTS public.client_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    account_sid_encrypted TEXT,
    auth_token_encrypted TEXT,
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, provider)
);

-- 3. Enable RLS on both tables
ALTER TABLE public.client_voice_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_integrations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for client_voice_integrations
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can read voice integrations" ON public.client_voice_integrations;
DROP POLICY IF EXISTS "Authenticated users can insert voice integrations" ON public.client_voice_integrations;
DROP POLICY IF EXISTS "Authenticated users can update voice integrations" ON public.client_voice_integrations;

-- Allow authenticated users to read their own voice integrations
CREATE POLICY "voice_integrations_select"
    ON public.client_voice_integrations
    FOR SELECT
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
        )
    );

-- Allow authenticated users to insert their own voice integrations
CREATE POLICY "voice_integrations_insert"
    ON public.client_voice_integrations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        client_id IN (
            SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
        )
    );

-- Allow authenticated users to update their own voice integrations
CREATE POLICY "voice_integrations_update"
    ON public.client_voice_integrations
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

-- 5. RLS Policies for client_integrations
DROP POLICY IF EXISTS "Authenticated users can read client integrations" ON public.client_integrations;
DROP POLICY IF EXISTS "Authenticated users can insert client integrations" ON public.client_integrations;
DROP POLICY IF EXISTS "Authenticated users can update client integrations" ON public.client_integrations;

CREATE POLICY "client_integrations_select"
    ON public.client_integrations
    FOR SELECT
    TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
        )
    );

CREATE POLICY "client_integrations_insert"
    ON public.client_integrations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        client_id IN (
            SELECT id FROM public.clients WHERE owner_profile_id = auth.uid()
        )
    );

CREATE POLICY "client_integrations_update"
    ON public.client_integrations
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

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_voice_integrations_updated_at ON public.client_voice_integrations;
CREATE TRIGGER update_voice_integrations_updated_at
    BEFORE UPDATE ON public.client_voice_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_client_integrations_updated_at ON public.client_integrations;
CREATE TRIGGER update_client_integrations_updated_at
    BEFORE UPDATE ON public.client_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_integrations_client_id ON public.client_voice_integrations(client_id);
CREATE INDEX IF NOT EXISTS idx_voice_integrations_voice_status ON public.client_voice_integrations(voice_status);
CREATE INDEX IF NOT EXISTS idx_client_integrations_client_provider ON public.client_integrations(client_id, provider);
