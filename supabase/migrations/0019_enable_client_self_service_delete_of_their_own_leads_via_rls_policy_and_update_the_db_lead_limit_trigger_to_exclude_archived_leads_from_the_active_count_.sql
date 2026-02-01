-- Allow clients to delete their own leads (self-service lifecycle control)
DROP POLICY IF EXISTS leads_client_delete ON public.leads;
CREATE POLICY leads_client_delete
ON public.leads
FOR DELETE TO authenticated
USING (
  client_id IN (SELECT clients.id FROM public.clients WHERE clients.owner_profile_id = auth.uid())
);

-- Update the DB-level active lead limit to treat 'archived' as inactive as well
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
    AND coalesce(l.status, 'new') <> 'resolved'
    AND coalesce(l.status, 'new') <> 'archived';

  IF active_count >= 50 THEN
    RAISE EXCEPTION 'Lead limit reached (50 active leads) for this client.';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS enforce_active_lead_limit ON public.leads;
CREATE TRIGGER enforce_active_lead_limit
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_lead_limit();
