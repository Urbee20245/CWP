export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function jsonRes(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function errRes(message: string, status = 500) {
  console.error(`[append-to-google-sheet] Error: ${message}`);
  return jsonRes({ error: message }, status);
}

async function decryptSecret(supabaseAdmin: any, ciphertext: string): Promise<string> {
  const key = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!key) throw new Error("SMTP_ENCRYPTION_KEY is not configured.");
  const { data, error } = await supabaseAdmin.rpc("decrypt_secret", { ciphertext, key });
  if (error) {
    console.error("[append-to-google-sheet] Decryption failed:", error);
    throw new Error("Failed to decrypt credentials.");
  }
  return data as string;
}

async function googleFetch(accessToken: string, url: string, init?: RequestInit) {
  const headers = {
    ...(init?.headers || {}),
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* non-json */ }
  return { ok: res.ok, status: res.status, data, text };
}

// Sheets append API helper
async function appendRowToSheet(accessToken: string, sheetId: string, range: string, values: any[][]) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  return googleFetch(accessToken, url, {
    method: "POST",
    body: JSON.stringify({ values }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const {
      client_id,
      sheet_id,
      sheet_range = "Sheet1!A1", // default range, will auto-append
      caller_name,
      caller_phone,
      caller_email,
      notes,
      source = "retell", // optional metadata
    } = body || {};

    if (!client_id) return errRes("Missing required field: client_id", 400);
    if (!sheet_id) return errRes("Missing required field: sheet_id", 400);

    // Load Google tokens for this client (calendar connection holds the tokens)
    const { data: gc, error: gcErr } = await supabaseAdmin
      .from("client_google_calendar")
      .select("google_access_token, google_refresh_token")
      .eq("client_id", client_id)
      .maybeSingle();

    if (gcErr || !gc) {
      console.error("[append-to-google-sheet] Google token lookup failed:", gcErr);
      return errRes("Google account not connected for this client.", 400);
    }

    const accessToken = await decryptSecret(supabaseAdmin, gc.google_access_token);
    // Optional: If access tokens can expire, this is where a refresh flow would occur using refresh_token.
    // For simplicity, we assume accessToken is valid or refreshed by your existing Google flow.

    // Prepare row
    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      caller_name || "",
      caller_phone || "",
      caller_email || "",
      notes || "",
      source || "retell",
    ];

    const { ok, status, data, text } = await appendRowToSheet(
      accessToken,
      sheet_id,
      sheet_range,
      [row]
    );

    if (!ok) {
      console.error("[append-to-google-sheet] Sheets append failed:", status, data || text);
      return errRes(`Google Sheets API error (${status})`, 400);
    }

    return jsonRes({
      success: true,
      appended: row.length,
      range: sheet_range,
      sheet_id,
    });
  } catch (e: any) {
    console.error("[append-to-google-sheet] Crash:", e.message, e.stack);
    return errRes(e.message, 500);
  }
});