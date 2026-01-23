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
};