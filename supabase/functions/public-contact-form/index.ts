// public-contact-form — Public edge function for website contact form submissions.
// No JWT required. Verifies reCAPTCHA v3 server-side, then inserts a lead.
// Lookup is by client_slug (slug-based sites) OR custom_domain (custom domain sites).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const {
    site_slug,
    site_hostname,
    name,
    email,
    phone,
    message,
    recaptcha_token,
  } = body;

  // ── Validate required fields ──────────────────────────────────────────────
  if (!name?.trim()) {
    return new Response(JSON.stringify({ error: 'Name is required.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!email?.trim() && !phone?.trim()) {
    return new Response(JSON.stringify({ error: 'Email or phone is required.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!site_slug && !site_hostname) {
    return new Response(JSON.stringify({ error: 'Site identifier required.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Verify reCAPTCHA v3 (skip if secret not configured — dev mode) ────────
  const recaptchaSecret = Deno.env.get('RECAPTCHA_SECRET_KEY');
  if (recaptchaSecret && recaptcha_token) {
    try {
      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: recaptchaSecret,
          response: recaptcha_token,
        }).toString(),
      });
      const verifyData = await verifyRes.json();
      // Reject if reCAPTCHA says it's invalid or score is too low (bot-like)
      if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < 0.5)) {
        return new Response(JSON.stringify({ error: 'reCAPTCHA verification failed. Please try again.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.error('[public-contact-form] reCAPTCHA verify error:', err);
      // Don't block submission on network error — log and continue
    }
  }

  // ── Look up client using service role ─────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const briefQuery = supabase
    .from('website_briefs')
    .select('client_id')
    .eq('is_published', true);

  const { data: brief, error: briefErr } = site_slug
    ? await briefQuery.eq('client_slug', site_slug).maybeSingle()
    : await briefQuery.eq('custom_domain', site_hostname).maybeSingle();

  if (briefErr || !brief?.client_id) {
    return new Response(JSON.stringify({ error: 'Site not found.' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Check 50-lead active limit (exclude archived/resolved) ───────────────
  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', brief.client_id)
    .not('status', 'in', '("resolved","archived")');

  if ((count ?? 0) >= 50) {
    // Accept submission silently — don't expose limit details publicly
    console.warn('[public-contact-form] Lead limit reached for client', brief.client_id);
    return new Response(JSON.stringify({ success: true }), {
      status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Insert the lead ───────────────────────────────────────────────────────
  const page_url = req.headers.get('referer') ?? null;
  const user_agent = req.headers.get('user-agent') ?? null;

  const { error: insertErr } = await supabase.from('leads').insert({
    client_id: brief.client_id,
    name: name.trim(),
    email: email?.trim().toLowerCase() || null,
    phone: phone?.trim() || null,
    message: message?.trim() || null,
    source: 'website-contact-form',
    page_url,
    raw: { user_agent },
    status: 'new',
  });

  if (insertErr) {
    console.error('[public-contact-form] Insert error:', insertErr);
    return new Response(JSON.stringify({ error: 'Failed to save your message. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
