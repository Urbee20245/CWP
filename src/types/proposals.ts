export interface ClientProposal {
  id: string;
  client_id: string;
  created_by: string | null;
  title: string;
  status: 'draft' | 'sent' | 'approved' | 'declined' | 'revised';
  notes: string | null;
  client_message: string | null;
  client_response: string | null;
  approved_at: string | null;
  declined_at: string | null;
  sent_at: string | null;
  converted_to_invoice_id: string | null;
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
