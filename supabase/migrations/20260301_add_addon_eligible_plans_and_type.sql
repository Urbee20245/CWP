-- Add eligible_plans and addon_type columns to addon_catalog
-- eligible_plans: array of plan keys this add-on can be attached to (e.g. '{starter,growth}')
-- addon_type: 'standard' = available on all plans | 'plan_specific' = restricted to eligible_plans

ALTER TABLE public.addon_catalog
  ADD COLUMN IF NOT EXISTS addon_type text NOT NULL DEFAULT 'standard'
    CHECK (addon_type IN ('standard', 'plan_specific')),
  ADD COLUMN IF NOT EXISTS eligible_plans text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.addon_catalog.addon_type IS
  'standard = available as add-on on all plans; plan_specific = restricted to eligible_plans';

COMMENT ON COLUMN public.addon_catalog.eligible_plans IS
  'Array of plan keys (starter, growth, pro, elite) this add-on can be attached to. Only used when addon_type = plan_specific.';
