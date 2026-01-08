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
    console.log(`[create-client-user] User created with ID: ${newUserId}`);

    // 2. Create Client Record (Requires Service Role Key)
    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .insert({
        owner_profile_id: newUserId,
        business_name: businessName,
        phone: phone || null,
        billing_email: billingEmail || email,
        status: 'active',
        access_status: 'active',
      });

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

    return jsonResponse({ success: true, userId: newUserId });

  } catch (error: any) {
    console.error('[create-client-user] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});