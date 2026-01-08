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

export const ClientBillingService = {
  
  createPortalSession: async (clientId: string) => {
    return invokeEdgeFunction('stripe-api/create-portal-session', { client_id: clientId });
  },
  
  cancelSubscription: async (subscriptionId: string) => {
    return invokeEdgeFunction('cancel-subscription', { subscription_id: subscriptionId });
  },
  
  createDepositCheckoutSession: async (clientId: string, projectId: string, amountCents: number, description: string, successUrl: string, cancelUrl: string) => {
    return invokeEdgeFunction('stripe-api/create-deposit-checkout', { 
        client_id: clientId, 
        project_id: projectId,
        amount_cents: amountCents,
        description: description,
        success_url: successUrl,
        cancel_url: cancelUrl,
    });
  },
};