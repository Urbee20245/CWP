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
  
  deleteClientUser: async (clientId: string, userId: string) => {
    return invokeEdgeFunction('delete-client-user', { clientId, userId });
  },
  
  // --- Twilio SMS ---
  sendSms: async (to: string, body: string) => {
    return invokeEdgeFunction('send-sms', { to, body });
  },
  
  // --- AI Document Generation ---
  generateDocument: async (documentType: string, inputs: any) => {
    return invokeEdgeFunction('generate-document', { documentType, inputs });
  },
  
  // --- AI Content Generation (New) ---
  generateAdminContent: async (context: any) => {
    return invokeEdgeFunction('generate-admin-content', context);
  },
  
  // --- Email Sending ---
  sendEmail: async (to_email: string, subject: string, html_body: string, client_id: string | null, sent_by: string) => {
    return invokeEdgeFunction('send-email', { to_email, subject, html_body, client_id, sent_by });
  },
  
  // --- SMTP Configuration ---
  getSmtpSettings: async () => {
    const { data, error } = await supabase
        .from('smtp_settings')
        .select('*')
        .limit(1)
        .single();
    
    if (error && error.code !== 'PGRST116') throw error; // Ignore 'No rows found'
    return data;
  },
  
  saveSmtpSettings: async (settings: any) => {
    // Use upsert to ensure only one record exists
    const { data, error } = await supabase
        .from('smtp_settings')
        .upsert(settings, { onConflict: 'id' })
        .select()
        .single();
        
    if (error) throw error;
    return data;
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