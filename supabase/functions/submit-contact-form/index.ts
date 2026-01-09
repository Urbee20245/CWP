import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

// The target email address for all form submissions
const ADMIN_EMAIL = "info@customwebsitesplus.com";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role key to invoke other functions
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const formData = await req.json();
    const { name, email, phone, message, recaptchaToken, formType, ...additionalFields } = formData;

    if (!email || !name || !formType) {
      return errorResponse('Missing required fields: name, email, or formType.', 400);
    }
    
    console.log(`[submit-contact-form] Received submission for ${formType} from ${email}`);

    // --- Construct Email Body ---
    let htmlBody = `
      <h2>New Form Submission: ${formType}</h2>
      <p><strong>From:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      <hr>
      <h3>Additional Details:</h3>
    `;
    
    // Add any extra fields from the form (e.g., budget, timeline)
    for (const [key, value] of Object.entries(additionalFields)) {
        if (value) {
            htmlBody += `<p><strong>${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> ${Array.isArray(value) ? value.join(', ') : value}</p>`;
        }
    }
    
    // --- Invoke send-email Edge Function ---
    const sendEmailPayload = {
        to_email: ADMIN_EMAIL,
        subject: `NEW LEAD: ${formType} from ${name}`,
        html_body: htmlBody,
        client_id: null, // Not associated with an existing client yet
        sent_by: 'system_form_submission',
    };

    const { data: emailResult, error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
        body: JSON.stringify(sendEmailPayload),
    });

    if (emailError) {
        console.error('[submit-contact-form] Failed to invoke send-email:', emailError);
        throw new Error(emailError.message);
    }
    
    if (emailResult.error) {
        console.error('[submit-contact-form] send-email returned error:', emailResult.error);
        throw new Error(emailResult.error);
    }

    console.log(`[submit-contact-form] Email successfully dispatched to ${ADMIN_EMAIL}`);
    return jsonResponse({ success: true, message: 'Form submitted and email sent.' });

  } catch (error: any) {
    console.error('[submit-contact-form] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});