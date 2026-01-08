import { supabase } from '../integrations/supabase/client';

interface Subscription {
  status: string;
  created_at: string;
  stripe_price_id: string;
}

interface Invoice {
  amount_due: number;
  status: string;
  created_at: string;
}

interface BillingProduct {
  stripe_price_id: string;
  amount_cents: number;
  billing_type: 'subscription' | 'one_time';
}

export interface RevenueMetrics {
  mrr: number;
  activeSubscriptions: number;
  newSubscriptions30Days: number;
  canceledSubscriptions30Days: number;
  churnRate: number;
  oneTimeRevenue30Days: number;
}

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

export async function fetchBillingMetrics(): Promise<RevenueMetrics> {
  // Fetch all necessary data
  const [
    { data: subscriptionsData, error: subsError },
    { data: invoicesData, error: invoicesError },
    { data: productsData, error: productsError },
  ] = await Promise.all([
    supabase.from('subscriptions').select('status, created_at, stripe_price_id'),
    supabase.from('invoices').select('amount_due, status, created_at').eq('status', 'paid'),
    supabase.from('billing_products').select('stripe_price_id, amount_cents, billing_type'),
  ]);

  if (subsError || invoicesError || productsError) {
    console.error('Error fetching billing data:', subsError || invoicesError || productsError);
    throw new Error('Failed to fetch billing data.');
  }

  const subscriptions = subscriptionsData as Subscription[];
  const invoices = invoicesData as Invoice[];
  const products = productsData as BillingProduct[];
  const productMap = new Map(products.map(p => [p.stripe_price_id, p]));

  let mrr = 0;
  let activeSubscriptions = 0;
  let newSubscriptions30Days = 0;
  let canceledSubscriptions30Days = 0;
  let oneTimeRevenue30Days = 0;

  // 1. Calculate MRR and Active Subscriptions
  subscriptions.forEach(sub => {
    const product = productMap.get(sub.stripe_price_id);
    if (product && product.billing_type === 'subscription') {
      const monthlyAmount = product.amount_cents / 100;

      if (sub.status === 'active' || sub.status === 'trialing') {
        mrr += monthlyAmount;
        activeSubscriptions++;
      }

      // New subscriptions (created in last 30 days)
      if (sub.created_at >= THIRTY_DAYS_AGO) {
        newSubscriptions30Days++;
      }
      
      // Canceled subscriptions (deleted/canceled in last 30 days - approximation using status change)
      if (sub.status === 'canceled' && sub.created_at >= THIRTY_DAYS_AGO) {
        canceledSubscriptions30Days++;
      }
    }
  });

  // 2. Calculate One-Time Revenue (Paid invoices in last 30 days)
  invoices.forEach(invoice => {
    if (invoice.created_at >= THIRTY_DAYS_AGO) {
      oneTimeRevenue30Days += invoice.amount_due / 100;
    }
  });

  // 3. Calculate Churn Rate (Simplified: Canceled / Total Active at start of period)
  // This is a very simplified calculation for MVP.
  const totalSubscriptionsAtStart = activeSubscriptions + canceledSubscriptions30Days;
  const churnRate = totalSubscriptionsAtStart > 0 
    ? (canceledSubscriptions30Days / totalSubscriptionsAtStart) * 100 
    : 0;

  return {
    mrr: Math.round(mrr),
    activeSubscriptions,
    newSubscriptions30Days,
    canceledSubscriptions30Days,
    churnRate: parseFloat(churnRate.toFixed(2)),
    oneTimeRevenue30Days: parseFloat(oneTimeRevenue30Days.toFixed(2)),
  };
}