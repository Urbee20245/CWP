import { supabase } from '../integrations/supabase/client';

export interface SubscriptionRow {
  id: string;
  client_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  created_at: string;
  monthly_amount_cents: number | null;
  plan_label: string | null;
  clients: { business_name: string; billing_email: string | null } | null;
}

export interface InvoiceRow {
  id: string;
  client_id: string;
  stripe_invoice_id: string | null;
  amount_due: number;
  status: string;
  hosted_invoice_url: string | null;
  created_at: string;
  label: string | null;
  clients: { business_name: string } | null;
}

interface BillingProduct {
  stripe_price_id: string;
  amount_cents: number;
  billing_type: 'subscription' | 'one_time';
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
    { data: productsData, error: productsError },
  ] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(
        'id, client_id, stripe_subscription_id, stripe_price_id, status, current_period_end, cancel_at_period_end, cancel_at, created_at, monthly_amount_cents, plan_label, clients(business_name, billing_email)'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('id, client_id, stripe_invoice_id, amount_due, status, hosted_invoice_url, created_at, label, clients(business_name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('billing_products')
      .select('stripe_price_id, amount_cents, billing_type'),
  ]);

  if (subsError || invoicesError || productsError) {
    console.error('Error fetching billing data:', subsError || invoicesError || productsError);
    throw new Error('Failed to fetch billing data.');
  }

  const subscriptions = (subscriptionsData ?? []) as unknown as SubscriptionRow[];
  const invoices = (invoicesData ?? []) as unknown as InvoiceRow[];
  const products = (productsData ?? []) as BillingProduct[];
  const productMap = new Map(products.map(p => [p.stripe_price_id, p]));

  let mrr = 0;
  let activeSubscriptions = 0;
  let trialingSubscriptions = 0;
  let pendingSubscriptions = 0;
  let newSubscriptions30Days = 0;
  let canceledSubscriptions30Days = 0;

  for (const sub of subscriptions) {
    const isActive = sub.status === 'active';
    const isTrialing = sub.status === 'trialing';

    if (isActive || isTrialing) {
      // Prefer monthly_amount_cents on the row; fall back to billing_products
      let monthlyAmountCents = sub.monthly_amount_cents ?? 0;
      if (!monthlyAmountCents) {
        const product = productMap.get(sub.stripe_price_id);
        if (product && product.billing_type === 'subscription') {
          monthlyAmountCents = product.amount_cents;
        }
      }
      mrr += monthlyAmountCents / 100;

      if (isActive) activeSubscriptions++;
      if (isTrialing) trialingSubscriptions++;
    }

    if (
      sub.status === 'incomplete' ||
      sub.status === 'incomplete_expired' ||
      sub.status === 'past_due'
    ) {
      pendingSubscriptions++;
    }

    if (sub.created_at >= THIRTY_DAYS_AGO) {
      newSubscriptions30Days++;
    }

    if (sub.status === 'canceled' && sub.created_at >= THIRTY_DAYS_AGO) {
      canceledSubscriptions30Days++;
    }
  }

  let totalRevenuePaid = 0;
  let totalRevenueOutstanding = 0;
  let revenueCollected30Days = 0;

  for (const invoice of invoices) {
    const amountDollars = invoice.amount_due / 100;
    if (invoice.status === 'paid') {
      totalRevenuePaid += amountDollars;
      if (invoice.created_at >= THIRTY_DAYS_AGO) {
        revenueCollected30Days += amountDollars;
      }
    } else if (invoice.status === 'open') {
      totalRevenueOutstanding += amountDollars;
    }
  }

  const totalSubscriptionsAtStart =
    activeSubscriptions + trialingSubscriptions + canceledSubscriptions30Days;
  const churnRate =
    totalSubscriptionsAtStart > 0
      ? (canceledSubscriptions30Days / totalSubscriptionsAtStart) * 100
      : 0;

  const now = new Date().toISOString();
  const upcomingPayments = subscriptions
    .filter(
      s =>
        (s.status === 'active' || s.status === 'trialing') &&
        s.current_period_end != null &&
        s.current_period_end >= now &&
        s.current_period_end <= SIXTY_DAYS_FROM_NOW
    )
    .sort((a, b) => (a.current_period_end ?? '').localeCompare(b.current_period_end ?? ''));

  return {
    mrr: Math.round(mrr * 100) / 100,
    totalRevenuePaid: Math.round(totalRevenuePaid * 100) / 100,
    totalRevenueOutstanding: Math.round(totalRevenueOutstanding * 100) / 100,
    revenueCollected30Days: Math.round(revenueCollected30Days * 100) / 100,
    activeSubscriptions,
    trialingSubscriptions,
    pendingSubscriptions,
    canceledSubscriptions30Days,
    newSubscriptions30Days,
    churnRate: parseFloat(churnRate.toFixed(2)),
    allSubscriptions: subscriptions,
    upcomingPayments,
    recentInvoices: invoices.slice(0, 50),
  };
}
