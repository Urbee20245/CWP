export const config = {
  verify_jwt: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
}

function jsonResponse(body: any, status: number = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function errorResponse(message: string, status: number = 500) {
  console.error(`[admin-impersonate] Error: ${message}`);
  return jsonResponse({ error: message }, status);
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Guard: ensure required env vars are present before doing anything else
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[admin-impersonate] Missing env vars:', { supabaseUrl: !!supabaseUrl, serviceRoleKey: !!serviceRoleKey });
    return errorResponse('Server misconfiguration: missing Supabase credentials.', 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Verify caller is an admin via their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header.', 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return errorResponse('Empty token in authorization header.', 401);
    }

    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token);

    if (callerError || !callerUser) {
      console.error('[admin-impersonate] getUser error:', callerError?.message);
      return errorResponse(`Unauthorized: ${callerError?.message || 'invalid token'}.`, 401);
    }

    // Look up caller's profile to confirm admin role
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', callerUser.id)
      .single();

    if (profileError || !callerProfile) {
      return errorResponse('Unauthorized: profile not found.', 401);
    }

    if (callerProfile.role !== 'admin') {
      return errorResponse('Forbidden: admin role required.', 403);
    }

    // 2. Parse request body
    const { client_email, admin_name } = await req.json();

    if (!client_email) {
      return errorResponse('Missing required field: client_email.', 400);
    }

    // 3. Build redirect URL — include flag so the client portal shows the impersonation banner
    const baseUrl = Deno.env.get('PUBLIC_BASE_URL') || 'https://customwebsitesplus.com';
    const encodedAdmin = encodeURIComponent(admin_name || callerProfile.full_name || 'Admin');
    const redirectTo = `${baseUrl}/client/dashboard?admin_view=true&admin_name=${encodedAdmin}`;

    // 4. Generate a one-time magic link for the client using the service role
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: client_email,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[admin-impersonate] generateLink error:', linkError);
      return errorResponse(
        `Failed to generate access link for ${client_email}: ${linkError?.message || 'no action_link returned'}`,
        500
      );
    }

    console.log(`[admin-impersonate] Admin ${callerUser.id} generated impersonation link for ${client_email}`);

    return jsonResponse({ action_link: linkData.properties.action_link });

  } catch (error: any) {
    console.error('[admin-impersonate] Unhandled error:', error.message);
    return errorResponse(`Unexpected error: ${error.message}`, 500);
  }
});