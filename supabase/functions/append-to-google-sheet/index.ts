export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleCalendarService } from '../_shared/googleCalendarService.ts';

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

async function googleFetch(accessToken: string, url: string, init?: RequestInit) {
  const headers = {
    ...(init?.headers || {}),
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* non-json */
  }
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

    // Safety: use shared token manager.
    // - If refresh token is missing: marks needs_reauth and returns null.
    // - If access token expired: refreshes silently.
    const tokenData = await GoogleCalendarService.getAndRefreshTokens(client_id);
    if (!tokenData) {
      return errRes("Google account not connected (or needs re-auth).", 400);
    }

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
      tokenData.accessToken,
      sheet_id,
      sheet_range,
      [row]
    );

    if (!ok) {
      console.error("[append-to-google-sheet] Sheets append failed:", status, data || text);
      // If the token is invalid/expired, GoogleCalendarService will mark needs_reauth on next refresh attempt.
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