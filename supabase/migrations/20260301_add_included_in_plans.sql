-- Add included_in_plans column to addon_catalog
-- included_in_plans: array of plan keys this add-on is bundled into at no extra charge
-- e.g. '{starter,growth,pro,elite}' means the add-on is free for all plans

ALTER TABLE public.addon_catalog
  ADD COLUMN IF NOT EXISTS included_in_plans text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.addon_catalog.included_in_plans IS
  'Array of plan keys (starter, growth, pro, elite) that include this add-on for free. '
  'Empty array means the add-on is purchasable as an upgrade but not bundled into any plan.';
