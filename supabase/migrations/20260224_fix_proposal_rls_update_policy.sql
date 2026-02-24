-- Fix: Allow clients to update proposals that have been sent (sent_at IS NOT NULL)
-- Previously the policy required status = 'sent', which silently blocked updates
-- when a proposal arrived in a different status (e.g. already 'approved').
-- Also allows status = 'approved' so the deposit invoice edge function can be
-- re-triggered without the client being locked out.

DROP POLICY IF EXISTS "Clients respond to proposals" ON client_proposals;

CREATE POLICY "Clients respond to proposals" ON client_proposals
  FOR UPDATE
  USING (
    sent_at IS NOT NULL
    AND status IN ('sent', 'approved')
    AND client_id IN (
      SELECT c.id FROM clients c WHERE c.owner_profile_id = auth.uid()
    )
  );
