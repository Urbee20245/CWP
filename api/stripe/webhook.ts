import crypto from 'crypto';

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

function timingSafeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  // Stripe-Signature: t=timestamp,v1=signature,...
  const parts = signatureHeader.split(',').map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!tPart || !v1Part) return false;

  const timestamp = tPart.slice(2);
  const signature = v1Part.slice(3);
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return timingSafeEqual(expected, signature);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return json(res, 500, { error: 'Missing STRIPE_WEBHOOK_SECRET' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return json(res, 400, { error: 'Missing stripe-signature header' });
  }

  const raw = await readRawBody(req);
  const ok = verifyStripeSignature(raw, String(sig), secret);
  if (!ok) {
    return json(res, 400, { error: 'Invalid signature' });
  }

  // At this stage we can trust the payload authenticity.
  let event: any = null;
  try {
    event = JSON.parse(raw);
  } catch {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }

  // Minimal handler (additive): accept checkout.session.completed and acknowledge.
  // You can later persist `event.data.object.metadata` to a DB if needed.
  const type = event?.type;
  if (type === 'checkout.session.completed') {
    // noop — acknowledged
  }

  return json(res, 200, { received: true });
}

