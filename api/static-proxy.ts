import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CWP_DOMAIN = 'customwebsitesplus.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hostname = (req.headers.host || '').replace(/^www\./, '');
  const filePath = req.url || '/';

  // Only handle non-CWP domains
  if (hostname === CWP_DOMAIN || hostname === `www.${CWP_DOMAIN}`) {
    res.status(404).send('Not a static site domain');
    return;
  }

  // Allow back-office and login routes to fall through to the CWP React app
  if (filePath.startsWith('/back-office') || filePath.startsWith('/login')) {
    res.status(404).send('Use CWP app for back-office');
    return;
  }

  try {
    // Look up client by custom domain (bare hostname, no protocol)
    const briefRes = await fetch(
      `${SUPABASE_URL}/rest/v1/website_briefs?custom_domain=eq.${hostname}&site_type=eq.static&select=client_slug,static_dist_path,is_published&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    const briefs = await briefRes.json();
    let brief = briefs?.[0];

    if (!brief) {
      // Also try with https:// prefix since some records may store it that way
      const briefRes2 = await fetch(
        `${SUPABASE_URL}/rest/v1/website_briefs?custom_domain=eq.https%3A%2F%2F${hostname}%2F&site_type=eq.static&select=client_slug,static_dist_path,is_published&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      const briefs2 = await briefRes2.json();
      brief = briefs2?.[0];
    }

    if (!brief) {
      res.status(404).send('Site not found');
      return;
    }

    if (!brief.is_published) {
      res.status(503).send('Site not published yet');
      return;
    }

    // Proxy to serve-static-site edge function
    const distPath = brief.static_dist_path || brief.client_slug;
    const edgeUrl = `${SUPABASE_URL}/functions/v1/serve-static-site?slug=${distPath}&path=${encodeURIComponent(filePath)}`;

    const fileRes = await fetch(edgeUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!fileRes.ok) {
      // For 404s on HTML routes, try serving index.html (SPA fallback)
      const fallbackRes = await fetch(
        `${SUPABASE_URL}/functions/v1/serve-static-site?slug=${distPath}&path=${encodeURIComponent('/')}`,
        { headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      if (fallbackRes.ok) {
        const html = await fallbackRes.text();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).send(html);
        return;
      }
      res.status(404).send('Not found');
      return;
    }

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const cacheControl = fileRes.headers.get('cache-control') || 'no-cache';
    const buffer = Buffer.from(await fileRes.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('X-Powered-By', 'CustomWebsitesPlus');
    res.status(200).send(buffer);
  } catch (err: any) {
    console.error('[static-proxy]', err.message);
    res.status(500).send('Server error');
  }
}
