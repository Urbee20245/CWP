import { supabase } from '../integrations/supabase/client';

async function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function extractEdgeFunctionErrorMessage(error: any, parsedBody: any) {
  const bodyError = parsedBody?.error || parsedBody?.message;
  if (typeof bodyError === 'string' && bodyError.trim()) return bodyError;

  const ctx: any = error?.context;
  if (ctx) {
    try {
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
  // we may still have a useful JSON body.
  let parsed: any = null;
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    // data wasn't valid JSON — ignore
  }

  if (error) {
    const message = await extractEdgeFunctionErrorMessage(error, parsed);
    console.error(`[clientIntegrationService] Error invoking ${functionName}:`, message);
    throw new Error(message);
  }

  if (parsed?.error) {
    console.error(`[clientIntegrationService] Edge function ${functionName} returned error:`, parsed.error);
    throw new Error(parsed.error);
  }

  return parsed;
};

export const ClientIntegrationService = {

  // --- Twilio Integration ---

  getTwilioConfig: async (clientId: string) => {
    return invokeEdgeFunction('get-twilio-config', { client_id: clientId });
  },

  saveTwilioCredentials: async (clientId: string, accountSid: string, authToken: string, phoneNumber: string) => {
    return invokeEdgeFunction('save-twilio-credentials', {
        client_id: clientId,
        account_sid: accountSid,
        auth_token: authToken,
        phone_number: phoneNumber
    });
  },

  testTwilioConnection: async (clientId: string) => {
    return invokeEdgeFunction('test-twilio-connection', { client_id: clientId });
  },

  // --- Twilio Connect ---

  completeTwilioConnect: async (clientId: string, twilioAccountSid: string) => {
    return invokeEdgeFunction('twilio-connect-complete', {
      client_id: clientId,
      twilio_account_sid: twilioAccountSid,
    });
  },

  getTwilioPhoneNumbers: async (clientId: string) => {
    return invokeEdgeFunction('get-twilio-phone-numbers', { client_id: clientId });
  },

  selectTwilioPhoneNumber: async (clientId: string, phoneNumber: string) => {
    return invokeEdgeFunction('save-twilio-credentials', {
      client_id: clientId,
      phone_number: phoneNumber,
      update_phone_only: true,
    });
  },

  // --- A2P Registration ---

  submitA2PRegistration: async (clientId: string, a2pRegistrationData: any) => {
    return invokeEdgeFunction('submit-a2p-registration', {
        client_id: clientId,
        a2p_registration_data: a2pRegistrationData,
    });
  },

  // --- Google Calendar Integration ---

  initGoogleCalendarAuth: async (clientId: string) => {
    return invokeEdgeFunction('google-oauth-init', { client_id: clientId });
  },

  getGoogleCalendarStatus: async (clientId: string) => {
    const { data, error } = await supabase
        .from('client_google_calendar')
        .select('connection_status, calendar_id, updated_at')
        .eq('client_id', clientId)
        .maybeSingle();

    if (error) throw error;
    return data;
  },

  disconnectGoogleCalendar: async (clientId: string) => {
    const { error } = await supabase
        .from('client_google_calendar')
        .update({
            connection_status: 'disconnected',
            google_access_token: '',
            last_synced_at: new Date().toISOString()
        })
        .eq('client_id', clientId);

    if (error) throw error;
    return { success: true };
  }
};