import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Embedded utility functions
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
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function errorResponse(message: string, status: number = 500) {
  console.error(`[delete-admin-user] Error: ${message}`);
  return jsonResponse({ error: message }, status);
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role key for admin operations
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { userId } = await req.json();

    if (!userId) {
      return errorResponse('Missing required field: userId.', 400);
    }
    
    console.log(`[delete-admin-user] Attempting to delete admin user ID: ${userId}`);

    // 1. Delete Auth User (This should cascade delete the profile record)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('[delete-admin-user] Auth user deletion failed:', authError.message);
      return errorResponse(`Auth user deletion failed: ${authError.message}`, 500);
    }
    
    console.log(`[delete-admin-user] Admin user successfully deleted.`);

    return jsonResponse({ success: true });

  } catch (error: any) {
    console.error('[delete-admin-user] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});