export const config = { auth: false };

// ─── Undo Website Edit Edge Function ─────────────────────────────────────────
// Restores website_json from website_json_previous (saved before each ai-command).
// Called by the "Undo Last Edit" button in AdminWebsiteBuilder.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Auth: require a valid user JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errorResponse("Missing authorization header.", 401);

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return errorResponse("Unauthorized.", 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  try {
    const { client_id } = await req.json();

    if (!client_id) {
      return errorResponse("Missing required field: client_id.", 400);
    }

    // Verify the requesting user owns this client
    const { data: clientRow } = await supabaseAdmin
      .from("clients")
      .select("id, owner_profile_id")
      .eq("id", client_id)
      .single();

    if (!clientRow || clientRow.owner_profile_id !== user.id) {
      return errorResponse("Access denied.", 403);
    }

    // Fetch the current and previous JSON
    const { data: brief, error: briefError } = await supabaseAdmin
      .from("website_briefs")
      .select("website_json, website_json_previous")
      .eq("client_id", client_id)
      .single();

    if (briefError || !brief) {
      return errorResponse("Website not found.", 404);
    }

    if (!brief.website_json_previous) {
      return jsonResponse({ error: "Nothing to undo. No previous version saved." });
    }

    // Swap: restore previous as current, clear previous
    const { error: saveError } = await supabaseAdmin
      .from("website_briefs")
      .update({
        website_json: brief.website_json_previous,
        website_json_previous: null,
      })
      .eq("client_id", client_id);

    if (saveError) {
      console.error("[undo-website-edit] Save error:", saveError.message);
      return errorResponse("Failed to restore previous version.", 500);
    }

    console.log(`[undo-website-edit] Restored previous version for client=${client_id}`);
    return jsonResponse({ success: true, restored_json: brief.website_json_previous });

  } catch (error: any) {
    console.error("[undo-website-edit] Unhandled error:", error.message);
    return errorResponse(error.message || "Internal server error.", 500);
  }
});
