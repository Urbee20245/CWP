import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set.');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client for RLS checks (public client)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );
  
  // Initialize Supabase Admin client for privileged updates
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { subscription_id } = await req.json();

    if (!subscription_id) {
      return errorResponse('Subscription ID is required.', 400);
    }
    
    // 1. Verify user identity and get client_id (using RLS/Auth context)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return errorResponse('Unauthorized: User not authenticated.', 401);
    }
    
    // Use RLS to ensure the user owns the client record
    const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, stripe_subscription_id')
        .eq('owner_profile_id', user.id)
        .single();
        
    if (clientError || !clientData) {
        return errorResponse('Client record not found or unauthorized.', 404);
    }
    
    const clientId = clientData.id;

    // 2. Verify the subscription belongs to this client (using Admin client for security/consistency)
    const { data: subData, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('id, client_id')
        .eq('id', subscription_id)
        .eq('client_id', clientId)
        .single();
        
    if (subError || !subData) {
        return errorResponse('Subscription not found or does not belong to this client.', 403);
    }

    console.log(`[cancel-subscription] Canceling Stripe subscription ${subscription_id} for client ${clientId}`);

    // 3. Call Stripe API to cancel at period end (Non-negotiable rule)
    const canceledSubscription = await stripe.subscriptions.update(subscription_id, {
      cancel_at_period_end: true,
    });

    // Determine cancellation effective date (end of current period)
    const cancellationEffectiveDate = canceledSubscription.current_period_end 
        ? new Date(canceledSubscription.current_period_end * 1000).toISOString() 
        : new Date().toISOString();

    // 4. Update client service status to 'paused' and log cancellation details (using Admin client)
    // This ensures the client portal shows the "Service Paused" banner immediately.
    const { error: clientUpdateError } = await supabaseAdmin
        .from('clients')
        .update({ 
            service_status: 'paused',
            cancellation_reason: 'client_requested',
            cancellation_effective_date: cancellationEffectiveDate,
        })
        .eq('id', clientId);
        
    if (clientUpdateError) {
        console.error('[cancel-subscription] Failed to update client service status:', clientUpdateError);
    }
    
    // 5. Send notification to admin (mocked)
    // In a real app, trigger an email/slack notification to the admin team here.
    
    return jsonResponse({ 
      success: true, 
      subscription_status: canceledSubscription.status,
      cancel_at_period_end: canceledSubscription.cancel_at_period_end,
      cancellation_effective_date: cancellationEffectiveDate,
    });

  } catch (error: any) {
    console.error('[cancel-subscription] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});