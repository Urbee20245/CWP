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
  /**
   * Always invoke with an explicit access token and refresh/retry once for JWT failures.
   * This avoids intermittent "Invalid JWT" errors when the session token is stale.
   */
  const invokeWithToken = async (accessToken: string) => {
    return supabase.functions.invoke(functionName, {
      body: payload,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  };

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(`Could not get user session: ${sessionError.message}`);
  }
  if (!sessionData.session?.access_token) {
    throw new Error('Admin user not authenticated.');
  }

  let result = await invokeWithToken(sessionData.session.access_token);

  // If JWT-related failure, refresh + retry once
  if (result.error) {
    let errMsg = '';
    try {
      const parsed = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      errMsg = await extractEdgeFunctionErrorMessage(result.error, parsed);
    } catch {
      errMsg = result.error.message || '';
    }

    if (/invalid jwt|jwt expired|token.*expired/i.test(errMsg)) {
      console.warn(`[adminService] JWT stale for ${functionName}, refreshing session…`);
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session?.access_token) {
        throw new Error('Session expired. Please log in again.');
      }
      result = await invokeWithToken(refreshData.session.access_token);
    }
  }

  let parsed: any = null;
  try {
    parsed = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
  } catch {
    // ignore
  }

  if (result.error) {
    const message = await extractEdgeFunctionErrorMessage(result.error, parsed);
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
  updateClientProfile: async (profileId: string, fullName: string, role: string) =>
    invokeEdgeFunction('update-client-profile', { profile_id: profileId, full_name: fullName, role }),

  // SMS
  sendSms: async (to: string, body: string, clientId?: string) => invokeEdgeFunction('send-sms', { to, body, client_id: clientId }),
  getSmsMessages: async (clientId: string) => invokeEdgeFunction('get-sms-messages', { client_id: clientId }),

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
    // marked.parse() returns string | Promise<string> in v5+. Always await to handle both.
    const html_body = await Promise.resolve(marked.parse(markdown_body));
    return invokeEdgeFunction('send-email', { to_email, subject, html_body, client_id, sent_by });
  },
  
  createStripeCustomer: async (clientId: string) => invokeEdgeFunction('stripe-api/create-customer', { client_id: clientId }),
  createSubscription: async (clientId: string, priceId: string, setupFeePriceId?: string) =>
    invokeEdgeFunction('stripe-api/create-subscription', { client_id: clientId, price_id: priceId, setup_fee_price_id: setupFeePriceId }),
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

  /**
   * Generate a one-time magic link for a client so an admin can access their portal.
   * Calls the `admin-impersonate` edge function which uses the Supabase Admin Auth API.
   * Returns the action_link URL string.
   */
  impersonateClient: async (clientEmail: string, adminName: string): Promise<string> => {
    const data = await invokeEdgeFunction('admin-impersonate', {
      client_email: clientEmail,
      admin_name: adminName,
    });
    if (!data?.action_link) {
      throw new Error('No action_link returned from server.');
    }
    return data.action_link;
  },

  // ── Website Builder ────────────────────────────────────────────────────────

  /** Trigger AI generation of a multi-page website for a client. */
  generateWebsite: async (payload: {
    client_id: string;
    business_name: string;
    industry: string;
    services_offered: string;
    location: string;
    tone: string;
    primary_color?: string;
    art_direction?: string;
    pages_to_generate?: string[];
    premium_features?: string[];
    ai_provider?: string;
  }) => invokeEdgeFunction('generate-website', payload),

  /** Publish or unpublish a client's website. */
  updateWebsitePublish: async (clientId: string, isPublished: boolean) => {
    const { error } = await supabase
      .from('website_briefs')
      .update({ is_published: isPublished })
      .eq('client_id', clientId);
    if (error) throw new Error(error.message);
  },

  /** Save a custom domain for a client's website. */
  saveCustomDomain: async (clientId: string, domain: string | null) => {
    const { error } = await supabase
      .from('website_briefs')
      .update({ custom_domain: domain })
      .eq('client_id', clientId);
    if (error) throw new Error(error.message);
  },

  // ── Site Import ────────────────────────────────────────────────────────────

  /**
   * Import an existing site (ZIP or URL) into CWP via Claude AI.
   * Returns { success, client_slug, website_json, backend_features, pages_imported, business_name }.
   */
  importSite: async (payload: {
    client_id: string;
    source_type: 'url' | 'zip' | 'github';
    url?: string;
    zip_base64?: string;
    github_url?: string;
    slug?: string;
    custom_domain?: string;
    tone?: string;
    primary_color?: string;
    premium_features?: string[];
  }) => invokeEdgeFunction('import-site', payload),

  /**
   * Clone a website's visual look from an uploaded screenshot image via Gemini Vision.
   * Returns { success, client_slug, website_json }.
   */
  cloneWebsiteFromImage: async (payload: {
    client_id: string;
    image_base64: string;
    image_mime_type?: string;
    business_name: string;
    industry: string;
    services_offered: string;
    location: string;
    tone?: string;
    primary_color?: string;
    pages_to_generate?: string[];
  }) => invokeEdgeFunction('clone-website-from-image', payload),

  /**
   * Clone a website's look from a URL/domain using the existing import-site scraper.
   * Returns { success, client_slug, website_json, backend_features, pages_imported, business_name }.
   */
  cloneWebsiteFromUrl: async (payload: {
    client_id: string;
    url: string;
    tone?: string;
    primary_color?: string;
  }) => invokeEdgeFunction('import-site', {
    ...payload,
    source_type: 'url',
  }),

  // ── Claude Admin Assistant ──────────────────────────────────────────────────

  /**
   * Send a message to the Claude admin assistant.
   * Pass `confirmed_operation` when resuming after an admin approved/rejected a proposed DB change or file write.
   * Pass `session_context` to scope actions to CWP, a specific client, or all clients.
   * Pass `model` to select the Claude model (defaults to claude-sonnet-4-5).
   */
  callClaudeAssistant: async (payload: {
    messages: Array<{ role: string; content: string }>;
    confirmed_operation?: { approved: boolean; operation: any; tool_id: string; type?: string } | null;
    session_context?: {
      type: 'cwp' | 'client' | 'all_clients';
      label: string;
      repo?: string;
      clientId?: string;
      clientSlug?: string;
    } | null;
    model?: string;
  }) => invokeEdgeFunction('claude-admin-assistant', payload),
};