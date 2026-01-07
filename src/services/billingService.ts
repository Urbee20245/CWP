import { supabase } from '../integrations/supabase/client';

const invokeEdgeFunction = async (functionName: string, payload: any) => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: JSON.stringify(payload),
  });

  if (error) {
    console.error(`Error invoking ${functionName}:`, error);
    throw new Error(error.message || `Failed to call ${functionName}`);
  }
  
  if (data.error) {
    console.error(`Edge function ${functionName} returned error:`, data.error);
    throw new Error(data.error);
  }

  return data;
};

export const BillingService = {
  createStripeCustomer: async (clientId: string) => {
    return invokeEdgeFunction('stripe-api/create-customer', { client_id: clientId });
  },

  createSubscription: async (clientId: string, priceId: string) => {
    return invokeEdgeFunction('stripe-api/create-subscription', { client_id: clientId, price_id: priceId });
  },

  createInvoice: async (clientId: string, lineItems: Array<{ description: string, amount: number }>, dueDate?: string) => {
    return invokeEdgeFunction('stripe-api/create-invoice', { client_id: clientId, line_items: lineItems, due_date: dueDate });
  },

  createPortalSession: async (clientId: string) => {
    return invokeEdgeFunction('stripe-api/create-portal-session', { client_id: clientId });
  },
  
  checkClientAccess: async (clientId: string): Promise<{ hasAccess: boolean, reason: 'active' | 'overdue' | 'no_subscription' | 'override' | 'restricted' | 'system_error' }> => {
    return invokeEdgeFunction('access-check', { client_id: clientId });
  }
};