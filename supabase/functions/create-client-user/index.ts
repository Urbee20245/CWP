import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { email, password, fullName, businessName, phone, billingEmail } = await req.json();

    if (!email || !password || !fullName || !businessName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }), 
        { status: 400, headers: corsHeaders }
      );
    }
    
    console.log(`[create-client-user] Creating user: ${email}`);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'client' },
    });

    if (authError) {
      console.error('[create-client-user] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: `Auth failed: ${authError.message}` }), 
        { status: 400, headers: corsHeaders }
      );
    }
    
    const newUserId = authData.user.id;
    console.log(`[create-client-user] User created: ${newUserId}`);

    // FIXED: Removed access_status field
    const { error: clientError, data: clientData } = await supabaseAdmin
      .from('clients')
      .insert({
        owner_profile_id: newUserId,
        business_name: businessName,
        phone: phone || null,
        billing_email: billingEmail || email,
        status: 'active',
      })
      .select('id')
      .single();

    if (clientError) {
      console.error('[create-client-user] Client error:', clientError);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: `Client creation failed: ${clientError.message}` }), 
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`[create-client-user] Client created: ${clientData.id}`);

    await supabaseAdmin
      .from('profiles')
      .update({ role: 'client', full_name: fullName })
      .eq('id', newUserId);

    console.log('[create-client-user] Success');
    return new Response(
      JSON.stringify({ success: true, userId: newUserId }), 
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[create-client-user] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: corsHeaders }
    );
  }
});