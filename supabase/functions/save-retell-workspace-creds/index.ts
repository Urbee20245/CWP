export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonRes({ error: 'Missing Authorization header' }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return jsonRes({ error: 'Unauthorized' }, 401);

    // Admin-only endpoint
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return jsonRes({ error: 'Forbidden: admin access required' }, 403);
    }

    const { client_id, workspace_id, api_key } = await req.json();

    if (!client_id) return jsonRes({ error: 'Missing required field: client_id' }, 400);
    if (!workspace_id && !api_key) {
      return jsonRes({ error: 'Provide at least workspace_id or api_key to save' }, 400);
    }

    const payload: any = { client_id };
    if (workspace_id !== undefined) payload.retell_workspace_id = workspace_id.trim();
    if (api_key !== undefined) payload.retell_workspace_api_key = api_key.trim();

    const { error: upsertError } = await supabaseAdmin
      .from('client_voice_integrations')
      .upsert(payload, { onConflict: 'client_id' });

    if (upsertError) {
      console.error('[save-retell-workspace-creds] DB upsert failed:', upsertError);
      return jsonRes({ error: `Database update failed: ${upsertError.message}` }, 500);
    }

    console.log(`[save-retell-workspace-creds] Workspace creds saved for client ${client_id}`);

    return jsonRes({ success: true });

  } catch (error: any) {
    console.error('[save-retell-workspace-creds] Unhandled error:', error.message);
    return jsonRes({ error: error.message }, 500);
  }
});
