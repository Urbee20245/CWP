-- Proposals table
CREATE TABLE IF NOT EXISTS public.client_proposals (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         UUID          NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_by        UUID          REFERENCES public.profiles(id),
  title             TEXT          NOT NULL DEFAULT 'Your Service Proposal',
  status            TEXT          NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'approved', 'declined', 'revised')),
  notes             TEXT,                        -- internal admin notes
  client_message    TEXT,                        -- message shown to client
  client_response   TEXT,                        -- client's response/comment
  approved_at       TIMESTAMPTZ,
  declined_at       TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  converted_to_invoice_id UUID    REFERENCES public.invoices(id),
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

-- Proposal line items
CREATE TABLE IF NOT EXISTS public.client_proposal_items (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id       UUID          NOT NULL REFERENCES public.client_proposals(id) ON DELETE CASCADE,
  item_type         TEXT          NOT NULL CHECK (item_type IN ('billing_product', 'addon')),
  source_id         UUID,                        -- billing_products.id OR addon_catalog.id (nullable for custom)
  name              TEXT          NOT NULL,
  description       TEXT,                        -- can be AI-generated
  billing_type      TEXT,                        -- e.g. one_time, subscription, setup_plus_subscription
  amount_cents      INTEGER,                     -- one-time amount
  monthly_price_cents INTEGER,                   -- recurring amount
  setup_fee_cents   INTEGER,
  sort_order        INTEGER       DEFAULT 0,
  created_at        TIMESTAMPTZ   DEFAULT NOW()
);

-- RLS
ALTER TABLE public.client_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_proposal_items ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins manage proposals" ON public.client_proposals
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Clients: read-only on their own proposals (any non-draft)
CREATE POLICY "Clients read own proposals" ON public.client_proposals
  FOR SELECT TO authenticated
  USING (
    status != 'draft'
    AND client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE p.role = 'client' AND c.owner_profile_id = auth.uid()
    )
  );

-- Clients: can update status+client_response on their own sent proposals (to approve/decline)
CREATE POLICY "Clients respond to proposals" ON public.client_proposals
  FOR UPDATE TO authenticated
  USING (
    status = 'sent'
    AND client_id IN (
      SELECT c.id FROM public.clients c WHERE c.owner_profile_id = auth.uid()
    )
  )
  WITH CHECK (status IN ('approved', 'declined'));

-- Proposal items: admins manage, clients read
CREATE POLICY "Admins manage proposal items" ON public.client_proposal_items
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

CREATE POLICY "Clients read proposal items" ON public.client_proposal_items
  FOR SELECT TO authenticated
  USING (
    proposal_id IN (
      SELECT cp.id FROM public.client_proposals cp
      JOIN public.clients c ON c.id = cp.client_id
      WHERE c.owner_profile_id = auth.uid() AND cp.status != 'draft'
    )
  );
