import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONTENT_TYPES: Record<string, string> = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.webp':  'image/webp',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.txt':   'text/plain',
  '.xml':   'application/xml',
  '.map':   'application/json',
};

function getContentType(path: string): string {
  const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

serve(async (req) => {
  try {
    const url = new URL(req.url);

    // Path comes in as query params: ?slug=gapbridgecs&path=/about
    const slug = url.searchParams.get('slug');
    const filePath = url.searchParams.get('path') || '/';

    if (!slug) {
      return new Response('Missing slug', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // SPA routing: non-asset paths → serve index.html
    const isAsset = /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|map|txt|xml)$/i.test(filePath);
    let storagePath: string;

    if (isAsset) {
      storagePath = `${slug}${filePath}`;
    } else {
      // All HTML routes → index.html (React Router handles the rest client-side)
      storagePath = `${slug}/index.html`;
    }

    // Download file from storage
    const { data, error } = await supabase.storage
      .from('static-sites')
      .download(storagePath);

    if (error || !data) {
      // Fallback to index.html for 404s (SPA catch-all)
      if (!isAsset) {
        const { data: fallback } = await supabase.storage
          .from('static-sites')
          .download(`${slug}/index.html`);

        if (fallback) {
          const html = await fallback.text();
          return new Response(html, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          });
        }
      }
      return new Response('Not found', { status: 404 });
    }

    const contentType = getContentType(storagePath);
    const isHtml = contentType.includes('text/html');
    const buffer = await data.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': isHtml
          ? 'no-cache, no-store, must-revalidate'
          : 'public, max-age=31536000, immutable',
        'X-Powered-By': 'CustomWebsitesPlus',
      },
    });
  } catch (err: any) {
    console.error('[serve-static-site]', err.message);
    return new Response('Server error', { status: 500 });
  }
});
