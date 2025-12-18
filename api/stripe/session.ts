const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function json(res: any, status: number, body: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return json(res, 500, { error: 'Missing STRIPE_SECRET_KEY' });
  }

  const url = new URL(req.url, 'http://localhost');
  const sessionId = url.searchParams.get('session_id') || url.searchParams.get('id');
  if (!sessionId) {
    return json(res, 400, { error: 'Missing session_id' });
  }

  try {
    const resp = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      return json(res, 400, { error: data?.error?.message || 'Unable to fetch session' });
    }

    const metadata = data?.metadata || {};
    return json(res, 200, {
      id: data.id,
      payment_status: data.payment_status,
      customer_email: data.customer_details?.email || data.customer_email || null,
      metadata: {
        business_name: metadata.business_name || '',
        location: metadata.location || '',
        lite_score: metadata.lite_score || '',
        competitor_radius: metadata.competitor_radius || '',
      },
    });
  } catch (err: any) {
    return json(res, 500, { error: err?.message || 'Server error' });
  }
}

