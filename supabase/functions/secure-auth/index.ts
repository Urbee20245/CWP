import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const RECAPTCHA_SECRET_KEY = Deno.env.get('RECAPTCHA_SECRET_KEY');
const RECAPTCHA_THRESHOLD = 0.5;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const isDevBypass = !RECAPTCHA_SECRET_KEY;
  
  // Initialize Public Supabase Client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  );

  try {
    const { email, password, recaptchaToken, action } = await req.json();

    if (!email || !password || !action) {
      console.error('[secure-auth] Missing required fields in request body.');
      return errorResponse('Missing required fields: email, password, or action.', 400);
    }
    
    console.log(`[secure-auth] login_start for: ${email}`);

    if (!isDevBypass) {
        if (!recaptchaToken) {
            console.error('[secure-auth] Missing reCAPTCHA token.');
            return errorResponse('reCAPTCHA token is missing. Please refresh and try again.', 400);
        }
        
        console.log(`[secure-auth] Verifying reCAPTCHA for action: ${action}`);

        // 1. Verify reCAPTCHA Token (v3 verification)
        const verificationResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
        });

        const verificationData = await verificationResponse.json();

        // 2. Validate: success, score, and action match
        if (!verificationData.success) {
            console.error(`[secure-auth] reCAPTCHA verification failed: ${JSON.stringify(verificationData['error-codes'])}`);
            return errorResponse('Security check failed. Please try again.', 403);
        }
        
        if (verificationData.score < RECAPTCHA_THRESHOLD) {
            console.warn(`[secure-auth] Low reCAPTCHA score for ${email}. Score: ${verificationData.score}`);
            return errorResponse('Security check failed: Detected as potential spam.', 403);
        }
        
        // Optional: Check action match (v3 best practice)
        if (verificationData.action !== action) {
            console.warn(`[secure-auth] Action mismatch: Expected ${action}, got ${verificationData.action}`);
        }
        
        console.log(`[secure-auth] reCAPTCHA verified successfully. Score: ${verificationData.score}`);
    } else {
        console.warn(`[secure-auth] WARNING: RECAPTCHA_SECRET_KEY is missing. Bypassing security check.`);
    }

    let authResult;
    console.log('[secure-auth] edge_invoke_start');

    // 3. Perform Auth Action
    if (action === 'login') {
      authResult = await supabase.auth.signInWithPassword({ email, password });
    } else if (action === 'signup') {
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
      // Return a generic error message to prevent enumeration attacks
      return errorResponse('Invalid login credentials.', 401);
    }
    
    console.log('[secure-auth] edge_invoke_result: success');
    
    // Return tokens and user data for client-side session setting
    return jsonResponse({ 
        success: true, 
        user: authResult.data.user,
        access_token: authResult.data.session?.access_token,
        refresh_token: authResult.data.session?.refresh_token,
    });

  } catch (error: any) {
    console.error('[secure-auth] Unhandled error:', error.message);
    // Step 2: Fail Safe - return clean 500 response
    return errorResponse('Internal server error during authentication.', 500);
  }
});