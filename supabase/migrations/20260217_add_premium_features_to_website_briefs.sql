-- Add premium_features column to website_briefs
-- Stores an array of enabled premium feature IDs for each client website.
-- e.g. ["cal_com", "ai_phone_inbound", "legal_privacy_policy", "ai_chatbot"]

ALTER TABLE public.website_briefs
  ADD COLUMN IF NOT EXISTS premium_features JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.website_briefs.premium_features IS
  'Array of premium feature IDs enabled for this client website. '
  'Possible values: cal_com, google_calendar, ai_phone_inbound, ai_phone_outbound, '
  'contact_forms, legal_privacy_policy, legal_terms_conditions, legal_refund_policy, '
  'ai_content_generation, ai_assistant, chat_widget, ai_chatbot.';
