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
  /**
   * Always invoke with an explicit access token.
   * Never rely on implicit Supabase auth injection.
   */
  const invokeWithToken = async (accessToken: string) => {
    return supabase.functions.invoke(functionName, {
      body: payload,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  };

  // 1️⃣ Get current session
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`Could not get user session: ${sessionError.message}`);
  }

  if (!session?.access_token) {
    throw new Error('User not authenticated. Please log in.');
  }

  // 2️⃣ First attempt
  let result = await invokeWithToken(session.access_token);

  // 3️⃣ If JWT-related failure, refresh + retry ONCE
  if (result.error) {
    let errMsg = '';
    try {
      const parsed = typeof result.data === 'string'
        ? JSON.parse(result.data)
        : result.data;
      errMsg = await extractEdgeFunctionErrorMessage(result.error, parsed);
    } catch {
      errMsg = result.error.message || '';
    }

    if (/invalid jwt|jwt expired|token.*expired/i.test(errMsg)) {
      console.warn(
        `[clientIntegrationService] JWT stale for ${functionName}, refreshing session…`
      );

      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession();

      if (refreshError || !refreshData?.session?.access_token) {
        console.error(
          `[clientIntegrationService] Session refresh failed for ${functionName}:`,
          refreshError?.message || 'no session returned'
        );
        throw new Error('Session expired. Please log in again.');
      }

      result = await invokeWithToken(refreshData.session.access_token);
    }
  }

  // 4️⃣ Parse response body (even on non-2xx)
  let parsed: any = null;
  try {
    parsed = typeof result.data === 'string'
      ? JSON.parse(result.data)
      : result.data;
  } catch {
    // ignore
  }

  // 5️⃣ Final error handling
  if (result.error) {
    const message = await extractEdgeFunctionErrorMessage(result.error, parsed);
    console.error(
      `[clientIntegrationService] Error invoking ${functionName}:`,
      message
    );
    throw new Error(message);
  }

  if (parsed?.error) {
    console.error(
      `[clientIntegrationService] Edge function ${functionName} returned error:`,
      parsed.error
    );
    throw new Error(parsed.error);
  }

  return parsed;
};

export const ClientIntegrationService = {
  // --- Twilio Integration ---

  getTwilioConfig: async (clientId: string) => {
    return invokeEdgeFunction('get-twilio-config', { client_id: clientId });
  },

  saveTwilioCredentials: async (
    clientId: string,
    accountSid: string,
    authToken: string,
    phoneNumber: string
  ) => {
    return invokeEdgeFunction('save-twilio-credentials', {
      client_id: clientId,
      account_sid: accountSid,
      auth_token: authToken,
      phone_number: phoneNumber,
    });
  },

  testTwilioConnection: async (clientId: string) => {
    return invokeEdgeFunction('test-twilio-connection', { client_id: clientId });
  },

  // --- Twilio Connect ---

  completeTwilioConnect: async (
    clientId: string,
    twilioAccountSid: string
  ) => {
    return invokeEdgeFunction('twilio-connect-complete', {
      client_id: clientId,
      twilio_account_sid: twilioAccountSid,
    });
  },

  getTwilioPhoneNumbers: async (clientId: string) => {
    return invokeEdgeFunction('get-twilio-phone-numbers', {
      client_id: clientId,
    });
  },

  selectTwilioPhoneNumber: async (clientId: string, phoneNumber: string) => {
    return invokeEdgeFunction('save-twilio-credentials', {
      client_id: clientId,
      phone_number: phoneNumber,
      update_phone_only: true,
    });
  },

  // --- A2P Registration ---

  submitA2PRegistration: async (
    clientId: string,
    a2pRegistrationData: any
  ) => {
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
      .select(
        'connection_status, calendar_id, updated_at, refresh_token_present, reauth_reason, last_error'
      )
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
        google_refresh_token: '',
        refresh_token_present: false,
        access_token_expires_at: null,
        reauth_reason: null,
        last_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('client_id', clientId);

    if (error) throw error;
    return { success: true };
  },

  // --- Cal.com Integration ---

  initCalComAuth: async (clientId: string, returnTo?: string) => {
    return invokeEdgeFunction('cal-oauth-init', {
      client_id: clientId,
      return_to: returnTo || null,
    });
  },

  getCalComStatus: async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_cal_calendar')
      .select(
        'connection_status, updated_at, refresh_token_present, reauth_reason, last_error, default_event_type_id, auth_method, cal_booking_link'
      )
      .eq('client_id', clientId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  setCalComDefaultEventTypeId: async (
    clientId: string,
    eventTypeId: string | null
  ) => {
    const clean = typeof eventTypeId === 'string' ? eventTypeId.trim() : '';
    const { error } = await supabase
      .from('client_cal_calendar')
      .update({
        default_event_type_id: clean.length ? clean : null,
      })
      .eq('client_id', clientId);

    if (error) throw error;
    return { success: true };
  },

  setCalComBookingLink: async (
    clientId: string,
    bookingLink: string | null
  ) => {
    // Normalize the booking link - extract just the path if a full URL is provided
    let clean = typeof bookingLink === 'string' ? bookingLink.trim() : '';
    if (clean) {
      // Remove common prefixes to get just the path (e.g., "username/30min")
      clean = clean
        .replace(/^https?:\/\/(app\.)?cal\.com\//i, '')
        .replace(/^cal\.com\//i, '')
        .replace(/^\//, '')
        .replace(/\/$/, '');
    }

    const { error } = await supabase
      .from('client_cal_calendar')
      .update({
        cal_booking_link: clean.length ? clean : null,
      })
      .eq('client_id', clientId);

    if (error) throw error;
    return { success: true };
  },

  disconnectCalCom: async (clientId: string) => {
    const { error } = await supabase
      .from('client_cal_calendar')
      .update({
        connection_status: 'disconnected',
        cal_access_token: '',
        cal_refresh_token: '',
        refresh_token_present: false,
        access_token_expires_at: null,
        auth_method: 'oauth',
        reauth_reason: null,
        last_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('client_id', clientId);

    if (error) throw error;
    return { success: true };
  },

  saveCalComApiKey: async (clientId: string, apiKey: string) => {
    return invokeEdgeFunction('save-cal-api-key', {
      client_id: clientId,
      api_key: apiKey,
    });
  },
};
