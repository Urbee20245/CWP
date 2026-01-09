import { supabase } from '../integrations/supabase/client';

const invokeEdgeFunction = async (functionName: string, payload: any) => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: JSON.stringify(payload),
  });

  if (error) {
    console.error(`Error invoking ${functionName}:`, error);
    // Ensure a proper Error object is thrown, providing a descriptive message for timeouts/network issues.
    throw new Error(error.message || `Edge Function Timeout or Network Error: Failed to call ${functionName}`);
  }
  
  // Check for structured error response from the Edge Function body
  if (data.error) {
    console.error(`Edge function ${functionName} returned error:`, data.error);
    throw new Error(data.error);
  }
  
  // Check for non-structured error response (e.g., if the function returned a 4xx/5xx status with a message)
  if (data.message && data.status && data.status >= 400) {
      console.error(`Edge function ${functionName} returned status ${data.status}:`, data.message);
      throw new Error(data.message);
  }

  return data;
};

export const AuthService = {
  secureLogin: async (email: string, password: string, recaptchaToken: string) => {
    return invokeEdgeFunction('secure-auth', { 
        email, 
        password, 
        recaptchaToken, 
        action: 'login' 
    });
  },
  
  secureSignup: async (email: string, password: string, recaptchaToken: string) => {
    return invokeEdgeFunction('secure-auth', { 
        email, 
        password, 
        recaptchaToken, 
        action: 'signup' 
    });
  },
};