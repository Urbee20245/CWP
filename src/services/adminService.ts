import { supabase } from '../integrations/supabase/client';
import { marked } from 'marked';

// Add: constants for direct public edge invocation
const SUPABASE_EDGE_BASE = 'https://nvgumhlewbqynrhlkqhx.supabase.co/functions/v1';
// Using the publishable anon key (already public in the client) to satisfy gateway headers
const SUPABASE_ANON_KEY_PUBLIC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52Z3VtaGxld2JxeW5yaGxrcWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MTQzNTcsImV4cCI6MjA4MzM5MDM1N30.OQb2wiXmof5xneC_HTorjnguBmfA19yghSluozTvmKU';

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

const invokeEdgeFunction = async (functionName: string, payload: any, options?: { headers?: Record<string, string> }) => {
  // Explicitly get session to ensure auth header is fresh
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Could not get user session: ${sessionError.message}`);
  }
  if (!session) {
    // This should not happen in admin context, but as a safeguard
    throw new Error('Admin user not authenticated.');
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  let parsed: any = null;
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    // ignore
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

// Add: direct public edge invocation to avoid session JWT
async function callPublicEdgeFunction(functionName: string, payload: any) {
  const url = `${SUPABASE_EDGE_BASE}/${functionName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Provide anon key in both Authorization and apikey, as recommended by Supabase
      'Authorization': `Bearer ${SUPABASE_ANON_KEY_PUBLIC}`,
      'apikey': SUPABASE_ANON_KEY_PUBLIC,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // leave as null
  }

  if (!res.ok) {
    const message = json?.error || json?.message || text || `Edge function ${functionName} failed (${res.status})`;
    throw new Error(message);
  }

  if (json?.error) {
    throw new Error(json.error);
  }

  return json;
}

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
  // Public read helper (avoids expired JWT issues)
  getAgentSettings: async (clientId: string) => callPublicEdgeFunction('get-agent-settings', { client_id: clientId }),
  saveAgentSettings: async (settings: any) => invokeEdgeFunction('save-agent-settings', settings),

  // Calendar Diagnostics (admin-only)
  getCalendarDiagnostics: async (clientId: string) => invokeEdgeFunction('get-calendar-diagnostics', { client_id: clientId }),
  forceCalendarReauth: async (clientId: string) => invokeEdgeFunction('force-calendar-reauth', { client_id: clientId }),

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

  // Retell Call Scheduling
  // Trigger a Retell AI call immediately or schedule for later
  triggerRetellCall: async (params: {
    client_id: string | null; // Optional - null for ad-hoc calls to non-clients
    prospect_name: string;
    prospect_phone: string;
    retell_agent_id: string;
    from_phone_number?: string; // Required if client_id is null
    scheduled_time?: string; // ISO timestamp - if provided, schedules the call
    trigger_immediately?: boolean; // If true, calls immediately
    admin_notes?: string;
    call_metadata?: any;
    connection_type?: string; // How admin connected with prospect (referral, event, linkedin, website, direct)
    referrer_name?: string; // Name of person who referred (for referrals)
    event_name?: string; // Name of event (for event connections)
    direct_context?: string; // Brief context (for direct connections)
  }) => {
    return invokeEdgeFunction('trigger-retell-call', params);
  },

  // Get all scheduled calls (admin view)
  getScheduledCalls: async (filters?: { client_id?: string; status?: string }) => {
    let query = supabase
      .from('retell_scheduled_calls')
      .select(`
        *,
        clients!retell_scheduled_calls_client_id_fkey(id, business_name, phone),
        profiles!retell_scheduled_calls_created_by_fkey(id, email, full_name)
      `)
      .order('scheduled_time', { ascending: false });

    if (filters?.client_id) {
      query = query.eq('client_id', filters.client_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get a single scheduled call by ID
  getScheduledCall: async (scheduledCallId: string) => {
    const { data, error } = await supabase
      .from('retell_scheduled_calls')
      .select(`
        *,
        clients!retell_scheduled_calls_client_id_fkey(id, business_name, phone),
        profiles!retell_scheduled_calls_created_by_fkey(id, email, full_name)
      `)
      .eq('id', scheduledCallId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // Cancel a scheduled call
  cancelScheduledCall: async (scheduledCallId: string) => {
    const { error } = await supabase
      .from('retell_scheduled_calls')
      .update({ status: 'cancelled' })
      .eq('id', scheduledCallId);

    if (error) throw error;
    return { success: true };
  },

  // Update scheduled call notes
  updateScheduledCallNotes: async (scheduledCallId: string, admin_notes: string) => {
    const { error } = await supabase
      .from('retell_scheduled_calls')
      .update({ admin_notes })
      .eq('id', scheduledCallId);

    if (error) throw error;
    return { success: true };
  },

  // Manually trigger a scheduled call (force it to run now)
  forceScheduledCall: async (scheduledCallId: string) => {
    return invokeEdgeFunction('trigger-retell-call', { scheduled_call_id: scheduledCallId });
  },

  // Process all pending scheduled calls (manual trigger of cron job)
  processScheduledCalls: async () => {
    return invokeEdgeFunction('process-scheduled-calls', {});
  },

  // Get all Retell agents
  getRetellAgents: async () => {
    return invokeEdgeFunction('get-retell-agents', {});
  },

  // Get platform outbound phone numbers (for admin calling)
  getPlatformPhoneNumbers: async () => {
    return invokeEdgeFunction('get-platform-phone-numbers', {});
  },

  // Website Builder
  generateWebsite: async (briefData: {
    client_id: string;
    business_name: string;
    industry: string;
    services_offered: string;
    location: string;
    tone: string;
    primary_color: string;
    art_direction?: string;
  }) => invokeEdgeFunction('generate-website', briefData),

  updateWebsitePublish: async (clientId: string, isPublished: boolean) =>
    invokeEdgeFunction('update-website-publish', { client_id: clientId, is_published: isPublished }),

  saveWebsiteEdits: async (clientId: string, edits: Array<{ field_path: string; new_value: string }>) =>
    invokeEdgeFunction('save-website-edits', { client_id: clientId, edits }),
};