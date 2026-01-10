import { supabase } from '../integrations/supabase/client';

const invokeEdgeFunction = async (functionName: string, payload: any) => {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: JSON.stringify(payload),
  });

  if (error) {
    console.error(`Error invoking ${functionName}:`, error);
    throw new Error(error.message || `Edge Function Timeout or Network Error: Failed to call ${functionName}`);
  }
  
  if (data.error) {
    console.error(`Edge function ${functionName} returned error:`, data.error);
    throw new Error(data.error);
  }

  return data;
};

export const FormService = {
    submitContactForm: async (formData: any) => {
        console.log('🚀 Calling submit-contact-form function with:', formData);
        return invokeEdgeFunction('submit-contact-form', {
            ...formData,
            formType: 'Quick Inquiry',
        });
    },
    
    submitConsultationForm: async (formData: any) => {
        console.log('🚀 Calling submit-contact-form function with:', formData);
        return invokeEdgeFunction('submit-contact-form', {
            ...formData,
            formType: 'Consultation Request',
        });
    }
};