import { supabase } from '../integrations/supabase/client';
import { marked } from 'marked';

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
  
  // --- AI Content Generation (Generic) ---
  generateAdminContent: async (context: any) => {
    return invokeEdgeFunction('generate-admin-content', context);
  },
  
  // --- AI Email Generation (New) ---
  generateEmail: async (emailType: string, inputs: any) => {
    return invokeEdgeFunction('generate-email-content', { emailType, inputs });
  },
  
  // --- Email Sending ---
  sendEmail: async (to_email: string, subject: string, markdown_body: string, client_id: string | null, sent_by: string) => {
    // Convert Markdown to HTML before sending to the Edge Function
    const html_body = marked.parse(markdown_body);
    
    return invokeEdgeFunction('send-email', { to_email, subject, html_body, client_id, sent_by });
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
  
  applyDepositToMilestone: async (depositId: string, milestoneId: string, projectId: string) => {
      const { data, error } = await supabase
          .rpc('apply_deposit_to_milestone', {
              p_deposit_id: depositId,
              p_milestone_id: milestoneId,
              p_project_id: projectId,
          });
          
      if (error) throw error;
      return data;
  },
  
  // --- Manual Invoice Actions ---
  resendInvoiceEmail: async (invoiceId: string, clientEmail: string, clientName: string, hostedUrl: string, amount: number, sentBy: string) => {
      const subject = `Invoice Reminder: ${clientName} - $${amount.toFixed(2)} Due`;
      const markdown_body = `
Dear ${clientName},

This is a reminder for your invoice of **$${amount.toFixed(2)}**.

Please click the button below to view and pay the invoice:

[View & Pay Invoice](${hostedUrl})

Thank you,
The Custom Websites Plus Team
`;
      
      // Use the existing sendEmail function which converts markdown to HTML
      return AdminService.sendEmail(clientEmail, subject, markdown_body, null, sentBy);
  },
  
  markInvoiceResolved: async (invoiceId: string) => {
      const { error } = await supabase
          .from('invoices')
          .update({ 
              status: 'paid', 
              last_reminder_sent_at: new Date().toISOString(),
              // Note: Stripe status is not updated here, only the local record.
          })
          .eq('id', invoiceId);
          
      if (error) throw error;
      return { success: true };
  },
  
  toggleInvoiceReminders: async (invoiceId: string, disable: boolean) => {
      const { error } = await supabase
          .from('invoices')
          .update({ disable_reminders: disable })
          .eq('id', invoiceId);
          
      if (error) throw error;
      return { success: true };
  }
};