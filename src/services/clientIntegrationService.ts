import { supabase } from '../integrations/supabase/client';

const invokeEdgeFunction = async (functionName: string, payload: any) => {
  // The Supabase SDK automatically injects the Authorization header from the active session.
  // We do not need to manually fetch the session or set headers here.
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  });

  if (error) {
    console.error(`[clientIntegrationService] Error invoking ${functionName}:`, error);
    throw new Error(error.message || `Failed to call ${functionName}`);
  }

  if (data?.error) {
    console.error(`[clientIntegrationService] Edge function ${functionName} returned error:`, data.error);
    throw new Error(data.error);
  }

  return data;
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
  
  // --- Google Calendar Integration ---
  
  initGoogleCalendarAuth: async (clientId: string) => {
    return invokeEdgeFunction('google-oauth-init', { client_id: clientId });
  },
  
  getGoogleCalendarStatus: async (clientId: string) => {
    // This uses a direct query which respects RLS
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