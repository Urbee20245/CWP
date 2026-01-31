import { supabase } from '../integrations/supabase/client';
import { marked } from 'marked';

async function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function extractEdgeFunctionErrorMessage(error: any, parsedBody: any) {
  // 1) Prefer structured error from response body (when available)
  const bodyError = parsedBody?.error || parsedBody?.message;
  if (typeof bodyError === 'string' && bodyError.trim()) return bodyError;

  // 2) On non-2xx, supabase-js often provides a Response under error.context
  const ctx: any = error?.context;
  if (ctx) {
    try {
      // Response supports clone(), json(), text()
      if (typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
        const json = await ctx.clone().json();
        const msg = json?.error || json?.message;
        if (typeof msg === 'string' && msg.trim()) return msg;
      }
    } catch {
      // ignore
    }

    try {
      if (typeof ctx.clone === 'function' && typeof ctx.text === 'function') {
        const text = await ctx.clone().text();
        const maybeJson = await tryParseJson(text);
        const msg = maybeJson?.error || maybeJson?.message;
        if (typeof msg === 'string' && msg.trim()) return msg;
        if (typeof text === 'string' && text.trim()) return text;
      }
    } catch {
      // ignore
    }
  }

  return error?.message || 'Edge Function call failed.';
}

const invokeEdgeFunction = async (functionName: string, payload: any) => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  });

  // Parse data regardless of error — on non-2xx, the SDK sets error but
  // we may still get a useful JSON error body.
  let parsed: any = null;
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    // data wasn't valid JSON — ignore
  }

  if (error) {
    const message = await extractEdgeFunctionErrorMessage(error, parsed);
    console.error(`[adminService] Error invoking ${functionName}:`, message);
    throw new Error(message);
  }

  if (parsed?.error) {
    console.error(`[adminService] Edge function ${functionName} returned error:`, parsed.error);
    throw new Error(parsed.error);
  }

  return parsed;
};

export const AdminService = {
  // ... (keep existing methods)
  createClientUser: async (clientData: any) => invokeEdgeFunction('create-client-user', clientData),
  deleteClientUser: async (clientId: string, userId: string) => invokeEdgeFunction('delete-client-user', { clientId, userId }),
  sendSms: async (to: string, body: string) => invokeEdgeFunction('send-sms', { to, body }),
  
  // Updated AI Voice Provisioning
  provisionVoiceNumber: async (clientId: string, source: 'client' | 'platform', phoneNumber?: string, a2pData?: any, retellAgentId?: string) => {
    return invokeEdgeFunction('provision-voice-number', {
        client_id: clientId,
        source,
        phone_number: phoneNumber,
        a2p_data: a2pData,
        retell_agent_id: retellAgentId
    });
  },
  
  // Fetch clients with voice integration data (bypasses RLS via service role)
  getVoiceClients: async () => {
    const result = await invokeEdgeFunction('get-voice-clients', {});
    return result.clients;
  },

  // Securely save Retell Agent ID (and optionally platform phone number)
  saveRetellAgentId: async (
    clientId: string,
    retellAgentId: string,
    numberSource: 'client' | 'platform',
    platformPhoneNumber?: string
  ) => {
    return invokeEdgeFunction('save-retell-agent-id', {
        client_id: clientId,
        retell_agent_id: retellAgentId,
        number_source: numberSource,
        phone_number: platformPhoneNumber,
    });
  },

  // Generate a system prompt by scraping a website (Gemini)
  generateSystemPromptFromWebsite: async (websiteUrl: string, businessName?: string, context?: any) => {
    return invokeEdgeFunction('generate-system-prompt-from-website', {
      website_url: websiteUrl,
      business_name: businessName,
      ...context
    });
  },

  // Verify Retell API connectivity and fetch agent details (server-side)
  getRetellAgent: async (agentId: string) => {
    return invokeEdgeFunction('retell-get-agent', {
      agent_id: agentId,
    });
  },

  // Update A2P compliance status (admin only)
  updateA2PStatus: async (clientId: string, a2pStatus: string) => {
    return invokeEdgeFunction('update-a2p-status', {
        client_id: clientId,
        a2p_status: a2pStatus,
    });
  },

  // Disable AI voice for a client
  disableVoice: async (clientId: string) => {
    return invokeEdgeFunction('disable-voice', {
        client_id: clientId,
    });
  },

  generateDocument: async (documentType: string, inputs: any) => invokeEdgeFunction('generate-document', { documentType, inputs }),
  generateAdminContent: async (context: any) => invokeEdgeFunction('generate-admin-content', context),
  generateEmail: async (emailType: string, inputs: any) => invokeEdgeFunction('generate-email-content', { emailType, inputs }),
  sendEmail: async (to_email: string, subject: string, markdown_body: string, client_id: string | null, sent_by: string) => {
    const html_body = marked.parse(markdown_body);
    return invokeEdgeFunction('send-email', { to_email, subject, html_body, client_id, sent_by });
  },
  
  createStripeCustomer: async (clientId: string) => invokeEdgeFunction('stripe-api/create-customer', { client_id: clientId }),
  createSubscription: async (clientId: string, priceId: string, setupFeePriceId?: string) => invokeEdgeFunction('stripe-api/create-subscription', { client_id: clientId, price_id: priceId, setup_fee_price_id: setupFeePriceId }),
  createInvoice: async (clientId: string, lineItems: any[], dueDate?: string) => invokeEdgeFunction('stripe-api/create-invoice', { client_id: clientId, line_items: lineItems, due_date: dueDate }),
  createDepositInvoice: async (clientId: string, amount: number, description: string, projectId?: string) => invokeEdgeFunction('stripe-api/create-deposit-invoice', { client_id: clientId, deposit_details: { amount, description, project_id: projectId } }),
  createMilestoneInvoice: async (clientId: string, milestoneId: string, amountCents: number, description: string, projectId: string) => invokeEdgeFunction('stripe-api/create-milestone-invoice', { client_id: clientId, milestone_details: { milestone_id: milestoneId, amount_cents: amountCents, description, project_id: projectId } }),
  createPortalSession: async (clientId: string) => invokeEdgeFunction('stripe-api/create-portal-session', { client_id: clientId }),
  createBillingProduct: async (productData: any) => invokeEdgeFunction('create-billing-product', productData),
  applyDepositToMilestone: async (depositId: string, milestoneId: string, projectId: string) => {
      const { data, error } = await supabase.rpc('apply_deposit_to_milestone', { p_deposit_id: depositId, p_milestone_id: milestoneId, p_project_id: projectId });
      if (error) throw error;
      return data;
  },
  deletePendingDeposit: async (depositId: string) => {
      const { data, error } = await supabase.rpc('delete_pending_deposit', { p_deposit_id: depositId });
      if (error) throw error;
      return data;
  },
  applyInvoiceDiscount: async (invoiceId: string, discountType: any, discountValue: number, appliedBy: string) => invokeEdgeFunction('apply-invoice-discount', { invoice_id: invoiceId, discount_type: discountType, discount_value: discountValue, applied_by: appliedBy }),
  resendInvoiceEmail: async (invoiceId: string, clientEmail: string, clientName: string, hostedUrl: string, amount: number, sentBy: string) => {
      const subject = `Invoice Reminder: ${clientName} - $${amount.toFixed(2)} Due`;
      const markdown_body = `Dear ${clientName},\n\nThis is a reminder for your invoice of **$${amount.toFixed(2)}**.\n\n[View & Pay Invoice](${hostedUrl})\n\nThank you,\nThe Custom Websites Plus Team`;
      return AdminService.sendEmail(clientEmail, subject, markdown_body, null, sentBy);
  },
  markInvoiceResolved: async (invoiceId: string) => {
      const { error } = await supabase.from('invoices').update({ status: 'paid', last_reminder_sent_at: new Date().toISOString() }).eq('id', invoiceId);
      if (error) throw error;
      return { success: true };
  },
  toggleInvoiceReminders: async (invoiceId: string, disable: boolean) => {
      const { error } = await supabase.from('invoices').update({ disable_reminders: disable }).eq('id', invoiceId);
      if (error) throw error;
      return { success: true };
  },
  createClientReminder: async (clientId: string, adminId: string, reminderDate: string, note: string) => {
    const { data, error } = await supabase.from('client_reminders').insert({ client_id: clientId, admin_id: adminId, reminder_date: reminderDate, note: note });
    if (error) throw error;
    return data;
  },
  completeClientReminder: async (reminderId: string) => {
    const { data, error } = await supabase.from('client_reminders').update({ is_completed: true }).eq('id', reminderId);
    if (error) throw error;
    return data;
  },
  // AI Agent Settings
  getAgentSettings: async (clientId: string) => invokeEdgeFunction('get-agent-settings', { client_id: clientId }),
  saveAgentSettings: async (settings: any) => invokeEdgeFunction('save-agent-settings', settings),

  disconnectGoogleCalendar: async (clientId: string) => {
    const { error } = await supabase
      .from('client_google_calendar')
      .update({ connection_status: 'disconnected' })
      .eq('client_id', clientId);
    if (error) throw error;
    return { success: true };
  },
  resetGoogleCalendar: async (clientId: string) => {
    const { error } = await supabase
      .from('client_google_calendar')
      .delete()
      .eq('client_id', clientId);
    if (error) throw error;
    return { success: true };
  },
};