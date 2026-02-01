export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";

type LeadPayload = {
  client_id?: string;
  ingest_key?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source?: string;
  page_url?: string;
  referrer?: string;
  raw?: unknown;
};

function safeTrim(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function normalizeEmail(v: unknown): string | null {
  const t = safeTrim(v, 320);
  if (!t) return null;
  const email = t.toLowerCase();
  const ok = /^\S+@\S+\.\S+$/.test(email);
  return ok ? email : null;
}

function normalizePhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;

  const sanitized = trimmed.replace(/[^0-9+()\-\s.]/g, "").trim();
  // Basic sanity: keep 7-20 digits total
  const digitCount = (sanitized.match(/[0-9]/g) || []).length;
  if (digitCount < 7 || digitCount > 20) return null;
  return sanitized.slice(0, 40);
}

function getIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for") || "";
  if (xff) return xff.split(",")[0].trim().slice(0, 100);
  return (req.headers.get("x-real-ip") || "").trim().slice(0, 100) || null;
}

async function readBody(req: Request): Promise<LeadPayload> {
  const contentType = req.headers.get("content-type") || "";

  // JSON
  if (contentType.toLowerCase().includes("application/json")) {
    const json = await req.json();
    return (json || {}) as LeadPayload;
  }

  // FormData (application/x-www-form-urlencoded or multipart/form-data)
  if (
    contentType.toLowerCase().includes("application/x-www-form-urlencoded") ||
    contentType.toLowerCase().includes("multipart/form-data")
  ) {
    const fd = await req.formData();
    const obj: any = {};
    for (const [key, value] of fd.entries()) {
      if (typeof value === "string") obj[key] = value;
    }
    return obj as LeadPayload;
  }

  // Fallback attempt
  try {
    const json = await req.json();
    return (json || {}) as LeadPayload;
  } catch {
    return {};
  }
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await readBody(req);

    const clientId = safeTrim(body.client_id, 64);
    const ingestKey = safeTrim(body.ingest_key || req.headers.get("x-leads-key"), 256);

    if (!clientId || !ingestKey) {
      return errorResponse("Missing required fields: client_id, ingest_key", 400);
    }

    const { data: cfg, error: cfgErr } = await supabaseAdmin
      .from("client_lead_ingest_configs")
      .select("client_id, ingest_key, enabled, allowed_origins")
      .eq("client_id", clientId)
      .maybeSingle();

    if (cfgErr) {
      console.error("[ingest-lead] config lookup failed", { message: cfgErr.message });
      return errorResponse("Invalid client configuration", 400);
    }

    if (!cfg || cfg.enabled !== true) {
      return errorResponse("Lead ingestion is disabled for this client", 403);
    }

    if (cfg.ingest_key !== ingestKey) {
      return errorResponse("Unauthorized", 401);
    }

    // Optional origin allow-list
    const allowedOrigins = (cfg as any).allowed_origins as string[] | null;
    if (Array.isArray(allowedOrigins) && allowedOrigins.length > 0) {
      const origin = (req.headers.get("origin") || "").trim();
      if (!origin) return errorResponse("Forbidden", 403);
      if (!allowedOrigins.includes(origin)) return errorResponse("Forbidden", 403);
    }

    // HARD LIMIT: 50 active leads (status not resolved/archived)
    const { count: activeCount, error: countErr } = await supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .neq("status", "resolved")
      .neq("status", "archived");

    if (countErr) {
      console.error("[ingest-lead] active lead count failed", { message: countErr.message });
      return errorResponse("Unable to accept lead right now", 503);
    }

    if ((activeCount || 0) >= 50) {
      return errorResponse(
        "Lead limit reached (50 active leads). Resolve or archive existing leads to accept new ones.",
        429
      );
    }

    // Validate lead fields
    const name = safeTrim(body.name, 200);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const message = safeTrim(body.message, 5000);
    const source = safeTrim(body.source, 200) || "website";
    const pageUrl = safeTrim(body.page_url, 2000);
    const referrer = safeTrim(body.referrer, 2000);

    // Minimum viable lead: name + (email or phone)
    if (!name || (!email && !phone)) {
      return errorResponse("Invalid lead: name and (email or phone) are required", 400);
    }

    const userAgent = safeTrim(req.headers.get("user-agent"), 500);
    const ipAddress = getIp(req);

    const raw =
      body.raw && typeof body.raw === "object" && body.raw !== null
        ? body.raw
        : {
            received: body,
          };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("leads")
      .insert({
        client_id: clientId,
        name,
        email,
        phone,
        message,
        source,
        page_url: pageUrl,
        referrer,
        raw,
        user_agent: userAgent,
        ip_address: ipAddress,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[ingest-lead] lead insert failed", { message: insertErr.message });
      return errorResponse("Failed to save lead", 500);
    }

    // Optional: enqueue an event for downstream automation (AI call, CRM push, etc.)
    const { error: eventErr } = await supabaseAdmin.from("webhook_events").insert({
      client_id: clientId,
      event_source: "leads-api",
      event_type: "lead.submitted",
      external_id: inserted.id,
      request_payload: {
        lead_id: inserted.id,
        source,
        page_url: pageUrl,
      },
      response_payload: {},
      status: "received",
    });

    if (eventErr) {
      console.error("[ingest-lead] webhook_events insert failed", { message: eventErr.message });
      // non-fatal
    }

    return jsonResponse({ success: true, lead_id: inserted.id }, 201);
  } catch (e: any) {
    console.error("[ingest-lead] Error", { message: e?.message });
    return errorResponse(e?.message || "Unexpected error", 500);
  }
});