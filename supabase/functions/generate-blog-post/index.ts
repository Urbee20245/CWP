export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1.34.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
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

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { client_id, topic, word_count = 600, author_name } = await req.json();

    if (!client_id) return errorResponse('Missing client_id.', 400);

    // Fetch client brief to get business context
    const { data: brief } = await supabaseAdmin
      .from('website_briefs')
      .select('business_name, industry, services_offered, location, tone')
      .eq('client_id', client_id)
      .maybeSingle();

    if (!brief) return errorResponse('No website brief found for this client.', 404);

    // Check blog is enabled for this client
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('blog_enabled, business_name')
      .eq('id', client_id)
      .maybeSingle();

    if (!client?.blog_enabled) {
      return errorResponse('Blog is not enabled for this client.', 403);
    }

    const articleTopic = topic || `Tips for ${brief.industry} in ${brief.location}`;
    const targetWords = Math.min(Math.max(word_count, 300), 1500);

    console.log(`[generate-blog-post] Generating for client_id=${client_id} topic="${articleTopic}"`);

    const systemInstruction = `You are an expert content writer specializing in local business blogs.
Write SEO-optimized, engaging articles for local service businesses.

OUTPUT FORMAT: Return ONLY a valid JSON object — no markdown fences, no explanation.

{
  "title": string,           // compelling, SEO-friendly title (50-70 chars)
  "excerpt": string,         // 2-3 sentence teaser (max 200 chars)
  "category": string,        // single category label (e.g. "Tips", "How-To", "Industry News")
  "content": string          // full article in clean HTML (use <h2>, <h3>, <p>, <ul>, <li> tags)
}

WRITING RULES:
- Write approximately ${targetWords} words for the article content
- Include the business location naturally in the article (for local SEO)
- Reference their specific services where relevant
- Use the business's tone: ${brief.tone}
- Cite practical, actionable advice — not generic fluff
- Structure: intro → 3-4 main sections with h2 headings → conclusion with CTA
- CTA should encourage calling or contacting the business
- Do NOT mention competitor businesses by name
- Return ONLY the JSON object`;

    const userPrompt = `Write a blog article for this local business:

Business: ${brief.business_name}
Industry: ${brief.industry}
Services: ${brief.services_offered}
Location: ${brief.location}
Tone: ${brief.tone}

Article Topic: ${articleTopic}

Write an engaging, SEO-optimized article. The content should feel like it was written by an expert in this field.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.8,
        maxOutputTokens: 4096,
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

    const slug = await makeUniqueSlug(supabaseAdmin, client_id, articleJson.title);

    const { data: post, error: insertError } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        client_id,
        title: articleJson.title,
        slug,
        excerpt: articleJson.excerpt || '',
        content: articleJson.content,
        category: articleJson.category || 'Tips',
        author_name: author_name || 'The Team',
        is_published: false,
      })
      .select('id, title, slug, category')
      .single();

    if (insertError) {
      console.error('[generate-blog-post] Insert error:', insertError.message);
      return errorResponse('Failed to save blog post.', 500);
    }

    console.log(`[generate-blog-post] Created post id=${post.id} slug="${slug}"`);
    return jsonResponse({ success: true, post });

  } catch (error: any) {
    console.error('[generate-blog-post] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
