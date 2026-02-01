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

function randomHex(bytes: number) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const token = getBearerToken(req);
  if (!token) return errorResponse("Unauthorized", 401);

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const clientId = (body?.client_id || "").toString().trim();
    if (!clientId) return errorResponse("Missing required field: client_id", 400);

    // Verify JWT + ensure the caller can access this client (client owner or admin)
    const {
      data: { user },
      error: authErr,
    } = await supabaseClient.auth.getUser();

    if (authErr || !user) {
      console.error("[rotate-lead-ingest-key] auth.getUser failed", { message: authErr?.message });
      return errorResponse("Unauthorized", 401);
    }

    const { data: client, error: clientErr } = await supabaseClient
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return errorResponse("Forbidden", 403);
    }

    const newKey = randomHex(32);

    const { data: updated, error: upErr } = await supabaseAdmin
      .from("client_lead_ingest_configs")
      .upsert({ client_id: clientId, ingest_key: newKey, enabled: true }, { onConflict: "client_id" })
      .select("client_id, ingest_key, enabled, allowed_origins, updated_at")
      .single();

    if (upErr) {
      console.error("[rotate-lead-ingest-key] upsert failed", { message: upErr.message });
      return errorResponse("Failed to rotate key", 500);
    }

    return jsonResponse({ success: true, config: updated });
  } catch (e: any) {
    console.error("[rotate-lead-ingest-key] Error", { message: e?.message });
    return errorResponse(e?.message || "Unexpected error", 500);
  }
});
