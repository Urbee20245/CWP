-- ============================================================
-- Billing Features Migration
-- Features: Retract invoices/proposals, 50/50 deposit split,
--           proposal discounts
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. INVOICES — add retraction + label columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS retracted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retracted_reason  TEXT,
  ADD COLUMN IF NOT EXISTS label             TEXT;  -- display label e.g. "Deposit — Project" / "Balance Due — Project"

-- ─────────────────────────────────────────────────────────────
-- 2. CLIENT_PROPOSALS — update status check + add columns
-- ─────────────────────────────────────────────────────────────

-- Drop the old status check constraint so we can add 'retracted' and 'complete'
ALTER TABLE public.client_proposals
  DROP CONSTRAINT IF EXISTS client_proposals_status_check;

ALTER TABLE public.client_proposals
  ADD CONSTRAINT client_proposals_status_check
    CHECK (status IN ('draft', 'sent', 'approved', 'declined', 'revised', 'retracted', 'complete'));

-- Retraction fields
ALTER TABLE public.client_proposals
  ADD COLUMN IF NOT EXISTS retracted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retracted_reason  TEXT;

-- 50/50 split payment fields
ALTER TABLE public.client_proposals
  ADD COLUMN IF NOT EXISTS payment_structure       TEXT NOT NULL DEFAULT 'full'
    CHECK (payment_structure IN ('full', 'split_50_50')),
  ADD COLUMN IF NOT EXISTS deposit_invoice_id      UUID REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS balance_invoice_id      UUID REFERENCES public.invoices(id),
  ADD COLUMN IF NOT EXISTS deposit_paid            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_start_date DATE;

-- Proposal discount fields
ALTER TABLE public.client_proposals
  ADD COLUMN IF NOT EXISTS discount_type  TEXT
    CHECK (discount_type IN ('percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10, 2);

-- ─────────────────────────────────────────────────────────────
-- 3. RLS POLICIES — update client-facing policies to exclude retracted
-- ─────────────────────────────────────────────────────────────

-- Clients read own proposals: exclude draft AND retracted
DROP POLICY IF EXISTS "Clients read own proposals" ON public.client_proposals;
CREATE POLICY "Clients read own proposals" ON public.client_proposals
  FOR SELECT TO authenticated
  USING (
    status NOT IN ('draft', 'retracted')
    AND client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE p.role = 'client' AND c.owner_profile_id = auth.uid()
    )
  );

-- Clients respond to proposals: still only when sent, only approve/decline
DROP POLICY IF EXISTS "Clients respond to proposals" ON public.client_proposals;
CREATE POLICY "Clients respond to proposals" ON public.client_proposals
  FOR UPDATE TO authenticated
  USING (
    status = 'sent'
    AND client_id IN (
      SELECT c.id FROM public.clients c WHERE c.owner_profile_id = auth.uid()
    )
  )
  WITH CHECK (status IN ('approved', 'declined'));

-- Proposal items: update client policy to also exclude retracted proposals
DROP POLICY IF EXISTS "Clients read proposal items" ON public.client_proposal_items;
CREATE POLICY "Clients read proposal items" ON public.client_proposal_items
  FOR SELECT TO authenticated
  USING (
    proposal_id IN (
      SELECT cp.id FROM public.client_proposals cp
      JOIN public.clients c ON c.id = cp.client_id
      WHERE c.owner_profile_id = auth.uid()
        AND cp.status NOT IN ('draft', 'retracted')
    )
  );
