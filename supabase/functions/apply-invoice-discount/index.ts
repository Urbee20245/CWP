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

  // Initialize Supabase client with service role for secure DB access
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { invoice_id, discount_type, discount_value, applied_by } = await req.json();

    if (!invoice_id || !discount_type || discount_value === undefined || !applied_by) {
      return errorResponse('Missing required fields: invoice_id, discount_type, discount_value, or applied_by.', 400);
    }
    
    console.log(`[apply-invoice-discount] Applying ${discount_value} ${discount_type} discount to invoice ID: ${invoice_id}`);

    // 1. Fetch Invoice from Supabase to get Stripe ID
    const { data: dbInvoice, error: dbError } = await supabaseAdmin
        .from('invoices')
        .select('id, stripe_invoice_id, status, amount_due')
        .eq('id', invoice_id)
        .single();
        
    if (dbError || !dbInvoice) {
        return errorResponse('Invoice not found in database.', 404);
    }
    
    if (dbInvoice.status !== 'open' && dbInvoice.status !== 'past_due') {
        return errorResponse(`Cannot apply discount to invoice with status: ${dbInvoice.status}. Only 'open' or 'past_due' invoices can be modified.`, 400);
    }
    
    // 2. Create Stripe Coupon (Stripe requires a coupon object for discounts)
    let coupon: Stripe.Coupon;
    const couponId = `discount_${dbInvoice.stripe_invoice_id}_${Date.now()}`;

    if (discount_type === 'percentage') {
        if (discount_value < 1 || discount_value > 100) {
            return errorResponse('Percentage discount must be between 1 and 100.', 400);
        }
        coupon = await stripe.coupons.create({
            id: couponId,
            percent_off: discount_value,
            duration: 'once',
            name: `${discount_value}% Off Invoice ${dbInvoice.stripe_invoice_id.substring(0, 8)}`,
        });
    } else { // fixed amount (in cents)
        const fixedAmountCents = discount_value;
        if (fixedAmountCents < 100) {
            return errorResponse('Fixed amount discount must be at least $1.00.', 400);
        }
        coupon = await stripe.coupons.create({
            id: couponId,
            amount_off: fixedAmountCents,
            currency: 'usd',
            duration: 'once',
            name: `Fixed Discount $${(fixedAmountCents / 100).toFixed(2)}`,
        });
    }
    
    // 3. Apply Coupon to Invoice
    const updatedInvoice = await stripe.invoices.update(dbInvoice.stripe_invoice_id, {
        discounts: [{ coupon: coupon.id }],
    });
    
    // 4. Record Discount in Supabase
    const { error: discountInsertError } = await supabaseAdmin
        .from('invoice_discounts')
        .insert({
            invoice_id: dbInvoice.id,
            discount_type: discount_type,
            discount_value: discount_type === 'fixed' ? discount_value : discount_value,
            applied_by: applied_by,
        });
        
    if (discountInsertError) {
        console.error('[apply-invoice-discount] Failed to record discount:', discountInsertError);
        // Note: We proceed even if DB record fails, as Stripe has the discount applied.
    }

    // 5. Finalize and Send the updated invoice (to reflect discount immediately)
    // NOTE: Stripe automatically recalculates the amount due when the coupon is applied.
    const finalizedInvoice = await stripe.invoices.sendInvoice(updatedInvoice.id);
    
    // 6. Update local invoice record with new amount due
    await supabaseAdmin
        .from('invoices')
        .update({ amount_due: finalizedInvoice.amount_due })
        .eq('id', dbInvoice.id);

    return jsonResponse({ 
        success: true, 
        new_amount_due: finalizedInvoice.amount_due,
        coupon_id: coupon.id,
    });

  } catch (error: any) {
    console.error('[apply-invoice-discount] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});