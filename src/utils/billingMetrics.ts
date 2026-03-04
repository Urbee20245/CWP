import { supabase } from '../integrations/supabase/client';

export interface SubscriptionRow {
  id: string;
  client_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: string;
  created_at: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  monthly_amount_cents: number | null;
  plan_label: string | null;
  clients: { business_name: string; billing_email: string | null } | null;
}

export interface InvoiceRow {
  id: string;
  client_id: string;
  stripe_invoice_id: string;
  amount_due: number;
  status: string;
  created_at: string;
  hosted_invoice_url: string | null;
  label: string | null;
  invoice_type: string | null;
  clients: { business_name: string } | null;
}

export interface RevenueMetrics {
  mrr: number;
  totalRevenuePaid: number;
  totalRevenueOutstanding: number;
  revenueCollected30Days: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pendingSubscriptions: number;
  canceledSubscriptions30Days: number;
  newSubscriptions30Days: number;
  churnRate: number;
  allSubscriptions: SubscriptionRow[];
  upcomingPayments: SubscriptionRow[];
  recentInvoices: InvoiceRow[];
}

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const SIXTY_DAYS_FROM_NOW = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

export async function fetchBillingMetrics(): Promise<RevenueMetrics> {
  const [
    { data: subscriptionsData, error: subsError },
    { data: invoicesData, error: invoicesError },
    { data: productsData },
  ] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id, client_id, stripe_subscription_id, stripe_price_id, status, created_at, current_period_end, cancel_at_period_end, cancel_at, monthly_amount_cents, plan_label, clients(business_name, billing_email)')
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('id, client_id, stripe_invoice_id, amount_due, status, created_at, hosted_invoice_url, label, invoice_type, clients(business_name)')
      .neq('status', 'retracted')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('billing_products')
      .select('stripe_price_id, monthly_price_cents, amount_cents, billing_type'),
  ]);

  if (subsError) throw new Error(`Subscriptions query failed: ${subsError.message}`);
  if (invoicesError) throw new Error(`Invoices query failed: ${invoicesError.message}`);

  const subscriptions = (subscriptionsData || []) as SubscriptionRow[];
  const invoices = (invoicesData || []) as InvoiceRow[];

  // Fallback lookup for old billing_products-based subscriptions
  const productMap = new Map(
    (productsData || []).map((p: any) => [p.stripe_price_id, p])
  );

  let mrr = 0;
  let activeSubscriptions = 0;
  let trialingSubscriptions = 0;
  let pendingSubscriptions = 0;
  let canceledSubscriptions30Days = 0;
  let newSubscriptions30Days = 0;

  subscriptions.forEach(sub => {
    const product = productMap.get(sub.stripe_price_id) as any;
    const monthlyAmountCents =
      sub.monthly_amount_cents ??
      product?.monthly_price_cents ??
      product?.amount_cents ??
      0;
    const monthlyAmount = monthlyAmountCents / 100;

    if (sub.status === 'active') {
      mrr += monthlyAmount;
      activeSubscriptions++;
    } else if (sub.status === 'trialing') {
      mrr += monthlyAmount;
      trialingSubscriptions++;
    } else if (['incomplete', 'incomplete_expired', 'past_due'].includes(sub.status)) {
      pendingSubscriptions++;
    }

    if (sub.created_at >= THIRTY_DAYS_AGO) newSubscriptions30Days++;
    if (sub.status === 'canceled' && sub.created_at >= THIRTY_DAYS_AGO) canceledSubscriptions30Days++;
  });

  const totalRevenuePaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.amount_due || 0) / 100, 0);

  const totalRevenueOutstanding = invoices
    .filter(i => i.status === 'open')
    .reduce((sum, i) => sum + (i.amount_due || 0) / 100, 0);

  const revenueCollected30Days = invoices
    .filter(i => i.status === 'paid' && i.created_at >= THIRTY_DAYS_AGO)
    .reduce((sum, i) => sum + (i.amount_due || 0) / 100, 0);

  const totalActive = activeSubscriptions + trialingSubscriptions;
  const churnBase = totalActive + canceledSubscriptions30Days;
  const churnRate = churnBase > 0 ? (canceledSubscriptions30Days / churnBase) * 100 : 0;

  const now = new Date().toISOString();
  const upcomingPayments = subscriptions
    .filter(s =>
      (s.status === 'active' || s.status === 'trialing') &&
      s.current_period_end &&
      s.current_period_end > now &&
      s.current_period_end <= SIXTY_DAYS_FROM_NOW
    )
    .sort((a, b) => (a.current_period_end ?? '').localeCompare(b.current_period_end ?? ''));

  return {
    mrr: parseFloat(mrr.toFixed(2)),
    totalRevenuePaid: parseFloat(totalRevenuePaid.toFixed(2)),
    totalRevenueOutstanding: parseFloat(totalRevenueOutstanding.toFixed(2)),
    revenueCollected30Days: parseFloat(revenueCollected30Days.toFixed(2)),
    activeSubscriptions,
    trialingSubscriptions,
    pendingSubscriptions,
    canceledSubscriptions30Days,
    newSubscriptions30Days,
    churnRate: parseFloat(churnRate.toFixed(2)),
    allSubscriptions: subscriptions,
    upcomingPayments,
    recentInvoices: invoices,
  };
}
