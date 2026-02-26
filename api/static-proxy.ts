import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hostname = req.headers.host || '';
  const filePath = req.url || '/';

  // 1. Look up client by custom domain
  const briefRes = await fetch(
    `${SUPABASE_URL}/rest/v1/website_briefs?custom_domain=eq.${encodeURIComponent(hostname)}&site_type=eq.static&select=client_slug,static_dist_path,is_published`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  const briefs = await briefRes.json();
  const brief = briefs?.[0];

  if (!brief || !brief.is_published) {
    res.status(404).send('Site not found or not published');
    return;
  }

  // 2. Proxy to serve-static-site edge function
  const edgeUrl = `${SUPABASE_URL}/functions/v1/serve-static-site?slug=${encodeURIComponent(brief.client_slug)}&path=${encodeURIComponent(filePath)}`;

  const fileRes = await fetch(edgeUrl, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });

  if (!fileRes.ok) {
    res.status(fileRes.status).send('Not found');
    return;
  }

  const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
  const cacheControl = fileRes.headers.get('cache-control') || 'no-cache';
  const buffer = await fileRes.arrayBuffer();

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Powered-By', 'CustomWebsitesPlus');
  res.status(200).send(Buffer.from(buffer));
}
