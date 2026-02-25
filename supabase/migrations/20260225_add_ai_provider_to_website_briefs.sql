-- Add ai_provider column to website_briefs to track which AI model was used
-- to generate or edit each site. Defaults to claude-opus-4-5 for backwards
-- compatibility with rows that pre-date provider selection.

ALTER TABLE public.website_briefs
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'claude-opus-4-5';

COMMENT ON COLUMN public.website_briefs.ai_provider IS
  'ID of the AI provider last used to generate or edit this site (matches aiProviders.ts).';
