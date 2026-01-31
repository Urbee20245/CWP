// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// IMPORTANT: This function runs in the background (cron / admin trigger)
// It MUST be public (no JWT), because it is not user-facing.
export const config = { auth: false }

Deno.serve(async (_req) => {
  try {
    // Create Supabase client with SERVICE ROLE (bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Fetch all clients that should have voice metrics
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id")

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`)
    }

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No clients found to refresh",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    let refreshedCount = 0

    // IMPORTANT: Sequential loop (quota-safe)
    for (const client of clients) {
      const clientId = client.id

      // ------------------------------------------------------------------
      // PLACEHOLDER FOR GOOGLE / BIGQUERY LOGIC
      // Replace this object with your real Google-derived metrics later
      // ------------------------------------------------------------------
      const googleMetrics = {
        calls_last_30_days: Math.floor(Math.random() * 100),
        minutes_used: Math.floor(Math.random() * 500),
        source: "google",
      }

      // Upsert cached metrics into Supabase
      const { error: upsertError } = await supabase
        .from("voice_client_metrics")
        .upsert({
          client_id: clientId,
          metrics: googleMetrics,
          last_refreshed_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.error(
          `Failed to upsert metrics for client ${clientId}:`,
          upsertError
        )
        continue
      }

      refreshedCount++
    }

    return new Response(
      JSON.stringify({
        ok: true,
        refreshed_clients: refreshedCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("refresh-voice-metrics error:", err)

    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

/*
  HOW THIS FUNCTION IS MEANT TO BE USED:

  - This function is NEVER called from React or page load
  - It is triggered by:
      • Supabase Cron
      • An admin-only button
      • A manual HTTP call

  - It runs Google / BigQuery logic SAFELY in the background
  - Results are cached in `voice_client_metrics`
  - UI reads ONLY from Supabase (fast + quota-safe)
*/
