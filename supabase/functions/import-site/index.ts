export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { unzipSync, strFromU8 } from 'https://esm.sh/fflate@0.8.2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set.');
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Slug helpers ─────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function makeUniqueSlug(
  supabaseAdmin: any,
  base: string,
  excludeClientId?: string,
): Promise<string> {
  let slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const { data } = await supabaseAdmin
      .from('website_briefs')
      .select('id, client_id')
      .eq('client_slug', candidate);
    const conflict = (data || []).find((r: any) => r.client_id !== excludeClientId);
    if (!conflict) return candidate;
    attempt++;
  }
}

// ─── HTML extraction helpers ──────────────────────────────────────────────────

interface ExtractedContent {
  title: string;
  metaDescription: string;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  paragraphs: string[];
  navLinks: string[];
  listItems: string[];
  colors: string[];
  fonts: string[];
  phoneNumbers: string[];
  emailAddresses: string[];
  addresses: string[];
  rawText: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractTagContent(html: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text && text.length > 2 && text.length < 500) {
      results.push(text);
    }
  }
  return [...new Set(results)];
}

function extractMeta(html: string, name: string): string {
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const m = html.match(regex);
  if (m) return m[1];
  // Also try reversed attribute order
  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
    'i',
  );
  const m2 = html.match(regex2);
  return m2 ? m2[1] : '';
}

function extractColors(html: string): string[] {
  const colors = new Set<string>();
  // Hex colors
  const hexMatches = html.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi);
  for (const m of hexMatches) {
    const c = m[0].toLowerCase();
    // Skip very common irrelevant colors
    if (!['#ffffff', '#000000', '#fff', '#000', '#cccccc', '#ccc', '#eeeeee', '#eee'].includes(c)) {
      colors.add(c.length === 4 ? `#${m[1][0]}${m[1][0]}${m[1][1]}${m[1][1]}${m[1][2]}${m[1][2]}` : c);
    }
  }
  // rgb/rgba
  const rgbMatches = html.matchAll(/rgb[a]?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi);
  for (const m of rgbMatches) {
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    if (r === 255 && g === 255 && b === 255) continue;
    if (r === 0 && g === 0 && b === 0) continue;
    colors.add(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
  }
  return Array.from(colors).slice(0, 10);
}

function extractFonts(html: string): string[] {
  const fonts = new Set<string>();
  // Google Fonts
  const gfMatches = html.matchAll(/family=([A-Za-z+]+)/gi);
  for (const m of gfMatches) fonts.add(m[1].replace(/\+/g, ' '));
  // font-family CSS
  const cssMatches = html.matchAll(/font-family\s*:\s*["']?([A-Za-z][A-Za-z\s]+?)["']?\s*[,;}/]/gi);
  for (const m of cssMatches) fonts.add(m[1].trim());
  return Array.from(fonts).slice(0, 5);
}

function extractPhone(text: string): string[] {
  const phones = new Set<string>();
  const matches = text.matchAll(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
  for (const m of matches) phones.add(m[0].trim());
  return Array.from(phones).slice(0, 3);
}

function extractEmails(text: string): string[] {
  const emails = new Set<string>();
  const matches = text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  for (const m of matches) emails.add(m[0]);
  return Array.from(emails).slice(0, 3);
}

function extractNavLinks(html: string): string[] {
  const navMatch = html.match(/<nav[\s\S]*?<\/nav>/i);
  if (!navMatch) return [];
  const linkTexts: string[] = [];
  const linkRegex = /<a[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRegex.exec(navMatch[0])) !== null) {
    const text = stripTags(m[1]).trim();
    if (text && text.length > 1 && text.length < 30) linkTexts.push(text);
  }
  return [...new Set(linkTexts)].slice(0, 15);
}

/** Detect backend/dynamic features from HTML markup */
function detectBackendFeatures(html: string): string[] {
  const features: string[] = [];
  if (/<form[\s\S]*?<\/form>/i.test(html)) features.push('contact_form');
  if (/wp-content|wordpress/i.test(html)) features.push('wordpress_cms');
  if (/\.php[?"]/i.test(html)) features.push('php_backend');
  if (/api\//i.test(html)) features.push('api_calls');
  if (/login|sign.?in|account/i.test(html)) features.push('auth_pages');
  if (/cart|checkout|shop|woocommerce|shopify/i.test(html)) features.push('ecommerce');
  if (/disqus|comments?/i.test(html)) features.push('comments');
  if (/search/i.test(html)) features.push('search');
  if (/google-analytics|gtag|fbq\(/i.test(html)) features.push('analytics');
  if (/recaptcha|hcaptcha/i.test(html)) features.push('spam_protection');
  return [...new Set(features)];
}

function parseHtml(html: string): ExtractedContent {
  const title = (() => {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? stripTags(m[1]).trim() : '';
  })();

  const metaDescription =
    extractMeta(html, 'description') ||
    extractMeta(html, 'og:description');

  return {
    title,
    metaDescription,
    h1s: extractTagContent(html, 'h1').slice(0, 5),
    h2s: extractTagContent(html, 'h2').slice(0, 10),
    h3s: extractTagContent(html, 'h3').slice(0, 15),
    paragraphs: extractTagContent(html, 'p').slice(0, 20),
    navLinks: extractNavLinks(html),
    listItems: extractTagContent(html, 'li').slice(0, 20),
    colors: extractColors(html),
    fonts: extractFonts(html),
    phoneNumbers: extractPhone(html),
    emailAddresses: extractEmails(html),
    addresses: [],
    rawText: stripTags(html).slice(0, 8000),
  };
}

/** Merge content from multiple pages */
function mergeExtracted(pages: ExtractedContent[]): ExtractedContent {
  const merged: ExtractedContent = {
    title: pages[0]?.title || '',
    metaDescription: pages[0]?.metaDescription || '',
    h1s: [], h2s: [], h3s: [], paragraphs: [], navLinks: [],
    listItems: [], colors: [], fonts: [], phoneNumbers: [],
    emailAddresses: [], addresses: [],
    rawText: '',
  };
  for (const p of pages) {
    merged.h1s.push(...p.h1s);
    merged.h2s.push(...p.h2s);
    merged.h3s.push(...p.h3s);
    merged.paragraphs.push(...p.paragraphs);
    merged.navLinks.push(...p.navLinks);
    merged.listItems.push(...p.listItems);
    merged.colors.push(...p.colors);
    merged.fonts.push(...p.fonts);
    merged.phoneNumbers.push(...p.phoneNumbers);
    merged.emailAddresses.push(...p.emailAddresses);
    merged.rawText += p.rawText + '\n\n';
  }
  return {
    ...merged,
    h1s: [...new Set(merged.h1s)].slice(0, 8),
    h2s: [...new Set(merged.h2s)].slice(0, 15),
    h3s: [...new Set(merged.h3s)].slice(0, 20),
    paragraphs: [...new Set(merged.paragraphs)].slice(0, 30),
    navLinks: [...new Set(merged.navLinks)].slice(0, 15),
    listItems: [...new Set(merged.listItems)].slice(0, 25),
    colors: [...new Set(merged.colors)].slice(0, 10),
    fonts: [...new Set(merged.fonts)].slice(0, 5),
    phoneNumbers: [...new Set(merged.phoneNumbers)].slice(0, 3),
    emailAddresses: [...new Set(merged.emailAddresses)].slice(0, 3),
    rawText: merged.rawText.slice(0, 12000),
  };
}

// ─── URL scraper ──────────────────────────────────────────────────────────────

async function scrapeUrl(url: string): Promise<{ content: ExtractedContent; backendFeatures: string[] }> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  const baseUrl = new URL(normalizedUrl);
  const allHtml: string[] = [];
  const visited = new Set<string>();
  const backendFeatures = new Set<string>();

  const fetchPage = async (pageUrl: string): Promise<string | null> => {
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 CWP-SiteImporter/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  // Fetch main page
  const mainHtml = await fetchPage(normalizedUrl);
  if (!mainHtml) throw new Error(`Could not fetch URL: ${normalizedUrl}`);
  allHtml.push(mainHtml);
  visited.add(normalizedUrl);

  // Detect backend features from main page
  detectBackendFeatures(mainHtml).forEach(f => backendFeatures.add(f));

  // Find same-origin links (discover inner pages: about, services, contact, etc.)
  const priorityPaths = ['about', 'services', 'contact', 'gallery', 'faq', 'pricing'];
  const linkRegex = /href=["']([^"'#?]+)["']/gi;
  const discovered: string[] = [];
  let m;
  while ((m = linkRegex.exec(mainHtml)) !== null) {
    const href = m[1];
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    try {
      const full = new URL(href, baseUrl).toString();
      if (full.startsWith(baseUrl.origin) && !visited.has(full)) {
        const pathLower = new URL(full).pathname.toLowerCase();
        if (priorityPaths.some(p => pathLower.includes(p))) {
          discovered.unshift(full); // priority pages first
        } else {
          discovered.push(full);
        }
        visited.add(full);
      }
    } catch { /* ignore */ }
  }

  // Fetch up to 4 more pages
  let count = 0;
  for (const pageUrl of discovered) {
    if (count >= 4) break;
    const html = await fetchPage(pageUrl);
    if (html) {
      allHtml.push(html);
      detectBackendFeatures(html).forEach(f => backendFeatures.add(f));
      count++;
    }
  }

  const contents = allHtml.map(parseHtml);
  return {
    content: mergeExtracted(contents),
    backendFeatures: Array.from(backendFeatures),
  };
}

// ─── ZIP extractor ────────────────────────────────────────────────────────────

function extractZip(zipBytes: Uint8Array): { content: ExtractedContent; backendFeatures: string[] } {
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(zipBytes);
  } catch (e: any) {
    throw new Error(`Failed to extract ZIP: ${e.message}`);
  }

  const htmlFiles = Object.entries(unzipped)
    .filter(([name]) => name.endsWith('.html') || name.endsWith('.htm'))
    .sort(([a], [b]) => {
      // Prioritize index.html and root-level files
      const aDepth = a.split('/').length;
      const bDepth = b.split('/').length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      if (a.includes('index')) return -1;
      if (b.includes('index')) return 1;
      return 0;
    })
    .slice(0, 10);

  if (htmlFiles.length === 0) {
    throw new Error('No HTML files found in ZIP.');
  }

  const allHtml: string[] = [];
  const backendFeatures = new Set<string>();

  for (const [, bytes] of htmlFiles) {
    const html = strFromU8(bytes);
    allHtml.push(html);
    detectBackendFeatures(html).forEach(f => backendFeatures.add(f));
  }

  // Check CSS files for colors/fonts
  const cssFiles = Object.entries(unzipped)
    .filter(([name]) => name.endsWith('.css'))
    .slice(0, 5);
  const combinedCss = cssFiles.map(([, b]) => strFromU8(b)).join('\n');

  const mainContent = mergeExtracted(allHtml.map(parseHtml));
  // Supplement colors/fonts from CSS
  mainContent.colors.push(...extractColors(combinedCss));
  mainContent.fonts.push(...extractFonts(combinedCss));
  mainContent.colors = [...new Set(mainContent.colors)].slice(0, 10);
  mainContent.fonts = [...new Set(mainContent.fonts)].slice(0, 5);

  return { content: mainContent, backendFeatures: Array.from(backendFeatures) };
}

// ─── Claude AI: generate website_json from extracted content ─────────────────

const CLAUDE_SYSTEM = `You are an expert web designer migrating an existing website into the CWP platform's structured JSON format.
Your job is to analyse the extracted content from the source site and produce a complete, accurate website_json object.

OUTPUT FORMAT: Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

SCHEMA:
{
  "global": {
    "business_name": string,
    "phone": string,
    "address": string,
    "primary_color": string,        // dominant brand hex color from source
    "font_heading": "Inter" | "Playfair Display" | "Montserrat" | "Raleway",
    "font_body": "Inter" | "Lato" | "Open Sans",
    "logo_url": "",
    "hero_image_url": ""
  },
  "pages": [
    {
      "id": string,                 // one of: home, about, services, contact, gallery, faq, testimonials, pricing, blog
      "name": string,
      "slug": string,               // "" for home, "about" for about, etc.
      "seo": { "title": string, "meta_description": string, "keywords": string[] },
      "sections": [
        {
          "section_type": string,
          "variant": string,
          "content": object,
          "editable_fields": string[]
        }
      ]
    }
  ]
}

SECTION TYPES AND VARIANTS:
- hero: "centered_cta" | "split_image_left" | "bold_statement"
- services: "three_column_cards" | "icon_list" | "accordion"
- about: "left_text_right_stats" | "centered_story" | "founder_focus"
- social_proof: "star_testimonials" | "review_wall" | "stats_bar"
- contact_cta: "simple_form" | "phone_prominent" | "split_contact"
- faq: "accordion_simple" | "two_column"
- stats: "four_number_bar"
- gallery: "masonry_grid" | "simple_grid"
- pricing_cards: "three_tier" | "two_tier"
- blog_preview: "card_grid"

CONTENT REQUIREMENTS:
- hero: { headline, subheadline, cta_primary_text, cta_primary_link, background_style: "gradient"|"dark"|"light" }
- services: { heading, services: [{ name, description, icon }] }
- about: { heading, body, stat_1_number, stat_1_label, stat_2_number, stat_2_label }
- social_proof: { heading, reviews: [{ author, stars, text }] }
- contact_cta: { heading, subtext, phone, email, hours }
- faq: { heading, faqs: [{ question, answer }] }
- stats: { stats: [{ number, label }] }
- gallery: { heading, subtext }
- pricing_cards: { heading, subtext, tiers: [{ name, price, period, description, features, cta_text, highlighted }] }
- blog_preview: { heading, subtext }

MIGRATION RULES:
- Use real content from the source site wherever possible — do NOT fabricate business info
- Use the detected primary brand color as primary_color
- Map detected font families to the closest available CWP font
- The home page is always required; include about, services, contact if content exists
- Infer page structure from nav links and headings
- For services: extract real service names and descriptions from the source content
- For contact_cta: use real phone numbers and email addresses found on the site
- Fill editable_fields with dot-paths clients should be able to update (phone, email, hours, service descriptions)
- Return ONLY the JSON object.`;

async function generateWebsiteJson(
  content: ExtractedContent,
  tone: string,
  primaryColorHint?: string,
): Promise<any> {
  const colorList = content.colors.join(', ') || 'not detected';
  const fontList = content.fonts.join(', ') || 'not detected';

  const userPrompt = `Migrate this existing website into the CWP website_json format.

EXTRACTED SITE CONTENT:
Business/Site Title: ${content.title}
Meta Description: ${content.metaDescription}

H1 Headings: ${content.h1s.join(' | ') || 'none'}
H2 Headings: ${content.h2s.join(' | ') || 'none'}
H3 Headings: ${content.h3s.join(' | ') || 'none'}

Navigation Links (page structure): ${content.navLinks.join(', ') || 'none'}

Key Paragraphs:
${content.paragraphs.slice(0, 15).map((p, i) => `${i + 1}. ${p}`).join('\n')}

List Items (services, features, etc.):
${content.listItems.slice(0, 15).map((l, i) => `- ${l}`).join('\n')}

Detected Phone Numbers: ${content.phoneNumbers.join(', ') || 'none'}
Detected Email Addresses: ${content.emailAddresses.join(', ') || 'none'}
Detected Brand Colors: ${colorList}${primaryColorHint ? ` (admin override: ${primaryColorHint})` : ''}
Detected Fonts: ${fontList}

Raw Text Sample:
${content.rawText.slice(0, 4000)}

Desired Tone: ${tone}

Generate the complete website_json now. Use as much real content from the source as possible.
Primary color to use: ${primaryColorHint || content.colors[0] || '#4F46E5'}`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    system: CLAUDE_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawText = (message.content[0] as any)?.text?.trim() || '';

  // Strip any accidental markdown fences
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  const {
    client_id,
    source_type, // "url" | "zip"
    url,
    zip_base64,
    slug: requestedSlug,
    custom_domain,
    premium_features,
    tone = 'Professional',
    primary_color,
  } = body;

  if (!client_id) return errorResponse('client_id is required.', 400);
  if (!source_type || !['url', 'zip'].includes(source_type)) {
    return errorResponse('source_type must be "url" or "zip".', 400);
  }
  if (source_type === 'url' && !url) return errorResponse('url is required when source_type is "url".', 400);
  if (source_type === 'zip' && !zip_base64) return errorResponse('zip_base64 is required when source_type is "zip".', 400);

  console.log(`[import-site] client_id=${client_id} source_type=${source_type} url=${url || '(zip)'}`);

  // Mark as generating
  await supabaseAdmin
    .from('website_briefs')
    .upsert(
      {
        client_id,
        business_name: 'Importing...',
        industry: '',
        services_offered: '',
        location: '',
        tone,
        primary_color: primary_color || '#4F46E5',
        generation_status: 'generating',
        generation_error: null,
        premium_features: Array.isArray(premium_features) ? premium_features : [],
      },
      { onConflict: 'client_id' },
    );

  try {
    // ── 1. Extract content ────────────────────────────────────────────────────
    let extractedContent: ExtractedContent;
    let backendFeatures: string[] = [];

    if (source_type === 'url') {
      const result = await scrapeUrl(url);
      extractedContent = result.content;
      backendFeatures = result.backendFeatures;
    } else {
      // Decode base64 ZIP
      let zipBytes: Uint8Array;
      try {
        const binary = atob(zip_base64);
        zipBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) zipBytes[i] = binary.charCodeAt(i);
      } catch (e: any) {
        throw new Error(`Invalid base64 ZIP data: ${e.message}`);
      }
      const result = extractZip(zipBytes);
      extractedContent = result.content;
      backendFeatures = result.backendFeatures;
    }

    console.log(`[import-site] Extracted title="${extractedContent.title}" pages=${extractedContent.navLinks.length} colors=${extractedContent.colors[0]}`);

    // ── 2. Generate website_json via Claude ───────────────────────────────────
    let websiteJson: any;
    try {
      websiteJson = await generateWebsiteJson(extractedContent, tone, primary_color);
    } catch (e: any) {
      console.error('[import-site] Claude parse error:', e.message);
      await supabaseAdmin
        .from('website_briefs')
        .update({ generation_status: 'error', generation_error: 'AI returned invalid JSON. Please try again.' })
        .eq('client_id', client_id);
      return errorResponse('AI returned invalid JSON. Please try again.', 500);
    }

    // ── 3. Validate and normalise ─────────────────────────────────────────────
    if (!websiteJson.global || !Array.isArray(websiteJson.pages) || websiteJson.pages.length === 0) {
      await supabaseAdmin
        .from('website_briefs')
        .update({ generation_status: 'error', generation_error: 'AI response was missing required fields.' })
        .eq('client_id', client_id);
      return errorResponse('AI response was missing required fields.', 500);
    }

    // Ensure global fallbacks
    websiteJson.global.phone = websiteJson.global.phone || extractedContent.phoneNumbers[0] || '';
    websiteJson.global.primary_color = primary_color || websiteJson.global.primary_color || extractedContent.colors[0] || '#4F46E5';
    websiteJson.global.logo_url = websiteJson.global.logo_url || '';
    websiteJson.global.hero_image_url = websiteJson.global.hero_image_url || '';

    for (const page of websiteJson.pages) {
      if (!page.id || !page.name || !Array.isArray(page.sections)) {
        page.sections = page.sections || [];
      }
      if (!page.seo) {
        page.seo = {
          title: `${websiteJson.global.business_name} — ${page.name}`,
          meta_description: extractedContent.metaDescription || '',
          keywords: [],
        };
      }
    }

    // ── 4. Determine slug ─────────────────────────────────────────────────────
    const { data: existingBrief } = await supabaseAdmin
      .from('website_briefs')
      .select('client_slug')
      .eq('client_id', client_id)
      .single();

    const baseSlug =
      requestedSlug ||
      existingBrief?.client_slug ||
      slugify(websiteJson.global.business_name || 'site');
    const clientSlug = await makeUniqueSlug(supabaseAdmin, baseSlug, client_id);

    // ── 5. Save to website_briefs ─────────────────────────────────────────────
    const businessName = websiteJson.global.business_name || extractedContent.title || 'Imported Site';
    const navText = extractedContent.navLinks.join(', ');
    const pagesText = websiteJson.pages.map((p: any) => p.name).join(', ');

    const { error: saveError } = await supabaseAdmin
      .from('website_briefs')
      .update({
        business_name: businessName,
        industry: '',
        services_offered: navText,
        location: websiteJson.global.address || '',
        tone,
        primary_color: websiteJson.global.primary_color,
        website_json: websiteJson,
        client_slug: clientSlug,
        custom_domain: custom_domain || null,
        is_published: false,
        premium_features: Array.isArray(premium_features) ? premium_features : [],
        generation_status: 'complete',
        generation_error: null,
      })
      .eq('client_id', client_id);

    if (saveError) {
      console.error('[import-site] Save error:', saveError.message);
      return errorResponse('Failed to save imported site.', 500);
    }

    console.log(
      `[import-site] Success client_id=${client_id} slug="${clientSlug}" pages=${websiteJson.pages.length} backend_features=${backendFeatures.join(',')}`,
    );

    return jsonResponse({
      success: true,
      client_slug: clientSlug,
      website_json: websiteJson,
      backend_features: backendFeatures,
      pages_imported: websiteJson.pages.length,
      business_name: businessName,
    });
  } catch (error: any) {
    console.error('[import-site] Unhandled error:', error.message);
    await supabaseAdmin
      .from('website_briefs')
      .update({ generation_status: 'error', generation_error: error.message })
      .eq('client_id', client_id);
    return errorResponse(error.message, 500);
  }
});
