-- Enforce a hard limit of 50 active leads (status != 'resolved') per client
-- and add updated_at for lead status management.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_updated_at ON public.leads;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_active_lead_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  active_count integer;
BEGIN
  SELECT count(*)
    INTO active_count
  FROM public.leads l
  WHERE l.client_id = NEW.client_id
    AND l.status <> 'resolved';

  IF active_count >= 50 THEN
    RAISE EXCEPTION 'Lead limit reached (50 active leads) for this client.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_active_lead_limit ON public.leads;
CREATE TRIGGER enforce_active_lead_limit
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_lead_limit();
