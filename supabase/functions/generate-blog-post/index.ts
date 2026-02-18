export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.34.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const GEMINI_API_KEY         = Deno.env.get('GEMINI_API_KEY');
const PEXELS_API_KEY         = Deno.env.get('PEXELS_API_KEY');   // optional
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set.');

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function makeUniqueSlug(supabaseAdmin: any, clientId: string, base: string): Promise<string> {
  let slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const { data } = await supabaseAdmin
      .from('blog_posts')
      .select('id')
      .eq('client_id', clientId)
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    attempt++;
  }
}

/** Fetch a featured image from Pexels (returns null if no API key or search fails) */
async function fetchFeaturedImage(query: string): Promise<{ url: string; alt: string } | null> {
  if (!PEXELS_API_KEY) return null;
  try {
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: PEXELS_API_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photos: any[] = data?.photos || [];
    if (photos.length === 0) return null;
    // Pick a random one from the top 5 to add variety
    const photo = photos[Math.floor(Math.random() * photos.length)];
    return {
      url: photo.src?.large2x || photo.src?.large || photo.src?.original,
      alt: photo.alt || query,
    };
  } catch {
    return null;
  }
}

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
      word_count = 600,
      author_name,
      auto_publish = false,
      generate_image = true,
      // Internal use: schedule runner passes these
      schedule_id,
    } = await req.json();

    if (!client_id) return errorResponse('Missing client_id.', 400);

    // Fetch client brief for business context
    const { data: brief } = await supabaseAdmin
      .from('website_briefs')
      .select('business_name, industry, services_offered, location, tone')
      .eq('client_id', client_id)
      .maybeSingle();

    if (!brief) return errorResponse('No website brief found for this client.', 404);

    // Check blog is enabled
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('blog_enabled, business_name')
      .eq('id', client_id)
      .maybeSingle();

    if (!client?.blog_enabled) {
      return errorResponse('Blog is not enabled for this client.', 403);
    }

    const articleTopic = topic || `Tips for ${brief.industry} in ${brief.location}`;
    const targetWords  = Math.min(Math.max(word_count, 300), 2000);

    console.log(`[generate-blog-post] Generating for client_id=${client_id} topic="${articleTopic}"`);

    const systemInstruction = `You are an expert SEO content strategist and blog writer specializing in local business content marketing.
Write SEO-optimized, engaging articles for local service businesses that rank on Google and convert readers into customers.

OUTPUT FORMAT: Return ONLY a valid JSON object — no markdown fences, no explanation.

{
  "title": string,              // compelling, SEO-friendly H1 title (50-70 chars)
  "meta_title": string,         // SEO meta title for <title> tag (50-60 chars, include location + keyword)
  "meta_description": string,   // SEO meta description (150-160 chars, include CTA, location, main keyword)
  "seo_keywords": string[],     // 6-8 targeted keywords/phrases (mix of short and long-tail)
  "excerpt": string,            // 2-3 sentence teaser for blog listing (max 200 chars)
  "category": string,           // single category label (e.g. "Tips", "How-To", "Industry News", "Guide")
  "image_search_query": string, // 3-5 word photo search query for stock image (e.g. "plumber fixing pipe")
  "content": string             // full article in semantic HTML (use <h2>, <h3>, <p>, <ul>, <li>, <strong> tags)
}

WRITING RULES:
- Write approximately ${targetWords} words for the article content
- Include the business location naturally in intro and conclusion (for local SEO)
- Use the primary keyword in the H1 title, first paragraph, and at least 2 subheadings
- Reference their specific services naturally throughout
- Use the business's tone: ${brief.tone}
- Structure: compelling intro (with primary keyword) → 3-5 main sections with keyword-rich h2 headings → conclusion with strong CTA
- CTA should encourage readers to call or contact the local business
- Include schema-friendly content (clear who, what, where, why)
- Do NOT mention competitor businesses by name
- Return ONLY the JSON object, nothing else`;

    const userPrompt = `Write an SEO-optimized blog article for this local business:

Business: ${brief.business_name}
Industry: ${brief.industry}
Services: ${brief.services_offered}
Location: ${brief.location}
Tone: ${brief.tone}

Article Topic: ${articleTopic}

Write an engaging, comprehensive article that will rank on Google and convert local readers into customers.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.75,
        maxOutputTokens: 6000,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text?.trim() || '';
    let articleJson: any;

    try {
      articleJson = JSON.parse(rawText);
    } catch {
      console.error('[generate-blog-post] Failed to parse AI response:', rawText.slice(0, 200));
      return errorResponse('AI returned invalid JSON. Please try again.', 500);
    }

    if (!articleJson.title || !articleJson.content) {
      return errorResponse('AI response was missing required fields.', 500);
    }

    // Optionally fetch a featured image from Pexels
    let featuredImageUrl: string | null = null;
    let featuredImageAlt: string | null = null;

    if (generate_image && articleJson.image_search_query) {
      const img = await fetchFeaturedImage(articleJson.image_search_query);
      if (img) {
        featuredImageUrl = img.url;
        featuredImageAlt = img.alt;
      }
    }

    const slug = await makeUniqueSlug(supabaseAdmin, client_id, articleJson.title);

    const publishedAt = auto_publish ? new Date().toISOString() : null;

    const { data: post, error: insertError } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        client_id,
        title:               articleJson.title,
        slug,
        excerpt:             articleJson.excerpt || '',
        content:             articleJson.content,
        category:            articleJson.category || 'Tips',
        author_name:         author_name || 'The Team',
        meta_title:          articleJson.meta_title || articleJson.title,
        meta_description:    articleJson.meta_description || articleJson.excerpt || '',
        seo_keywords:        articleJson.seo_keywords || [],
        featured_image_url:  featuredImageUrl,
        featured_image_alt:  featuredImageAlt,
        is_published:        auto_publish,
        published_at:        publishedAt,
      })
      .select('id, title, slug, category, featured_image_url, meta_title')
      .single();

    if (insertError) {
      console.error('[generate-blog-post] Insert error:', insertError.message);
      return errorResponse('Failed to save blog post.', 500);
    }

    // If this was triggered from a schedule, bump the counter
    if (schedule_id) {
      await supabaseAdmin.rpc('increment_schedule_post_count', { p_schedule_id: schedule_id });
    }

    console.log(`[generate-blog-post] Created post id=${post.id} slug="${slug}" image=${!!featuredImageUrl}`);
    return jsonResponse({ success: true, post });

  } catch (error: any) {
    console.error('[generate-blog-post] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
