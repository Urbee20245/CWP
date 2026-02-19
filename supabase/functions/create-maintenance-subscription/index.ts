export const config = { auth: false };

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set.");

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { client_id, price_id, setup_fee_price_id } = await req.json();

    if (!client_id) return errorResponse("Client ID is required.", 400);
    if (!price_id) return errorResponse("Price ID is required.", 400);

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, business_name, billing_email, owner_profile_id, stripe_customer_id, profiles(email)")
      .eq("id", client_id)
      .single();

    if (clientError || !client) {
      console.error("[create-maintenance-subscription] Client lookup failed:", clientError?.message);
      return errorResponse("Client not found.", 404);
    }

    let stripeCustomerId: string | null = client.stripe_customer_id;
    const clientEmail = client.billing_email || client.profiles?.email;

    const ensureStripeCustomer = async () => {
      if (stripeCustomerId) return stripeCustomerId;
      if (!clientEmail) throw new Error("Client email is required to create Stripe customer.");

      const customer = await stripe.customers.create({
        email: clientEmail,
        name: client.business_name,
        metadata: {
          supabase_client_id: client.id,
          supabase_profile_id: client.owner_profile_id,
        },
      });

      const { error: updateError } = await supabaseAdmin
        .from("clients")
        .update({ stripe_customer_id: customer.id })
        .eq("id", client.id);

      if (updateError) {
        console.error(
          "[create-maintenance-subscription] Failed to update client with Stripe customer ID:",
          updateError,
        );
      }

      stripeCustomerId = customer.id;
      return stripeCustomerId;
    };

    const applyUnappliedDeposits = async (customerId: string, newInvoiceId: string) => {
      const { data: depositsToApply, error: depositFetchError } = await supabaseAdmin
        .from("deposits")
        .select("id, amount_cents")
        .eq("client_id", client_id)
        .eq("status", "paid")
        .is("applied_to_invoice_id", null)
        .order("created_at", { ascending: true });

      if (depositFetchError) {
        console.error(
          "[create-maintenance-subscription] Error fetching deposits to apply:",
          depositFetchError,
        );
        return;
      }

      if (depositsToApply && depositsToApply.length > 0) {
        for (const deposit of depositsToApply) {
          await stripe.invoiceItems.create({
            customer: customerId,
            unit_amount: -deposit.amount_cents,
            currency: "usd",
            description: `Deposit Credit Applied (ID: ${deposit.id})`,
            invoice: newInvoiceId,
          });

          await supabaseAdmin
            .from("deposits")
            .update({ status: "applied", applied_to_invoice_id: newInvoiceId })
            .eq("id", deposit.id);
        }
      }
    };

    const customerId = await ensureStripeCustomer();

    const items: Array<{ price: string }> = [{ price: price_id }];
    if (setup_fee_price_id) {
      items.push({ price: setup_fee_price_id });
      console.log(
        "[create-maintenance-subscription] Bundling setup fee price ID:",
        setup_fee_price_id,
      );
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items,
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });

    const latestInvoice = subscription.latest_invoice && typeof subscription.latest_invoice !== "string"
      ? subscription.latest_invoice
      : null;

    // Match existing behavior: apply unapplied deposits to the first invoice if present
    if (latestInvoice?.id) {
      await applyUnappliedDeposits(customerId, latestInvoice.id);
    }

    // Persist subscription + invoice immediately so the client portal can show the pay link
    const { error: subscriptionUpsertError } = await supabaseAdmin
      .from("subscriptions")
      .upsert({
        client_id: client.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: price_id,
        status: subscription.status,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
      }, { onConflict: "stripe_subscription_id" });

    if (subscriptionUpsertError) {
      console.error(
        "[create-maintenance-subscription] Subscription upsert failed:",
        subscriptionUpsertError,
      );
    }

    if (latestInvoice?.id) {
      const { error: invoiceUpsertError } = await supabaseAdmin
        .from("invoices")
        .upsert({
          client_id: client.id,
          stripe_invoice_id: latestInvoice.id,
          status: latestInvoice.status,
          hosted_invoice_url: latestInvoice.hosted_invoice_url,
          pdf_url: latestInvoice.invoice_pdf,
          amount_due: latestInvoice.amount_due,
          currency: latestInvoice.currency,
          due_date: latestInvoice.due_date
            ? new Date(latestInvoice.due_date * 1000).toISOString()
            : null,
        }, { onConflict: "stripe_invoice_id" });

      if (invoiceUpsertError) {
        console.error(
          "[create-maintenance-subscription] Invoice upsert failed:",
          invoiceUpsertError,
        );
      }
    }

    // Keep this field up to date when the subscription is fully active
    if (subscription.status === "active" || subscription.status === "trialing") {
      const { error: clientUpdateError } = await supabaseAdmin
        .from("clients")
        .update({ stripe_subscription_id: subscription.id })
        .eq("id", client.id);

      if (clientUpdateError) {
        console.error(
          "[create-maintenance-subscription] Failed to update client stripe_subscription_id:",
          clientUpdateError,
        );
      }
    }

    return jsonResponse({
      subscription_id: subscription.id,
      status: subscription.status,
      hosted_invoice_url: latestInvoice?.hosted_invoice_url ?? null,
    });
  } catch (e: any) {
    console.error("[create-maintenance-subscription] Handler failed:", e?.message || e);
    return errorResponse(e?.message || "Failed to create subscription.", 500);
  }
});
