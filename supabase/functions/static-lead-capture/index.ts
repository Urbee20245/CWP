import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const {
      client_slug,
      firstName,
      lastName,
      email,
      phone,
      topic,
      timeline,
      priorityScore,
      futureDate,
      message,
      source,
      page_url,
    } = body;

    if (!client_slug) {
      return new Response(JSON.stringify({ error: 'client_slug required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up client_id from slug
    const { data: brief } = await supabase
      .from('website_briefs')
      .select('client_id, business_name')
      .eq('client_slug', client_slug)
      .maybeSingle();

    if (!brief) {
      return new Response(JSON.stringify({ error: 'Site not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save to static_site_leads
    const { error } = await supabase
      .from('static_site_leads')
      .insert({
        client_id: brief.client_id,
        client_slug,
        first_name: firstName || '',
        last_name: lastName || '',
        email: email || '',
        phone: phone || '',
        topic: topic || '',
        timeline: timeline || '',
        priority_score: priorityScore || null,
        future_date: futureDate || '',
        message: message || '',
        source: source || 'static-site',
        page_url: page_url || '',
      });

    if (error) throw error;

    // Also try to save to client_leads table (CWP standard leads) — non-fatal
    await supabase.from('client_leads').insert({
      client_id: brief.client_id,
      name: `${firstName || ''} ${lastName || ''}`.trim(),
      email: email || '',
      phone: phone || '',
      message: `Topic: ${topic || ''}\nTimeline: ${timeline || ''}\nMessage: ${message || ''}`,
      source: 'static-site-form',
      status: 'new',
    }).then(() => {}).catch(() => {});

    console.log(`[static-lead-capture] Lead saved for ${client_slug}: ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[static-lead-capture] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
