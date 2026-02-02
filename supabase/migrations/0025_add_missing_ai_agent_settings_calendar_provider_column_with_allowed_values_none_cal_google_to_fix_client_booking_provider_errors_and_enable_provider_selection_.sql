ALTER TABLE public.ai_agent_settings
ADD COLUMN IF NOT EXISTS calendar_provider text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  ALTER TABLE public.ai_agent_settings
    ADD CONSTRAINT ai_agent_settings_calendar_provider_check
    CHECK (calendar_provider IN ('none','cal','google'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
