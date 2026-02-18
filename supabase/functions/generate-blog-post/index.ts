export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.34.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const GEMINI_API_KEY          = Deno.env.get('GEMINI_API_KEY');
const PEXELS_API_KEY          = Deno.env.get('PEXELS_API_KEY');   // fallback only
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set.');

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ─── helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function makeUniqueSlug(supabaseAdmin: any, clientId: string, base: string): Promise<string> {
  const slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const { data } = await supabaseAdmin
      .from('blog_posts').select('id')
      .eq('client_id', clientId).eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
    attempt++;
  }
}

/**
 * PRIMARY: Generate a featured image using Gemini Imagen 3.
 * Uploads the result to Supabase Storage and returns a public URL.
 */
async function generateImageWithGemini(
  supabaseAdmin: any,
  clientId: string,
  imagePrompt: string,
): Promise<{ url: string; alt: string } | null> {
  try {
    console.log(`[generate-blog-post] Generating image via Imagen 3: "${imagePrompt}"`);

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '16:9',
        outputMimeType: 'image/jpeg',
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      console.warn('[generate-blog-post] Imagen 3 returned no image bytes.');
      return null;
    }

    // Decode base64 → Uint8Array
    const binary = atob(imageBytes);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const fileName = `blog-${clientId}-${Date.now()}.jpg`;
    const storagePath = `blog-images/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('website-images')
      .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
      console.error('[generate-blog-post] Storage upload error:', uploadError.message);
      return null;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('website-images')
      .getPublicUrl(storagePath);

    console.log(`[generate-blog-post] Image uploaded: ${publicUrl}`);
    return { url: publicUrl, alt: imagePrompt };

  } catch (err: any) {
    console.error('[generate-blog-post] Imagen 3 error:', err.message);
    return null;
  }
}

/**
 * FALLBACK: Fetch a stock image from Pexels (requires PEXELS_API_KEY).
 */
async function fetchImageFromPexels(query: string): Promise<{ url: string; alt: string } | null> {
  if (!PEXELS_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photos: any[] = data?.photos || [];
    if (photos.length === 0) return null;
    const photo = photos[Math.floor(Math.random() * photos.length)];
    return {
      url: photo.src?.large2x || photo.src?.large || photo.src?.original,
      alt: photo.alt || query,
    };
  } catch {
    return null;
  }
}

// ─── main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const {
      client_id,
      topic,
      word_count    = 600,
      author_name,
      auto_publish  = false,
      generate_image = true,
      schedule_id,
    } = await req.json();

    if (!client_id) return errorResponse('Missing client_id.', 400);

    // Business context
    const { data: brief } = await supabaseAdmin
      .from('website_briefs')
      .select('business_name, industry, services_offered, location, tone')
      .eq('client_id', client_id)
      .maybeSingle();

    if (!brief) return errorResponse('No website brief found for this client.', 404);

    // Gate check
    const { data: client } = await supabaseAdmin
      .from('clients').select('blog_enabled, business_name')
      .eq('id', client_id).maybeSingle();

    if (!client?.blog_enabled) return errorResponse('Blog is not enabled for this client.', 403);

    const articleTopic = topic || `Tips for ${brief.industry} in ${brief.location}`;
    const targetWords  = Math.min(Math.max(word_count, 300), 2000);

    console.log(`[generate-blog-post] client_id=${client_id} topic="${articleTopic}"`);

    // ── Step 1: Generate article text with Gemini ──────────────────────────

    const systemInstruction = `You are an expert SEO content strategist and blog writer for local businesses.

OUTPUT FORMAT: Return ONLY a valid JSON object — no markdown fences, no preamble.

{
  "title": string,              // SEO H1 title (50-70 chars)
  "meta_title": string,         // <title> tag copy (50-60 chars, include location + primary keyword)
  "meta_description": string,   // meta description (150-160 chars, include CTA, location, keyword)
  "seo_keywords": string[],     // 6-8 targeted keywords (short + long-tail mix)
  "excerpt": string,            // 2-3 sentence listing teaser (max 200 chars)
  "category": string,           // one of: Tips | How-To | Guide | Industry News | Case Study
  "image_prompt": string,       // detailed Imagen AI prompt for a PROFESSIONAL blog header image (16:9 landscape, photorealistic, no text in image). Describe lighting, style, subject clearly. e.g. "A professional plumber in a blue uniform fixing copper pipes under a kitchen sink, natural window light, photorealistic"
  "content": string             // full article in clean semantic HTML (<h2>,<h3>,<p>,<ul>,<li>,<strong>)
}

WRITING RULES:
- ~${targetWords} words in the content field
- Mention the business location naturally in intro + conclusion (local SEO)
- Use the primary keyword in: H1 title, first paragraph, 2+ subheadings
- Tone: ${brief.tone}
- Structure: compelling intro → 3-5 sections with keyword-rich <h2> → conclusion with strong CTA
- CTA encourages readers to call or contact the local business
- Never mention competitor businesses
- Return ONLY the JSON object, nothing else`;

    const userPrompt = `Write an SEO-optimized blog article for:

Business: ${brief.business_name}
Industry: ${brief.industry}
Services: ${brief.services_offered}
Location: ${brief.location}
Tone: ${brief.tone}
Topic: ${articleTopic}`;

    const textResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.75,
        maxOutputTokens: 6000,
        responseMimeType: 'application/json',
      },
    });

    const rawText = textResponse.text?.trim() || '';
    let articleJson: any;
    try {
      articleJson = JSON.parse(rawText);
    } catch {
      console.error('[generate-blog-post] Failed to parse AI response:', rawText.slice(0, 200));
      return errorResponse('AI returned invalid JSON. Please try again.', 500);
    }

    if (!articleJson.title || !articleJson.content) {
      return errorResponse('AI response missing required fields.', 500);
    }

    // ── Step 2: Generate featured image ────────────────────────────────────

    let featuredImageUrl: string | null = null;
    let featuredImageAlt: string | null = null;

    if (generate_image) {
      // PRIMARY: Gemini Imagen 3 (AI-generated, on-brand)
      if (articleJson.image_prompt) {
        const geminiImg = await generateImageWithGemini(supabaseAdmin, client_id, articleJson.image_prompt);
        if (geminiImg) {
          featuredImageUrl = geminiImg.url;
          featuredImageAlt = geminiImg.alt;
        }
      }

      // FALLBACK: Pexels stock photo (only if Gemini failed)
      if (!featuredImageUrl && PEXELS_API_KEY) {
        const fallbackQuery = articleJson.image_prompt?.split(',')[0] || articleTopic;
        const pexelsImg = await fetchImageFromPexels(fallbackQuery);
        if (pexelsImg) {
          featuredImageUrl = pexelsImg.url;
          featuredImageAlt = pexelsImg.alt;
          console.log('[generate-blog-post] Fell back to Pexels for image.');
        }
      }
    }

    // ── Step 3: Save to DB ─────────────────────────────────────────────────

    const slug = await makeUniqueSlug(supabaseAdmin, client_id, articleJson.title);
    const publishedAt = auto_publish ? new Date().toISOString() : null;

    const { data: post, error: insertError } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        client_id,
        title:            articleJson.title,
        slug,
        excerpt:          articleJson.excerpt || '',
        content:          articleJson.content,
        category:         articleJson.category || 'Tips',
        author_name:      author_name || 'The Team',
        meta_title:       articleJson.meta_title || articleJson.title,
        meta_description: articleJson.meta_description || articleJson.excerpt || '',
        seo_keywords:     articleJson.seo_keywords || [],
        featured_image_url: featuredImageUrl,
        featured_image_alt: featuredImageAlt,
        is_published:     auto_publish,
        published_at:     publishedAt,
      })
      .select('id, title, slug, category, featured_image_url, meta_title')
      .single();

    if (insertError) {
      console.error('[generate-blog-post] Insert error:', insertError.message);
      return errorResponse('Failed to save blog post.', 500);
    }

    // Bump schedule counter if triggered from cron
    if (schedule_id) {
      const { data: schedRow } = await supabaseAdmin
        .from('blog_schedules').select('posts_generated').eq('id', schedule_id).maybeSingle();
      if (schedRow) {
        await supabaseAdmin
          .from('blog_schedules')
          .update({ posts_generated: (schedRow.posts_generated || 0) + 1, last_run_at: new Date().toISOString() })
          .eq('id', schedule_id);
      }
    }

    console.log(`[generate-blog-post] Created post id=${post.id} image=${!!featuredImageUrl} (gemini=${!!featuredImageUrl && !PEXELS_API_KEY || !!featuredImageUrl})`);
    return jsonResponse({ success: true, post });

  } catch (error: any) {
    console.error('[generate-blog-post] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
