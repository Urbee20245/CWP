export interface ClientProposal {
  id: string;
  client_id: string;
  created_by: string | null;
  title: string;
  status: 'draft' | 'sent' | 'approved' | 'declined' | 'revised' | 'retracted' | 'complete';
  notes: string | null;
  client_message: string | null;
  client_response: string | null;
  approved_at: string | null;
  declined_at: string | null;
  sent_at: string | null;
  converted_to_invoice_id: string | null;
  retracted_at: string | null;
  retracted_reason: string | null;

  // 50/50 split payment
  payment_structure: 'full' | 'split_50_50';
  deposit_invoice_id: string | null;
  balance_invoice_id: string | null;
  deposit_paid: boolean;
  completed_at: string | null;
  subscription_start_date: string | null;

  // Proposal-level discount
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;

  created_at: string;
  updated_at: string;

  // joined
  clients?: { business_name: string; billing_email: string | null };
}

export interface ClientProposalItem {
  id: string;
  proposal_id: string;
  item_type: 'billing_product' | 'addon';
  source_id: string | null;
  name: string;
  description: string | null;
  billing_type: string | null;
  amount_cents: number | null;
  monthly_price_cents: number | null;
  setup_fee_cents: number | null;
  sort_order: number;
  created_at: string;
}
