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