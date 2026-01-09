import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const RECAPTCHA_SECRET_KEY = Deno.env.get('RECAPTCHA_SECRET_KEY');

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (!RECAPTCHA_SECRET_KEY) {
    return errorResponse("reCAPTCHA secret key is missing.", 500);
  }

  try {
    const { email, password, recaptchaToken, action } = await req.json();

    if (!email || !password || !recaptchaToken || !action) {
      return errorResponse('Missing required fields.', 400);
    }
    
    console.log(`[secure-auth] Verifying reCAPTCHA for action: ${action}`);

    // 1. Verify reCAPTCHA Token (v3 verification)
    const verificationResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    });

    const verificationData = await verificationResponse.json();

    // Check success and score (v3 threshold of 0.5)
    if (!verificationData.success || verificationData.score < 0.5) {
      console.warn(`[secure-auth] reCAPTCHA verification failed for ${email}. Score: ${verificationData.score}`);
      return errorResponse('Spam detection failed. Please try again.', 403);
    }
    
    console.log(`[secure-auth] reCAPTCHA verified successfully. Score: ${verificationData.score}`);

    // 2. Initialize Public Supabase Client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    let authResult;

    // 3. Perform Auth Action
    if (action === 'login') {
      authResult = await supabase.auth.signInWithPassword({ email, password });
    } else if (action === 'signup') {
      // Note: We pass user_metadata for the profile trigger to work correctly
      authResult = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: {
                full_name: email.split('@')[0],
            }
        }
      });
    } else {
        return errorResponse('Invalid authentication action.', 400);
    }

    if (authResult.error) {
      console.error(`[secure-auth] Supabase Auth failed: ${authResult.error.message}`);
      return errorResponse(authResult.error.message, 401);
    }

    return jsonResponse({ success: true, data: authResult.data });

  } catch (error: any) {
    console.error('[secure-auth] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});