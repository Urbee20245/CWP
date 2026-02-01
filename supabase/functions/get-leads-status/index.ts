export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const token = getBearerToken(req);
    if (!token) return errorResponse("Unauthorized", 401);

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user || null;
    if (userErr || !user) return errorResponse("Unauthorized", 401);

    // Find client row by owner_profile_id
    const { data: client, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("owner_profile_id", user.id)
      .maybeSingle();

    if (clientErr || !client) return errorResponse("Client not found", 404);
    const clientId = client.id as string;

    // Lead counts
    const { count: activeCount, error: activeErr } = await supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .neq("status", "resolved")
      .neq("status", "archived");

    if (activeErr) return errorResponse("Failed to compute active count", 500);

    const { count: totalCount, error: totalErr } = await supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);

    if (totalErr) return errorResponse("Failed to compute total count", 500);

    // Last lead time
    const { data: lastLead } = await supabaseAdmin
      .from("leads")
      .select("created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Enabled flag (read-only)
    const { data: cfg } = await supabaseAdmin
      .from("client_lead_ingest_configs")
      .select("enabled")
      .eq("client_id", clientId)
      .maybeSingle();

    const enabled = cfg?.enabled === true;

    return jsonResponse({
      enabled,
      active_count: activeCount || 0,
      total_count: totalCount || 0,
      last_lead_at: lastLead?.created_at || null,
    });
  } catch (e: any) {
    return errorResponse(e?.message || "Unexpected error", 500);
  }
});