import crypto from 'crypto';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

async function readRawBody(req: any): Promise<string> {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res: any, status: number, body: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return json(res, 500, { error: 'Missing STRIPE_SECRET_KEY' });
  }

  let payload: any = null;
  try {
    const raw = (await readRawBody(req)) || '{}';
    payload = JSON.parse(raw);
  } catch {
    return json(res, 400, { error: 'Invalid JSON' });
  }

  const businessName = String(payload?.business_name || payload?.businessName || '').slice(0, 200);
  const location = String(payload?.location || '').slice(0, 200);
  const liteScore = Number(payload?.lite_score ?? payload?.liteScore ?? 0) || 0;
  const competitorRadius = Number(payload?.competitor_radius ?? payload?.competitor_radius_meters ?? payload?.competitorRadius ?? 0) || 0;
  const origin = String(payload?.origin || '').replace(/\/+$/, '');

  if (!origin.startsWith('http')) {
    return json(res, 400, { error: 'Missing or invalid origin' });
  }

  // Price: $49 one-time (4900 cents)
  const unitAmount = 4900;

  // Stripe Checkout requires application/x-www-form-urlencoded
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${origin}/jetbiz/pro/{CHECKOUT_SESSION_ID}?analyzing=true`);
  params.set('cancel_url', `${origin}/jetbiz-lite?canceled=true`);
  params.set('billing_address_collection', 'auto');

  // Collect email in Checkout
  params.set('customer_creation', 'always');

  // Line item definition
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(unitAmount));
  params.set('line_items[0][price_data][product_data][name]', 'JetBiz Pro — Google Business Profile Optimizer');
  params.set('line_items[0][price_data][product_data][description]', 'Automated Places analysis + competitor benchmarking + PDF report');

  // Metadata to attach to the session
  params.set('metadata[business_name]', businessName);
  params.set('metadata[location]', location);
  params.set('metadata[lite_score]', String(Math.max(0, Math.min(100, Math.round(liteScore)))));
  params.set('metadata[competitor_radius]', String(Math.max(0, Math.round(competitorRadius))));

  // Idempotency: avoid duplicate sessions for rapid clicks.
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${businessName}|${location}|${liteScore}|${competitorRadius}|${origin}`)
    .digest('hex')
    .slice(0, 32);

  try {
    const resp = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body: params.toString(),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      return json(res, 400, {
        error: data?.error?.message || 'Failed to create checkout session',
        stripe: data?.error || null,
      });
    }

    return json(res, 200, {
      id: data.id,
      url: data.url,
    });
  } catch (err: any) {
    return json(res, 500, { error: err?.message || 'Server error' });
  }
}

