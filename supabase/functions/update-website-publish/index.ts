export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  try {
    const { client_id, is_published } = await req.json();

    if (!client_id || typeof is_published !== 'boolean') {
      return errorResponse('Missing client_id or is_published.', 400);
    }

    console.log(`[update-website-publish] client_id=${client_id} is_published=${is_published}`);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabaseAdmin
      .from('website_briefs')
      .update({ is_published })
      .eq('client_id', client_id);

    if (error) {
      console.error('[update-website-publish] DB error:', error.message);
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ success: true, is_published });

  } catch (error: any) {
    console.error('[update-website-publish] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
