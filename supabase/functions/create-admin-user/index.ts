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
  console.error(`[create-admin-user] Error: ${message}`);
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
    const { email, password, fullName, adminRole } = await req.json();

    if (!email || !password || !fullName || !adminRole) {
      return errorResponse('Missing required fields.', 400);
    }
    
    console.log(`[create-admin-user] Attempting to create admin user: ${email} with role ${adminRole}`);

    // 1. Create Auth User (Role 'admin' is required for RLS policies)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'admin', // Base role for RLS
      },
    });

    if (authError) {
      console.error('[create-admin-user] Auth creation failed:', authError.message);
      return errorResponse(`Auth creation failed: ${authError.message}`, 400);
    }
    
    const newUserId = authData.user.id;
    console.log(`[create-admin-user] User created with ID: ${newUserId}`);

    // 2. Manually create/update Profile Record to set the granular admin_role
    const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .upsert({ 
            id: newUserId, 
            email: email,
            full_name: fullName, 
            role: 'admin', // Base role
            admin_role: adminRole, // Granular role
        });
        
    if (profileUpdateError) {
        console.error('[create-admin-user] Failed to update profile role/name:', profileUpdateError);
        // Clean up auth user if profile fails
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return errorResponse(`Failed to set profile role. User deleted. Error: ${profileUpdateError.message}`, 500);
    }

    return jsonResponse({ success: true, userId: newUserId });

  } catch (error: any) {
    console.error('[create-admin-user] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});