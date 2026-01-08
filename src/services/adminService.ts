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

export const AdminService = {
  // --- Client Management ---
  createClientUser: async (clientData: { email: string, password: string, fullName: string, businessName: string, phone: string, billingEmail: string }) => {
    return invokeEdgeFunction('create-client-user', clientData);
  },
  
  // --- Twilio SMS ---
  sendSms: async (to: string, body: string) => {
    return invokeEdgeFunction('send-sms', { to, body });
  },
  
  // --- Billing ---
  createStripeCustomer: async (clientId: string) => {
    return invokeEdgeFunction('stripe-api/create-customer', { client_id: clientId });
  },

  createSubscription: async (clientId: string, priceId: string) => {
    return invokeEdgeFunction('stripe-api/create-subscription', { client_id: clientId, price_id: priceId });
  },

  createInvoice: async (clientId: string, lineItems: Array<{ description: string, amount: number }>, dueDate?: string) => {
    return invokeEdgeFunction('stripe-api/create-invoice', { client_id: clientId, line_items: lineItems, due_date: dueDate });
  },
  
  createDepositInvoice: async (clientId: string, amount: number, description: string, projectId?: string) => {
    return invokeEdgeFunction('stripe-api/create-deposit-invoice', { 
        client_id: clientId, 
        deposit_details: {
            amount,
            description,
            project_id: projectId,
        }
    });
  },
  
  createMilestoneInvoice: async (clientId: string, milestoneId: string, amountCents: number, description: string, projectId: string) => {
    return invokeEdgeFunction('stripe-api/create-milestone-invoice', {
        client_id: clientId,
        milestone_details: {
            milestone_id: milestoneId,
            amount_cents: amountCents,
            description: description,
            project_id: projectId,
        }
    });
  },

  createPortalSession: async (clientId: string) => {
    return invokeEdgeFunction('stripe-api/create-portal-session', { client_id: clientId });
  },
  
  createBillingProduct: async (productData: { name: string, description: string, amount_cents: number, billing_type: 'one_time' | 'subscription' }) => {
    return invokeEdgeFunction('create-billing-product', productData);
  },
};