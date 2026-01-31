export const config = {
  auth: false,
};

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

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Unauthorized');
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) throw new Error('Unauthorized');

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    console.error('[retell-get-agent] auth.getUser failed', { message: userErr?.message });
    throw new Error('Unauthorized');
  }

  const userId = userData.user.id;

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr) {
    console.error('[retell-get-agent] profile lookup failed', { message: profileErr.message });
    throw new Error('Unauthorized');
  }

  if (profile?.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  return supabaseAdmin;
}

async function fetchRetellAgent(agentId: string, apiKey: string) {
  const urls = [
    `https://api.retellai.com/get-agent/${encodeURIComponent(agentId)}`,
    `https://api.retellai.com/v2/get-agent/${encodeURIComponent(agentId)}`,
  ];

  let lastErr: string | null = null;

  for (const url of urls) {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (res.ok) {
      return json;
    }

    // If it's a plain 404 or similar, try the fallback URL.
    lastErr = json?.error?.message || json?.message || json?.detail || text || `HTTP ${res.status}`;

    // If unauthorized, don't bother trying the next URL.
    if (res.status === 401 || res.status === 403) {
      throw new Error('Retell API unauthorized (check RETELL_API_KEY)');
    }
  }

  throw new Error(lastErr || 'Failed to fetch agent from Retell');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAdmin(req);

    const RETELL_API_KEY = Deno.env.get('RETELL_API_KEY');
    if (!RETELL_API_KEY) {
      console.error('[retell-get-agent] Missing RETELL_API_KEY');
      return jsonRes({ error: 'RETELL_API_KEY is not configured in Supabase secrets.' }, 500);
    }

    const { agent_id } = await req.json();
    const agentId = typeof agent_id === 'string' ? agent_id.trim() : '';
    if (!agentId) return jsonRes({ error: 'Missing agent_id' }, 400);

    console.log('[retell-get-agent] Fetching agent from Retell', { agentId });

    const agent = await fetchRetellAgent(agentId, RETELL_API_KEY);

    return jsonRes({ success: true, agent });
  } catch (error: any) {
    const message = error?.message || 'Request failed';
    console.error('[retell-get-agent] Error', { message });
    const status = message === 'Unauthorized' ? 401 : 500;
    return jsonRes({ error: message }, status);
  }
});
