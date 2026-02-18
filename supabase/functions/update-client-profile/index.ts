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
  console.error(`[update-client-profile] Error: ${message}`);
  return jsonResponse({ error: message }, status);
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Verify the caller is an authenticated admin using their JWT
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );
  const { data: { user }, error: authError } = await callerClient.auth.getUser();
  if (authError || !user) {
    return errorResponse('Unauthorized', 401);
  }

  // Service-role client to bypass RLS
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Confirm caller is an admin
  const { data: callerProfile, error: profileLookupError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileLookupError || callerProfile?.role !== 'admin') {
    return errorResponse('Forbidden: admin role required', 403);
  }

  try {
    const { profile_id, full_name, role } = await req.json();

    if (!profile_id || !full_name) {
      return errorResponse('Missing required fields: profile_id, full_name', 400);
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ full_name, role })
      .eq('id', profile_id);

    if (updateError) {
      return errorResponse(`Profile update failed: ${updateError.message}`);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err.message);
  }
});
