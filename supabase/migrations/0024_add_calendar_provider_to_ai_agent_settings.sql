-- Add calendar provider preference to AI agent settings
-- Options: 'cal' | 'google' | 'none'

ALTER TABLE public.ai_agent_settings
ADD COLUMN IF NOT EXISTS calendar_provider TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.ai_agent_settings
DROP CONSTRAINT IF EXISTS ai_agent_settings_calendar_provider_check;

ALTER TABLE public.ai_agent_settings
ADD CONSTRAINT ai_agent_settings_calendar_provider_check
CHECK (calendar_provider IN ('none', 'cal', 'google'));

CREATE INDEX IF NOT EXISTS idx_ai_agent_settings_calendar_provider
ON public.ai_agent_settings (calendar_provider);
