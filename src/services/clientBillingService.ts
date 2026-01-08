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
  
  // Removed checkClientAccess as client access is no longer billing-gated.
  // checkClientAccess: async (clientId: string): Promise<{ hasAccess: boolean, reason: 'active' | 'overdue' | 'no_subscription' | 'override' | 'restricted' | 'system_error' | 'grace_period', graceUntil?: string | null }> => {
  //   return invokeEdgeFunction('access-check', { client_id: clientId });
  // },
  
  createPortalSession: async (clientId: string) => {
    return invokeEdgeFunction('stripe-api/create-portal-session', { client_id: clientId });
  },
};