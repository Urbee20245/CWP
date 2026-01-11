import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role key for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { email, password, fullName, businessName, phone, billingEmail } = await req.json();

    if (!email || !password || !fullName || !businessName) {
      return errorResponse('Missing required fields.', 400);
    }
    
    console.log(`[create-client-user] Attempting to create user: ${email}`);

    // 1. Create Auth User (Requires Service Role Key)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirm email immediately
      user_metadata: {
        full_name: fullName,
        role: 'client',
      },
    });

    if (authError) {
      console.error('[create-client-user] Auth creation failed:', authError.message);
      return errorResponse(`Auth creation failed: ${authError.message}`, 400);
    }
    
    const newUserId = authData.user.id;
    const finalClientEmail = billingEmail || email;
    console.log(`[create-client-user] User created with ID: ${newUserId}`);

    // 2. Create Client Record (Requires Service Role Key)
    const { error: clientError, data: clientData } = await supabaseAdmin
      .from('clients')
      .insert({
        owner_profile_id: newUserId,
        business_name: businessName,
        phone: phone || null,
        billing_email: finalClientEmail,
        status: 'active',
        access_status: 'active',
      })
      .select('id')
      .single();

    if (clientError) {
      console.error('[create-client-user] Client record creation failed:', clientError);
      // IMPORTANT: If client creation fails, delete the auth user to prevent orphaned accounts
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return errorResponse(`Failed to create client record. User deleted. Error: ${clientError.message}`, 500);
    }
    
    // 3. Update Profile (The trigger handles initial profile, but we ensure role/name consistency)
    const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: 'client', full_name: fullName })
        .eq('id', newUserId);
        
    if (profileUpdateError) {
        console.warn('[create-client-user] Failed to update profile role/name:', profileUpdateError);
    }
    
    // 4. Send Welcome Email
    const subject = `Welcome to the ${businessName} Client Portal!`;
    const portalUrl = Deno.env.get('PUBLIC_BASE_URL') || 'https://customwebsitesplus.com/login'; // Assuming a base URL env var or hardcoded fallback
    
    const markdownBody = `
Hello **${fullName}**,

Welcome aboard! Your client portal is now active. You can log in immediately using the temporary credentials below.

### Portal Access Details

*   **Portal URL:** [Client Portal Login](${portalUrl})
*   **Email:** \`${email}\`
*   **Temporary Password:** \`${password}\`

We strongly recommend you change your password immediately after your first login for security.

---

### What you can do in the Client Portal:

*   **Project Dashboard:** Track the progress of your website rebuild or service project in real-time.
*   **Milestones & Billing:** View all invoices, payment history, and manage your maintenance subscriptions.
*   **Messaging:** Communicate directly with our team via project-specific threads.
*   **Files & Documents:** Upload necessary assets and access shared documents (like legal drafts or strategy plans).
*   **Appointments:** Easily book and manage consultation calls with our team.

We are excited to start working with you! If you have any questions, please reply to this email.

Best regards,

The Custom Websites Plus Team
`;

    try {
        // Invoke the send-email Edge Function, passing markdown_body
        const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
            body: JSON.stringify({
                to_email: finalClientEmail,
                subject: subject,
                markdown_body: markdownBody,
                client_id: clientData.id,
                sent_by: newUserId, // Sent by the admin who created the user (or system user)
            }),
        });
        
        if (emailError || emailData.error) {
            console.error('[create-client-user] Failed to send welcome email:', emailError || emailData.error);
            // Log the error but DO NOT throw, allowing the client creation to succeed.
        } else {
            console.log('[create-client-user] Welcome email sent successfully.');
        }
    } catch (e) {
        console.error('[create-client-user] Error invoking send-email:', e);
        // Log the error but DO NOT throw.
    }


    return jsonResponse({ success: true, userId: newUserId });

  } catch (error: any) {
    console.error('[create-client-user] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});