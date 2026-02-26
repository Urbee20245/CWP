export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { unzipSync, strFromU8 } from 'https://esm.sh/fflate@0.8.2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';
import {
  generateWithProvider,
  AI_PROVIDERS,
  DEFAULT_PROVIDER_ID,
} from '../_shared/ai-providers.ts';
import {
  generateWithSupabaseAutonomy,
} from '../_shared/supabase-tools.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

// ─── Enhanced content extraction types ───────────────────────────────────────

interface CSSRule {
  selector: string;
  properties: Record<string, string>;
}

interface ColorPalette {
  primary: string[];
  background: string[];
  text: string[];
  all: string[];
}

interface FontDefinition {
  family: string;
  weights: string[];
  source: 'google' | 'css' | 'inline';
}

interface SpacingValue {
  property: string;
  value: string;
  frequency: number;
}

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
  // Enhanced design fields
  cssRules: CSSRule[];
  colorPalette: ColorPalette;
  fontDefinitions: FontDefinition[];
  dominantSpacing: SpacingValue[];
  inlineStyleSample: string[];
  layoutHints: string[];
}

// ─── Universal extraction types ───────────────────────────────────────────────

type ProjectType = 'static_html' | 'react_tsx' | 'vue' | 'svelte' | 'next' | 'unknown';

interface ExtractedImage {
  src: string;
  alt: string;
  context: 'hero' | 'background' | 'gallery' | 'team' | 'logo' | 'general';
}

interface ExtractedLink {
  text: string;
  href: string;
  context: 'nav' | 'cta' | 'contact' | 'general';
}

// ─── HTML / CSS extraction helpers ───────────────────────────────────────────

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
  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
    'i',
  );
  const m2 = html.match(regex2);
  return m2 ? m2[1] : '';
}

/** Normalize any color value to lowercase hex or rgb string */
function normalizeColor(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  // Skip pure black/white/transparent
  if (['#fff', '#ffffff', '#000', '#000000', 'transparent', 'inherit', 'initial'].includes(trimmed)) {
    return null;
  }
  // Expand 3-char hex
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  return null;
}

function extractColors(source: string): string[] {
  const colors = new Set<string>();
  // Hex
  for (const m of source.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const n = normalizeColor(m[0].toLowerCase());
    if (n) colors.add(n);
  }
  // rgb/rgba
  for (const m of source.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
    const [r, g, b] = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
    if (r === 255 && g === 255 && b === 255) continue;
    if (r === 0 && g === 0 && b === 0) continue;
    colors.add(`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`);
  }
  return Array.from(colors);
}

function extractFonts(source: string): string[] {
  const fonts = new Set<string>();
  for (const m of source.matchAll(/family=([A-Za-z+:]+)/gi)) {
    fonts.add(m[1].split(':')[0].replace(/\+/g, ' '));
  }
  for (const m of source.matchAll(/font-family\s*:\s*["']?([A-Za-z][A-Za-z\s-]+?)["']?\s*[,;}/]/gi)) {
    const f = m[1].trim();
    if (!['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'].includes(f.toLowerCase())) {
      fonts.add(f);
    }
  }
  return Array.from(fonts).slice(0, 8);
}

function extractPhone(text: string): string[] {
  const phones = new Set<string>();
  for (const m of text.matchAll(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g)) {
    phones.add(m[0].trim());
  }
  return Array.from(phones).slice(0, 3);
}

function extractEmails(text: string): string[] {
  const emails = new Set<string>();
  for (const m of text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
    emails.add(m[0]);
  }
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

/**
 * Parse CSS text into a list of rules with selector + properties.
 * Only captures rules that contain design-relevant properties.
 */
function parseCSSRules(cssText: string): CSSRule[] {
  const rules: CSSRule[] = [];
  // Match selector { ... } blocks (non-nested)
  const ruleRegex = /([^{}@][^{}]*?)\{([^{}]*)\}/g;
  let match;
  while ((match = ruleRegex.exec(cssText)) !== null) {
    const selector = match[1].trim();
    const body = match[2];
    if (!selector || selector.length > 200) continue;

    const properties: Record<string, string> = {};
    const propRegex = /([\w-]+)\s*:\s*([^;]+);/g;
    let pm;
    while ((pm = propRegex.exec(body)) !== null) {
      const prop = pm[1].trim().toLowerCase();
      const val = pm[2].trim();
      // Only keep design-relevant properties
      if (
        prop.includes('color') ||
        prop.includes('background') ||
        prop.includes('font') ||
        prop.includes('border') ||
        prop.includes('padding') ||
        prop.includes('margin') ||
        prop.includes('gap') ||
        prop.includes('display') ||
        prop.includes('flex') ||
        prop.includes('grid') ||
        prop.includes('width') ||
        prop.includes('height') ||
        prop.includes('radius') ||
        prop.includes('shadow') ||
        prop.includes('opacity') ||
        prop.includes('transform') ||
        prop.includes('transition') ||
        prop.includes('animation') ||
        prop.includes('letter-spacing') ||
        prop.includes('line-height') ||
        prop.includes('text-align') ||
        prop.includes('text-transform')
      ) {
        properties[prop] = val;
      }
    }

    if (Object.keys(properties).length > 0) {
      rules.push({ selector, properties });
    }
  }
  return rules.slice(0, 300); // cap for token budget
}

/**
 * Build a color palette from CSS rules, categorizing by usage context.
 */
function buildColorPalette(rules: CSSRule[], rawColors: string[]): ColorPalette {
  const primary: Set<string> = new Set();
  const background: Set<string> = new Set();
  const text: Set<string> = new Set();

  for (const rule of rules) {
    for (const [prop, val] of Object.entries(rule.properties)) {
      const colors = extractColors(val);
      if (prop === 'color') colors.forEach(c => text.add(c));
      else if (prop.includes('background')) colors.forEach(c => background.add(c));
      else if (prop.includes('border') || prop.includes('outline')) colors.forEach(c => primary.add(c));
    }
  }

  // Use raw colors as fallback for primary
  rawColors.slice(0, 5).forEach(c => primary.add(c));

  return {
    primary: Array.from(primary).slice(0, 5),
    background: Array.from(background).slice(0, 5),
    text: Array.from(text).slice(0, 5),
    all: [...new Set([...primary, ...background, ...text])].slice(0, 15),
  };
}

/**
 * Extract inline style attributes from HTML elements for design analysis.
 */
function extractInlineStyles(html: string): string[] {
  const styles: string[] = [];
  const regex = /style=["']([^"']{10,300})["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    styles.push(m[1].trim());
  }
  return [...new Set(styles)].slice(0, 30);
}

/**
 * Detect layout hints from HTML structure (flex/grid usage, column count, etc).
 */
function detectLayoutHints(html: string): string[] {
  const hints: string[] = [];
  if (/display\s*:\s*flex|flexbox/i.test(html)) hints.push('uses-flexbox');
  if (/display\s*:\s*grid/i.test(html)) hints.push('uses-css-grid');
  if (/grid-template-columns/i.test(html)) {
    const gtcMatch = html.match(/grid-template-columns\s*:\s*([^;}"']+)/i);
    if (gtcMatch) hints.push(`grid-columns: ${gtcMatch[1].trim()}`);
  }
  if (/class=["'][^"']*col-\d/i.test(html)) hints.push('uses-column-classes');
  if (/class=["'][^"']*container/i.test(html)) hints.push('uses-container-class');
  if (/class=["'][^"']*section/i.test(html)) hints.push('uses-section-class');
  if (/class=["'][^"']*hero/i.test(html)) hints.push('has-hero-section');
  if (/class=["'][^"']*card/i.test(html)) hints.push('uses-card-pattern');
  return [...new Set(hints)];
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

function parseHtml(html: string, cssTexts: string[] = []): ExtractedContent {
  const title = (() => {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? stripTags(m[1]).trim() : '';
  })();

  const metaDescription =
    extractMeta(html, 'description') ||
    extractMeta(html, 'og:description');

  // Extract inline <style> blocks from HTML
  const inlineStyleBlocks: string[] = [];
  const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleBlockRegex.exec(html)) !== null) {
    inlineStyleBlocks.push(sm[1]);
  }

  // Combine all CSS sources
  const allCss = [...inlineStyleBlocks, ...cssTexts].join('\n');

  const rawColors = extractColors(html + '\n' + allCss);
  const cssRules = parseCSSRules(allCss);
  const colorPalette = buildColorPalette(cssRules, rawColors);
  const inlineStyleSample = extractInlineStyles(html);
  const layoutHints = detectLayoutHints(html + '\n' + allCss);

  // Build font definitions with weight info
  const fontFamilies = extractFonts(html + '\n' + allCss);
  const fontDefinitions: FontDefinition[] = fontFamilies.map(family => {
    const weightMatches: string[] = [];
    const wRegex = new RegExp(`font-family[^;]*${family.split(' ')[0]}[^}]*font-weight\\s*:\\s*([\\d\\w]+)`, 'gi');
    let wm;
    while ((wm = wRegex.exec(allCss)) !== null) {
      weightMatches.push(wm[1]);
    }
    // Google fonts weight from URL
    const gfWeights: string[] = [];
    const gfRegex = new RegExp(`family=${family.replace(' ', '\\+')}:([\\d,wght@]+)`, 'gi');
    let gm;
    while ((gm = gfRegex.exec(html)) !== null) gfWeights.push(gm[1]);

    return {
      family,
      weights: [...new Set([...weightMatches, ...gfWeights])].slice(0, 5),
      source: html.includes('fonts.googleapis.com') ? 'google' : 'css',
    };
  });

  // Detect dominant spacing values
  const spacingMap: Record<string, number> = {};
  for (const rule of cssRules) {
    for (const [prop, val] of Object.entries(rule.properties)) {
      if (['padding', 'margin', 'gap', 'padding-top', 'padding-bottom',
           'padding-left', 'padding-right', 'margin-top', 'margin-bottom'].includes(prop)) {
        const key = `${prop}: ${val}`;
        spacingMap[key] = (spacingMap[key] || 0) + 1;
      }
    }
  }
  const dominantSpacing: SpacingValue[] = Object.entries(spacingMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, freq]) => {
      const [property, value] = key.split(': ');
      return { property, value, frequency: freq };
    });

  return {
    title,
    metaDescription,
    h1s: extractTagContent(html, 'h1').slice(0, 5),
    h2s: extractTagContent(html, 'h2').slice(0, 10),
    h3s: extractTagContent(html, 'h3').slice(0, 15),
    paragraphs: extractTagContent(html, 'p').slice(0, 20),
    navLinks: extractNavLinks(html),
    listItems: extractTagContent(html, 'li').slice(0, 20),
    colors: rawColors.slice(0, 10),
    fonts: fontFamilies.slice(0, 5),
    phoneNumbers: extractPhone(html),
    emailAddresses: extractEmails(html),
    addresses: [],
    rawText: stripTags(html).slice(0, 8000),
    cssRules,
    colorPalette,
    fontDefinitions,
    dominantSpacing,
    inlineStyleSample,
    layoutHints,
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
    cssRules: [],
    colorPalette: { primary: [], background: [], text: [], all: [] },
    fontDefinitions: [],
    dominantSpacing: [],
    inlineStyleSample: [],
    layoutHints: [],
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
    merged.cssRules.push(...p.cssRules);
    merged.colorPalette.primary.push(...p.colorPalette.primary);
    merged.colorPalette.background.push(...p.colorPalette.background);
    merged.colorPalette.text.push(...p.colorPalette.text);
    merged.colorPalette.all.push(...p.colorPalette.all);
    merged.fontDefinitions.push(...p.fontDefinitions);
    merged.dominantSpacing.push(...p.dominantSpacing);
    merged.inlineStyleSample.push(...p.inlineStyleSample);
    merged.layoutHints.push(...p.layoutHints);
  }

  // De-duplicate and cap
  const dedupeAndCap = <T>(arr: T[], n: number): T[] => [...new Set(arr)].slice(0, n);

  return {
    ...merged,
    h1s: dedupeAndCap(merged.h1s, 8),
    h2s: dedupeAndCap(merged.h2s, 15),
    h3s: dedupeAndCap(merged.h3s, 20),
    paragraphs: dedupeAndCap(merged.paragraphs, 30),
    navLinks: dedupeAndCap(merged.navLinks, 15),
    listItems: dedupeAndCap(merged.listItems, 25),
    colors: dedupeAndCap(merged.colors, 10),
    fonts: dedupeAndCap(merged.fonts, 8),
    phoneNumbers: dedupeAndCap(merged.phoneNumbers, 3),
    emailAddresses: dedupeAndCap(merged.emailAddresses, 3),
    rawText: merged.rawText.slice(0, 12000),
    cssRules: merged.cssRules.slice(0, 300),
    colorPalette: {
      primary: dedupeAndCap(merged.colorPalette.primary, 5),
      background: dedupeAndCap(merged.colorPalette.background, 5),
      text: dedupeAndCap(merged.colorPalette.text, 5),
      all: dedupeAndCap(merged.colorPalette.all, 15),
    },
    fontDefinitions: merged.fontDefinitions.slice(0, 6),
    dominantSpacing: merged.dominantSpacing.slice(0, 10),
    inlineStyleSample: dedupeAndCap(merged.inlineStyleSample, 20),
    layoutHints: dedupeAndCap(merged.layoutHints, 10),
  };
}

// ─── URL scraper ──────────────────────────────────────────────────────────────

async function scrapeUrl(url: string): Promise<{ content: ExtractedContent; backendFeatures: string[]; images: ExtractedImage[]; links: ExtractedLink[] }> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  const baseUrl = new URL(normalizedUrl);
  const allHtml: string[] = [];
  const allCssTexts: string[] = [];
  const visited = new Set<string>();
  const backendFeatures = new Set<string>();
  const scrapedImages: ExtractedImage[] = [];
  const scrapedLinks: ExtractedLink[] = [];

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

  const fetchCss = async (cssUrl: string): Promise<string> => {
    try {
      const res = await fetch(cssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 CWP-SiteImporter/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return '';
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('css') && !ct.includes('text')) return '';
      return await res.text();
    } catch {
      return '';
    }
  };

  // Fetch main page
  const mainHtml = await fetchPage(normalizedUrl);
  if (!mainHtml) throw new Error(`Could not fetch URL: ${normalizedUrl}`);
  allHtml.push(mainHtml);
  visited.add(normalizedUrl);

  detectBackendFeatures(mainHtml).forEach(f => backendFeatures.add(f));

  // Extract images and links from main HTML
  for (const m of mainHtml.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi)) {
    try {
      const src = m[1].startsWith('http') ? m[1] : new URL(m[1], baseUrl).toString();
      scrapedImages.push({ src, alt: m[2] || '', context: inferImageContext(m[2] || '', m[0]) });
    } catch { /* skip invalid URLs */ }
  }
  for (const m of mainHtml.matchAll(/<a[^>]+href=["']([^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripTags(m[2]).trim();
    const href = m[1];
    if (text && text.length < 60) scrapedLinks.push({ text, href, context: href.startsWith('/') ? 'nav' : 'general' });
  }
  for (const m of mainHtml.matchAll(/["'](tel:[^"']+)["']/g)) scrapedLinks.push({ text: '', href: m[1], context: 'contact' });
  for (const m of mainHtml.matchAll(/["'](mailto:[^"']+)["']/g)) scrapedLinks.push({ text: '', href: m[1], context: 'contact' });

  // Extract and fetch ALL linked CSS files (not just first 5)
  const cssLinkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']|<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi;
  const cssUrls: string[] = [];
  let cssMatch;
  while ((cssMatch = cssLinkRegex.exec(mainHtml)) !== null) {
    const href = cssMatch[1] || cssMatch[2];
    if (!href || href.startsWith('data:')) continue;
    if (href.includes('fonts.googleapis.com')) continue; // skip font API calls
    try {
      const full = new URL(href, baseUrl).toString();
      cssUrls.push(full);
    } catch { /* skip */ }
  }

  // Fetch up to 10 CSS files for thorough style extraction
  const cssPromises = cssUrls.slice(0, 10).map(u => fetchCss(u));
  const cssResults = await Promise.all(cssPromises);
  allCssTexts.push(...cssResults.filter(Boolean));

  // Discover inner pages
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
          discovered.unshift(full);
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

  const contents = allHtml.map(html => parseHtml(html, allCssTexts));
  return {
    content: mergeExtracted(contents),
    backendFeatures: Array.from(backendFeatures),
    images: scrapedImages,
    links: scrapedLinks,
  };
}

// ─── Universal extraction helpers ─────────────────────────────────────────────

function detectProjectType(fileNames: string[]): ProjectType {
  const all = fileNames.join('\n').toLowerCase();
  if (all.includes('next.config')) return 'next';
  if (fileNames.some(f => f.endsWith('.vue'))) return 'vue';
  if (fileNames.some(f => f.endsWith('.svelte'))) return 'svelte';
  if (fileNames.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) return 'react_tsx';
  if (fileNames.some(f => f.endsWith('.html'))) return 'static_html';
  return 'unknown';
}

function inferImageContext(alt: string, tagOrPath: string): ExtractedImage['context'] {
  const combined = (alt + ' ' + tagOrPath).toLowerCase();
  if (combined.match(/logo/)) return 'logo';
  if (combined.match(/hero|banner|cover|header|splash/)) return 'hero';
  if (combined.match(/background|bg-/)) return 'background';
  if (combined.match(/team|staff|person|avatar|portrait|headshot|founder|owner/)) return 'team';
  if (combined.match(/gallery|portfolio|work|project/)) return 'gallery';
  return 'general';
}

function resolveAssetUrl(path: string, owner: string, repo: string, branch: string): string {
  if (path.startsWith('http')) return path;
  const clean = path.replace(/^\.\//, '').replace(/^\//, '');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${clean}`;
}

function extractColorsFromReact(source: string, css: string, unzipped: Record<string, Uint8Array>): ColorPalette {
  const primary = new Set<string>();
  const background = new Set<string>();
  const text = new Set<string>();

  // From CSS files
  extractColors(css).forEach(c => primary.add(c));

  // From tailwind.config — colors defined there are the brand colors
  for (const [path, bytes] of Object.entries(unzipped)) {
    if (path.toLowerCase().includes('tailwind.config')) {
      const config = strFromU8(bytes);
      for (const m of config.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
        const n = normalizeColor(m[0]);
        if (n) primary.add(n);
      }
    }
    if (path.toLowerCase().endsWith('index.html')) {
      const html = strFromU8(bytes);
      const configMatch = html.match(/tailwind\.config\s*=\s*\{([\s\S]+?)\}/);
      if (configMatch) {
        for (const m of configMatch[1].matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
          const n = normalizeColor(m[0]);
          if (n) primary.add(n);
        }
      }
    }
  }

  // From source className strings — text-[#...] bg-[#...]
  for (const m of source.matchAll(/(?:text|bg|border|ring|from|to|via)-\[#([0-9a-f]{6}|[0-9a-f]{3})\]/gi)) {
    const n = normalizeColor('#' + m[1]);
    if (n) {
      if (m[0].startsWith('text')) text.add(n);
      else if (m[0].startsWith('bg')) background.add(n);
      else primary.add(n);
    }
  }

  // Hex literals anywhere in source
  for (const m of source.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const n = normalizeColor(m[0]);
    if (n) primary.add(n);
  }

  const all = [...new Set([...primary, ...background, ...text])];
  return {
    primary: Array.from(primary).slice(0, 5),
    background: Array.from(background).slice(0, 5),
    text: Array.from(text).slice(0, 5),
    all: all.slice(0, 15),
  };
}

function extractFontsFromReact(source: string, css: string, indexHtml: string): string[] {
  const fonts = new Set<string>();
  for (const m of indexHtml.matchAll(/family=([A-Za-z+]+)/gi)) {
    fonts.add(m[1].replace(/\+/g, ' ').split(':')[0]);
  }
  for (const m of (source + css).matchAll(/font-family\s*[=:]\s*['"`]?([A-Za-z][A-Za-z\s-]+?)['"`]?\s*[,;}/]/gi)) {
    const f = m[1].trim();
    if (!['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'].includes(f.toLowerCase())) fonts.add(f);
  }
  for (const m of source.matchAll(/sans\s*:\s*\[\s*['"]([^'"]+)['"]/g)) fonts.add(m[1]);
  return Array.from(fonts).slice(0, 8);
}

function detectLayoutHintsFromReact(source: string, css: string): string[] {
  const hints: string[] = [];
  if (source.includes('grid') || css.includes('display: grid')) hints.push('uses-css-grid');
  if (source.includes('flex') || css.includes('display: flex')) hints.push('uses-flexbox');
  if (source.match(/md:grid-cols-3|lg:grid-cols-3/)) hints.push('three-column-layout');
  if (source.match(/md:grid-cols-2|lg:grid-cols-2/)) hints.push('two-column-layout');
  if (source.match(/AccordionItem|<details|isOpen/)) hints.push('has-accordion');
  if (source.match(/useState.*step|setStep|FormStep/)) hints.push('has-multi-step-form');
  if (source.match(/<nav|NavLink|navItems/)) hints.push('has-navigation');
  if (source.match(/bg-slate-900|bg-gray-900|bg-black/)) hints.push('dark-hero');
  if (source.match(/sticky|fixed.*top/)) hints.push('sticky-header');
  return hints;
}

function extractFromReactProject(
  unzipped: Record<string, Uint8Array>,
  owner: string,
  repo: string,
  branch: string,
): { content: ExtractedContent; images: ExtractedImage[]; links: ExtractedLink[]; colors: ColorPalette; rawSourceMap: Record<string, string> } {
  // 1. Collect all component files
  const componentFiles: Record<string, string> = {};
  const cssFiles: Record<string, string> = {};

  for (const [path, bytes] of Object.entries(unzipped)) {
    if (path.includes('node_modules') || path.includes('.git')) continue;
    const lower = path.toLowerCase();
    if (lower.endsWith('.tsx') || lower.endsWith('.jsx') || lower.endsWith('.ts') || lower.endsWith('.js')) {
      if (lower.match(/vite\.config|next\.config|tailwind\.config|postcss|jest|test\.|spec\.|\.d\.ts$/)) continue;
      componentFiles[path] = strFromU8(bytes);
    }
    if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.sass')) {
      cssFiles[path] = strFromU8(bytes);
    }
  }

  // 2. Get index.html for meta tags/title/colors
  let indexHtml = '';
  for (const [path, bytes] of Object.entries(unzipped)) {
    if (path.toLowerCase().endsWith('index.html') && !path.includes('node_modules')) {
      indexHtml = strFromU8(bytes);
      break;
    }
  }

  const allCss = Object.values(cssFiles).join('\n');
  const allSource = Object.values(componentFiles).join('\n');

  // 3. Extract text content from JSX
  const jsxTexts: string[] = [];
  for (const m of allSource.matchAll(/>([^<>{}\n\r]{3,300})</g)) {
    const text = m[1].trim();
    if (text && !text.startsWith('{') && !text.startsWith('//') && !text.startsWith('*') && text.length > 2) {
      jsxTexts.push(text);
    }
  }
  for (const m of allSource.matchAll(/["'`]([A-Z][^"'`\n]{9,300})["'`]/g)) {
    const text = m[1].trim();
    if (!text.includes('${') && !text.match(/^https?:\/\//)) jsxTexts.push(text);
  }
  for (const m of allSource.matchAll(/`([A-Z][^`\n]{9,300})`/g)) {
    jsxTexts.push(m[1].trim());
  }

  // 4. Extract headings
  const h1s: string[] = [];
  const h2s: string[] = [];
  const h3s: string[] = [];
  for (const m of allSource.matchAll(/<h1[^>]*>\s*([^<{]{3,200})\s*<\/h1>/gi)) h1s.push(m[1].trim());
  for (const m of allSource.matchAll(/<h2[^>]*>\s*([^<{]{3,200})\s*<\/h2>/gi)) h2s.push(m[1].trim());
  for (const m of allSource.matchAll(/<h3[^>]*>\s*([^<{]{3,200})\s*<\/h3>/gi)) h3s.push(m[1].trim());
  for (const m of allSource.matchAll(/<h1[^>]*>([\s\S]{3,300}?)<\/h1>/gi)) {
    const text = m[1].replace(/<[^>]+>/g, '').replace(/[{}]/g, '').trim();
    if (text.length > 2) h1s.push(text);
  }

  // 5. Extract images
  const images: ExtractedImage[] = [];
  for (const m of allSource.matchAll(/const\s+\w*(?:URL|Url|Photo|photo|Image|image|Img|img|Src|src|Banner|banner|Hero|hero|Logo|logo|Bg|bg)\w*\s*=\s*["'`]([^"'`\n]+)["'`]/gi)) {
    if (m[1].startsWith('http') || m[1].startsWith('/')) {
      const resolved = m[1].startsWith('http') ? m[1] : resolveAssetUrl(m[1], owner, repo, branch);
      images.push({ src: resolved, alt: '', context: inferImageContext('', m[0]) });
    }
  }
  for (const m of allSource.matchAll(/\bsrc\s*=\s*[{]?\s*["'`]([^"'`{}]+)["'`]\s*[}]?/gi)) {
    const src = m[1].trim();
    if (src.length > 4 && !src.includes('\n')) {
      const resolved = src.startsWith('http') ? src : resolveAssetUrl(src, owner, repo, branch);
      images.push({ src: resolved, alt: '', context: inferImageContext('', m[0]) });
    }
  }
  for (const m of allCss.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) {
    const resolved = m[1].startsWith('http') ? m[1] : resolveAssetUrl(m[1], owner, repo, branch);
    if (!resolved.startsWith('data:')) images.push({ src: resolved, alt: '', context: 'background' });
  }
  for (const m of allSource.matchAll(/url\(['"]?([^'")\n]+)['"]?\)/gi)) {
    const resolved = m[1].startsWith('http') ? m[1] : resolveAssetUrl(m[1], owner, repo, branch);
    if (!resolved.startsWith('data:')) images.push({ src: resolved, alt: '', context: 'background' });
  }
  for (const [path] of Object.entries(unzipped)) {
    if (path.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i) && !path.includes('node_modules')) {
      const relativePath = path.split('/').slice(1).join('/');
      const url = resolveAssetUrl('/' + relativePath, owner, repo, branch);
      images.push({ src: url, alt: '', context: inferImageContext(path, path) });
    }
  }

  // 6. Extract links
  const links: ExtractedLink[] = [];
  for (const m of allSource.matchAll(/navigate\(['"]([^'"]+)['"]\)/g)) {
    links.push({ text: '', href: m[1], context: 'cta' });
  }
  for (const m of allSource.matchAll(/href\s*=\s*["'`]([^"'`\n]+)["'`]/gi)) {
    links.push({ text: '', href: m[1], context: m[1].startsWith('/') ? 'nav' : 'general' });
  }
  for (const m of allSource.matchAll(/["'`](tel:[^"'`\n]+)["'`]/g)) links.push({ text: '', href: m[1], context: 'contact' });
  for (const m of allSource.matchAll(/["'`](mailto:[^"'`\n]+)["'`]/g)) links.push({ text: '', href: m[1], context: 'contact' });

  // 7. Extract colors
  const colors = extractColorsFromReact(allSource, allCss, unzipped);

  // 8. Extract phone/email
  const phoneNumbers = extractPhone(allSource + indexHtml);
  const emailAddresses = extractEmails(allSource + indexHtml);

  // 9. Extract title
  let title = '';
  const titleMatch = indexHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = stripTags(titleMatch[1]).trim();
  if (!title) title = h1s[0] || h2s[0] || 'Imported Site';

  // 10. Extract meta description
  const metaDescription = extractMeta(indexHtml, 'description') || extractMeta(indexHtml, 'og:description') || '';

  // 11. Build nav links from route definitions
  const navLinks: string[] = [];
  for (const m of allSource.matchAll(/(?:path\s*[:=]\s*|to\s*=\s*)["'`]\/([a-z][a-z0-9-]*)["'`]/gi)) {
    navLinks.push(m[1].charAt(0).toUpperCase() + m[1].slice(1));
  }
  for (const m of allSource.matchAll(/<(?:NavLink|Link)[^>]*>([^<]{2,30})<\/(?:NavLink|Link)>/g)) {
    const text = m[1].trim();
    if (text) navLinks.push(text);
  }

  const rawText = jsxTexts.join(' ').slice(0, 12000);
  const cssRules = parseCSSRules(allCss);
  const layoutHints = detectLayoutHintsFromReact(allSource, allCss);
  const fonts = extractFontsFromReact(allSource, allCss, indexHtml);

  const content: ExtractedContent = {
    title,
    metaDescription,
    h1s: [...new Set(h1s)].slice(0, 8),
    h2s: [...new Set(h2s)].slice(0, 15),
    h3s: [...new Set(h3s)].slice(0, 20),
    paragraphs: jsxTexts.filter(t => t.length > 40).slice(0, 30),
    navLinks: [...new Set(navLinks)].slice(0, 15),
    listItems: jsxTexts.filter(t => t.length < 100 && t.length > 5).slice(0, 25),
    colors: colors.all.slice(0, 10),
    fonts,
    phoneNumbers,
    emailAddresses,
    addresses: [],
    rawText,
    cssRules,
    colorPalette: colors,
    fontDefinitions: [],
    dominantSpacing: [],
    inlineStyleSample: [],
    layoutHints,
  };

  return { content, images, links, colors, rawSourceMap: componentFiles };
}

function extractFromVueSvelteProject(
  unzipped: Record<string, Uint8Array>,
  _owner: string,
  _repo: string,
  _branch: string,
): ExtractedContent {
  const allTemplateContent: string[] = [];
  const allStyleContent: string[] = [];

  for (const [path, bytes] of Object.entries(unzipped)) {
    if (path.includes('node_modules')) continue;
    const content = strFromU8(bytes);
    if (path.endsWith('.vue') || path.endsWith('.svelte')) {
      const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/i);
      if (templateMatch) allTemplateContent.push(templateMatch[1]);
      const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      if (styleMatch) allStyleContent.push(styleMatch[1]);
    }
  }

  const combined = allTemplateContent.join('\n');
  return parseHtml(combined, allStyleContent);
}

// ─── Universal ZIP extractor ──────────────────────────────────────────────────

async function universalExtractZip(
  zipBytes: Uint8Array,
  githubMeta?: { owner: string; repo: string; branch: string },
): Promise<{ content: ExtractedContent; images: ExtractedImage[]; links: ExtractedLink[]; backendFeatures: string[]; projectType: ProjectType }> {
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(zipBytes);
  } catch (e: any) {
    throw new Error(`Failed to extract ZIP: ${e.message}`);
  }

  const fileNames = Object.keys(unzipped);
  const projectType = detectProjectType(fileNames);
  const owner = githubMeta?.owner || 'unknown';
  const repo = githubMeta?.repo || 'unknown';
  const branch = githubMeta?.branch || 'main';

  console.log(`[import-site] Detected project type: ${projectType}, files: ${fileNames.length}`);

  const backendFeatures = new Set<string>();
  let content: ExtractedContent;
  let images: ExtractedImage[] = [];
  let links: ExtractedLink[] = [];

  if (projectType === 'react_tsx' || projectType === 'next') {
    const result = extractFromReactProject(unzipped, owner, repo, branch);
    content = result.content;
    images = result.images;
    links = result.links;
    const allSource = Object.values(result.rawSourceMap).join('\n');
    if (allSource.match(/fetch\(|axios\.|api\//i)) backendFeatures.add('api_calls');
    if (allSource.match(/useState.*step|multi.*step|FormStep/i)) backendFeatures.add('multi_step_form');
    if (allSource.match(/supabase|firebase|prisma/i)) backendFeatures.add('database');
    if (allSource.match(/<form|onSubmit|handleSubmit/i)) backendFeatures.add('contact_form');
  } else if (projectType === 'vue' || projectType === 'svelte') {
    content = extractFromVueSvelteProject(unzipped, owner, repo, branch);
  } else {
    // static_html or unknown — existing parseHtml path
    const htmlFiles = fileNames
      .filter(n => n.endsWith('.html') || n.endsWith('.htm'))
      .sort((a, b) => {
        if (a.includes('index')) return -1;
        if (b.includes('index')) return 1;
        return a.split('/').length - b.split('/').length;
      })
      .slice(0, 10);

    if (htmlFiles.length === 0) {
      throw new Error('No HTML or component files found. Please provide a valid website repository.');
    }

    const cssFileNames = fileNames.filter(n => n.endsWith('.css'));
    const allCssTexts = cssFileNames.map(f => strFromU8(unzipped[f]));
    const allHtml = htmlFiles.map(f => strFromU8(unzipped[f]));

    for (const html of allHtml) {
      for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi)) {
        const src = m[1].startsWith('http') ? m[1] : resolveAssetUrl(m[1], owner, repo, branch);
        images.push({ src, alt: m[2] || '', context: inferImageContext(m[2] || '', m[0]) });
      }
      for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const text = stripTags(m[2]).trim();
        if (text && text.length < 60) links.push({ text, href: m[1], context: 'general' });
      }
      detectBackendFeatures(html).forEach(f => backendFeatures.add(f));
    }

    const contents = allHtml.map(html => parseHtml(html, allCssTexts));
    content = mergeExtracted(contents);
  }

  // Dedupe images (remove duplicate src URLs)
  const seenSrc = new Set<string>();
  images = images.filter(img => {
    if (!img.src || seenSrc.has(img.src)) return false;
    seenSrc.add(img.src);
    return true;
  });

  return {
    content,
    images,
    links,
    backendFeatures: Array.from(backendFeatures),
    projectType,
  };
}

// ─── GitHub ZIP fetcher ───────────────────────────────────────────────────────

async function fetchGithubZip(rawUrl: string): Promise<{ bytes: Uint8Array; owner: string; repo: string; branch: string }> {
  const normalized = rawUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');
  let urlObj: URL;
  try {
    urlObj = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
  } catch {
    throw new Error('Invalid GitHub URL provided.');
  }

  if (!urlObj.hostname.includes('github.com')) {
    throw new Error('URL must be a github.com repository URL.');
  }

  const parts = urlObj.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Invalid GitHub URL. Expected https://github.com/owner/repo');
  }

  const owner = parts[0];
  const repo  = parts[1];

  let explicitBranch: string | null = null;
  if (parts[2] === 'tree' && parts[3]) {
    explicitBranch = parts[3];
  }

  const branchesToTry = explicitBranch ? [explicitBranch] : ['main', 'master'];

  for (const branch of branchesToTry) {
    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
    try {
      const res = await fetch(zipUrl, {
        headers: { 'User-Agent': 'CWP-SiteImporter/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        return { bytes: new Uint8Array(await res.arrayBuffer()), owner, repo, branch };
      }
    } catch {
      /* try next */
    }
  }

  throw new Error(
    `Could not download the GitHub repository. Ensure the repository is public and the URL is correct (tried branches: ${branchesToTry.join(', ')}).`,
  );
}

// ─── System prompt: design-preserving migration ───────────────────────────────

const DESIGN_PRESERVATION_SYSTEM = `You are migrating an existing website into the CWP platform's structured JSON format with EXACT design fidelity.

CRITICAL GOAL: Pixel-perfect recreation — not interpretation or improvement.

OUTPUT FORMAT: Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

SCHEMA:
{
  "global": {
    "business_name": string,
    "phone": string,
    "address": string,
    "primary_color": string,        // exact hex from colorPalette.primary[0]
    "secondary_color": string,      // accent color if detected (e.g. gold alongside blue)
    "font_heading": "Inter" | "Playfair Display" | "Montserrat" | "Raleway",
    "font_body": "Inter" | "Lato" | "Open Sans",
    "logo_url": "",
    "hero_image_url": "",
    "founder_photo_url": ""
  },
  "pages": [
    {
      "id": string,                 // home | about | services | contact | gallery | faq | testimonials | pricing | blog
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
- services: "three_column_cards" | "four_column_icons" | "icon_list" | "accordion"
- about: "left_text_right_stats" | "centered_story" | "founder_focus"
- social_proof: "star_testimonials" | "review_wall" | "stats_bar"
- contact_cta: "simple_form" | "multi_step_form" | "phone_prominent" | "split_contact" | "dark_band"
- faq: "accordion_simple" | "two_column"
- stats: "four_number_bar"
- gallery: "masonry_grid" | "simple_grid"
- pricing_cards: "three_tier" | "two_tier"
- blog_preview: "card_grid"

CONTENT REQUIREMENTS:
- hero: { headline, subheadline, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, background_image_url, background_style: "gradient"|"dark"|"light" }
- services: { heading, services: [{ name, description, icon, image_url }] }
- about: { heading, body, image_url, stat_1_number, stat_1_label, stat_2_number, stat_2_label }
- social_proof: { heading, reviews: [{ author, stars, text }] }
- contact_cta: { heading, subtext, phone, email, hours }
- faq: { heading, faqs: [{ question, answer }] }
- stats: { stats: [{ number, label }] }
- gallery: { heading, subtext, images: [{ url, caption, alt }] }
- pricing_cards: { heading, subtext, tiers: [{ name, price, period, description, features, cta_text, highlighted }] }
- blog_preview: { heading, subtext }

DESIGN PRESERVATION RULES (MANDATORY):
1. PRIMARY COLOR: Use the EXACT hex from colorPalette.primary[0]. Never substitute or "improve" it.
2. FONTS: Map detected font families to the closest available CWP font:
   - Sans-serif (Inter, Roboto, Open Sans, Lato, Nunito, Poppins → "Inter" or "Open Sans")
   - Display/Decorative (Playfair, Merriweather, Lora, Georgia → "Playfair Display")
   - Geometric (Montserrat, Futura, Raleway, Oswald → "Montserrat" or "Raleway")
3. LAYOUT: Match the column count and structure from layoutHints. If source uses 3-column cards, use three_column_cards variant.
4. SECTIONS: Include EVERY section that exists in the source. Do NOT add sections that don't exist. Do NOT remove sections that do.
5. CONTENT: Use real text from the source site. Do not fabricate or "improve" copy.
6. SPACING: Preserve visual hierarchy — if source has large headings, choose variants with prominent headings.
7. HERO BACKGROUND: If source uses a dark hero, set background_style to "dark". Light source → "light". Gradient → "gradient".

CONTENT FIDELITY RULES (MANDATORY — NEVER VIOLATE):
1. IMAGES: Only use URLs from the "REAL IMAGE URLS" section. If that section is empty, use "". Never invent or guess URLs.
2. LINKS: Only use hrefs from "REAL LINKS" section. For internal pages use "/about", "/services" etc. Never use "#" as a link.
3. COPY: Use the EXACT text extracted from the source. Do not rephrase, improve, or summarize.
   * Headings must match the H1/H2 from the source exactly (including capitalization)
   * Service names, feature names, testimonial text — verbatim
   * Statistics and numbers must be exact (e.g. "10+ Years", "0% Floor", "$2M+")
4. CONTACT INFO: Phone and email must be exactly as extracted. Never substitute placeholder values.
5. SECTIONS: Map every distinct content block you see in the extracted text to a CWP section.
   * Multi-step contact form → section_type: "contact_cta", variant: "multi_step_form"
   * Accordion FAQs → section_type: "faq", variant: "accordion_simple"
   * Feature grid (4 items) → section_type: "services", variant: "four_column_icons"
   * Stats bar → section_type: "stats", variant: "four_number_bar"
   * Dark CTA band → section_type: "contact_cta", variant: "dark_band"
   * Two-column about with photo → section_type: "about", variant: "founder_focus"
6. MULTI-PAGE: Create one page entry per detected route/page. Each page's sections must use content scoped to that page, not content from other pages.
7. COLORS: The secondary_color field must be populated if a distinct accent color exists (e.g. gold/amber alongside a primary blue — both must be captured).
8. BACKGROUND IMAGES: If a section uses a dark overlay on an image, set: background_image_url to the real image URL AND background_style to "dark".

VALIDATION CHECKLIST (verify before returning JSON):
✓ primary_color matches colorPalette.primary[0] exactly
✓ All source nav sections are represented as pages
✓ No extra pages or sections added beyond source
✓ Font selections reflect source typography
✓ Phone/email populated from extracted data
✓ Hero style (dark/light/gradient) matches source
✓ No invented image URLs (check every image field)
✓ No "#" placeholder links
✓ secondary_color populated if source has an accent color
✓ All pages from source navigation are represented
✓ Phone formatted as tel:+1XXXXXXXXXX
✓ Email formatted as mailto:email@domain.com`;

// ─── Generate website JSON via chosen AI provider ─────────────────────────────

async function generateWebsiteJson(
  content: ExtractedContent,
  tone: string,
  providerId: string,
  primaryColorHint?: string,
  images: ExtractedImage[] = [],
  links: ExtractedLink[] = [],
  projectType: ProjectType = 'unknown',
): Promise<any> {
  const colorList = content.colorPalette.all.join(', ') || content.colors.join(', ') || 'not detected';
  const fontList = content.fontDefinitions.length > 0
    ? content.fontDefinitions.map(f => `${f.family}${f.weights.length ? ` (weights: ${f.weights.join(',')})` : ''}`).join(', ')
    : content.fonts.join(', ') || 'not detected';

  // Summarize CSS rules for token efficiency
  const cssRuleSummary = content.cssRules
    .filter(r => Object.values(r.properties).some(v => v.match(/#[0-9a-f]{3,6}|rgb/i)))
    .slice(0, 40)
    .map(r => `${r.selector} { ${Object.entries(r.properties).map(([k,v]) => `${k}:${v}`).join('; ')} }`)
    .join('\n');

  // Build image block
  const byCtx = (ctx: string) => images.filter(i => i.context === ctx).map(i => i.src).filter(Boolean);
  const heroImgs = byCtx('hero').concat(byCtx('background'));
  const galleryImgs = byCtx('gallery');
  const teamImgs = byCtx('team');
  const logoImgs = byCtx('logo');

  const imageBlock = images.length > 0 ? `
═══ REAL IMAGE URLS — USE THESE EXACTLY IN YOUR JSON OUTPUT ═══
Hero/background images:
  ${heroImgs.slice(0, 3).join('\n  ') || 'none'}
Gallery images:
  ${galleryImgs.slice(0, 10).join('\n  ') || 'none'}
Team/person photos:
  ${teamImgs.slice(0, 5).join('\n  ') || 'none'}
Logo: ${logoImgs[0] || 'none'}
All other images:
  ${images.filter(i => !['hero', 'background', 'gallery', 'team', 'logo'].includes(i.context)).map(i => i.src).slice(0, 10).join('\n  ') || 'none'}

RULE: Use EXACT URLs above. Never invent placeholder URLs. If no image fits a field, use "".
` : '';

  // Build link block
  const ctaLinks = links.filter(l => l.context === 'cta');
  const navLinks2 = links.filter(l => l.context === 'nav');
  const contactLinks = links.filter(l => l.context === 'contact');

  const linkBlock = links.length > 0 ? `
═══ REAL LINKS — USE EXACT HREFS IN CTA FIELDS ═══
Navigation: ${navLinks2.map(l => `${l.text} → ${l.href}`).join(', ') || 'none'}
CTA buttons: ${ctaLinks.map(l => `${l.text} → ${l.href}`).join(', ') || 'none'}
Contact: ${contactLinks.map(l => l.href).join(', ') || 'none'}
Phone: ${content.phoneNumbers.map(p => `tel:${p.replace(/\D/g, '')}`).join(', ') || 'none'}
Email: ${content.emailAddresses.map(e => `mailto:${e}`).join(', ') || 'none'}

RULE: Use real hrefs for all cta_primary_link and cta_secondary_link fields. Never use "#".
` : '';

  const projectTypeHint = `
═══ SOURCE PROJECT TYPE: ${projectType.toUpperCase()} ═══
${projectType === 'react_tsx' || projectType === 'next' ? 'This is a React/TypeScript SPA. Content was extracted from .tsx/.jsx component files.' : ''}${projectType === 'static_html' ? 'This is a static HTML site.' : ''}${projectType === 'vue' ? 'This is a Vue.js app.' : ''}${projectType === 'svelte' ? 'This is a Svelte app.' : ''}
`;

  const userPrompt = `Migrate this existing website into the CWP website_json format with EXACT design fidelity.
${imageBlock}${linkBlock}${projectTypeHint}
═══ COLOR SYSTEM ═══
colorPalette.primary (use for primary_color): ${content.colorPalette.primary.join(', ') || 'not detected'}
colorPalette.background: ${content.colorPalette.background.join(', ') || 'not detected'}
colorPalette.text: ${content.colorPalette.text.join(', ') || 'not detected'}
All detected colors: ${colorList}
${primaryColorHint ? `Admin override color: ${primaryColorHint}` : ''}

═══ TYPOGRAPHY ═══
Detected fonts: ${fontList}
Note: Map to closest CWP font. Preserve heading vs body font roles.

═══ LAYOUT HINTS ═══
${content.layoutHints.join(', ') || 'standard layout'}

═══ DOMINANT SPACING PATTERNS ═══
${content.dominantSpacing.slice(0, 6).map(s => `${s.property}: ${s.value} (used ${s.frequency}x)`).join('\n') || 'not detected'}

═══ CSS RULES SAMPLE (for design reference) ═══
${cssRuleSummary || 'not available'}

═══ INLINE STYLE SAMPLE ═══
${content.inlineStyleSample.slice(0, 10).join('\n') || 'none'}

═══ SITE CONTENT ═══
Title: ${content.title}
Meta Description: ${content.metaDescription}

H1: ${content.h1s.join(' | ') || 'none'}
H2: ${content.h2s.join(' | ') || 'none'}
H3: ${content.h3s.join(' | ') || 'none'}

Navigation (page structure): ${content.navLinks.join(', ') || 'none'}

Key Paragraphs:
${content.paragraphs.slice(0, 15).map((p, i) => `${i + 1}. ${p}`).join('\n')}

List Items (services, features, etc.):
${content.listItems.slice(0, 15).map(l => `- ${l}`).join('\n')}

Phone: ${content.phoneNumbers.join(', ') || 'none'}
Email: ${content.emailAddresses.join(', ') || 'none'}

Raw Text Sample:
${content.rawText.slice(0, 3000)}

Desired Tone: ${tone}

Generate the complete website_json now. Use real content from the source. Primary color must be: ${primaryColorHint || content.colorPalette.primary[0] || content.colors[0] || '#4F46E5'}`;

  const rawText = await generateWithProvider(providerId, userPrompt, DESIGN_PRESERVATION_SYSTEM);

  // Strip accidental markdown fences
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

// ─── Post-AI image validation and fallback ────────────────────────────────────

function validateAndHydrateImages(
  websiteJson: any,
  images: ExtractedImage[],
): any {
  const heroImgs = images.filter(i => ['hero', 'background'].includes(i.context)).map(i => i.src);
  const galleryImgs = images.filter(i => i.context === 'gallery').map(i => i.src);
  const teamImgs = images.filter(i => i.context === 'team').map(i => i.src);
  const logoImgs = images.filter(i => i.context === 'logo').map(i => i.src);
  const allImgs = images.map(i => i.src);

  const isPlaceholder = (url: string): boolean =>
    !url || url === '#' || url === '' ||
    url.includes('placeholder') || url.includes('example.com') ||
    url.includes('via.placeholder') || url.includes('picsum') ||
    url.includes('unsplash.com/photo-15') ||
    url.startsWith('/images/') || url.startsWith('./images/');

  // Fix global fields
  if (isPlaceholder(websiteJson.global?.logo_url)) {
    websiteJson.global.logo_url = logoImgs[0] || '';
  }
  if (isPlaceholder(websiteJson.global?.hero_image_url)) {
    websiteJson.global.hero_image_url = heroImgs[0] || allImgs[0] || '';
  }
  if (isPlaceholder(websiteJson.global?.founder_photo_url)) {
    websiteJson.global.founder_photo_url = teamImgs[0] || '';
  }

  // Walk pages and sections
  for (const page of websiteJson.pages || []) {
    for (const section of page.sections || []) {
      const c = section.content;
      if (!c) continue;

      // Hero background
      if (section.section_type === 'hero' && isPlaceholder(c.background_image_url)) {
        c.background_image_url = heroImgs[0] || '';
      }

      // About/founder photo
      if (section.section_type === 'about' && isPlaceholder(c.image_url)) {
        c.image_url = teamImgs[0] || allImgs.find(u => u.includes('photo') || u.includes('person')) || '';
      }

      // Gallery — hydrate with real gallery images if empty
      if (section.section_type === 'gallery') {
        if (!Array.isArray(c.images) || c.images.length === 0) {
          c.images = galleryImgs
            .concat(allImgs.filter(u => !heroImgs.includes(u) && !teamImgs.includes(u)))
            .slice(0, 12)
            .map(url => ({ url, caption: '', alt: '' }));
        }
      }

      // Services — cycle through real images for placeholder image_urls
      if (Array.isArray(c.services)) {
        c.services.forEach((svc: any, i: number) => {
          if (svc.image_url && isPlaceholder(svc.image_url)) {
            svc.image_url = allImgs[i] || '';
          }
        });
      }
      if (Array.isArray(c.team)) {
        c.team.forEach((member: any, i: number) => {
          if (member.photo_url && isPlaceholder(member.photo_url)) {
            member.photo_url = teamImgs[i] || allImgs[i] || '';
          }
        });
      }
    }
  }

  return websiteJson;
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
    source_type,
    url,
    zip_base64,
    github_url,
    slug: requestedSlug,
    custom_domain,
    premium_features,
    tone = 'Professional',
    primary_color,
    ai_provider = DEFAULT_PROVIDER_ID,
  } = body;

  if (!client_id) return errorResponse('client_id is required.', 400);
  if (!source_type || !['url', 'zip', 'github'].includes(source_type)) {
    return errorResponse('source_type must be "url", "zip", or "github".', 400);
  }
  if (source_type === 'url' && !url) return errorResponse('url is required when source_type is "url".', 400);
  if (source_type === 'zip' && !zip_base64) return errorResponse('zip_base64 is required when source_type is "zip".', 400);
  if (source_type === 'github' && !github_url) return errorResponse('github_url is required when source_type is "github".', 400);

  // Resolve provider config (fall back to default if unknown)
  const providerConfig = AI_PROVIDERS[ai_provider] || AI_PROVIDERS[DEFAULT_PROVIDER_ID];
  const resolvedProviderId = providerConfig.id;

  console.log(`[import-site] client_id=${client_id} source_type=${source_type} ai_provider=${resolvedProviderId} model=${providerConfig.model}`);

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
    let extractedImages: ExtractedImage[] = [];
    let extractedLinks: ExtractedLink[] = [];
    let detectedProjectType: ProjectType = 'unknown';

    if (source_type === 'url') {
      const result = await scrapeUrl(url);
      extractedContent = result.content;
      backendFeatures = result.backendFeatures;
      extractedImages = result.images;
      extractedLinks = result.links;
      detectedProjectType = 'static_html';
    } else if (source_type === 'github') {
      const { bytes: zipBytes, owner, repo, branch } = await fetchGithubZip(github_url);
      const result = await universalExtractZip(zipBytes, { owner, repo, branch });
      extractedContent = result.content;
      backendFeatures = result.backendFeatures;
      extractedImages = result.images;
      extractedLinks = result.links;
      detectedProjectType = result.projectType;
    } else {
      let zipBytes: Uint8Array;
      try {
        const binary = atob(zip_base64);
        zipBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) zipBytes[i] = binary.charCodeAt(i);
      } catch (e: any) {
        throw new Error(`Invalid base64 ZIP data: ${e.message}`);
      }
      const result = await universalExtractZip(zipBytes);
      extractedContent = result.content;
      backendFeatures = result.backendFeatures;
      extractedImages = result.images;
      extractedLinks = result.links;
      detectedProjectType = result.projectType;
    }

    console.log(
      `[import-site] ProjectType=${detectedProjectType} Images=${extractedImages.length} Links=${extractedLinks.length} ` +
      `title="${extractedContent.title}" ` +
      `colors=${extractedContent.colorPalette.primary[0] || extractedContent.colors[0]} ` +
      `fonts=${extractedContent.fonts.join(',')} ` +
      `cssRules=${extractedContent.cssRules.length} ` +
      `layoutHints=${extractedContent.layoutHints.join(',')}`
    );

    // ── 2. Generate website_json via chosen AI provider ───────────────────────
    //
    // Autonomous provisioning mode: when the selected provider is Anthropic-based
    // AND the source site has backend features, run an agentic loop that both
    // creates the needed Supabase infrastructure AND generates the website_json
    // in a single unified conversation.
    const isAnthropicProvider = providerConfig.provider === 'anthropic' ||
      (providerConfig.provider === 'openrouter' && providerConfig.model.startsWith('anthropic/'));
    const useAutonomous = isAnthropicProvider && backendFeatures.length > 0;

    let websiteJson: any;
    try {
      if (useAutonomous) {
        console.log(`[import-site] Using autonomous provisioning for backend features: ${backendFeatures.join(',')}`);

        // Build an enriched prompt for the agentic loop
        const colorList = extractedContent.colorPalette.all.join(', ') || extractedContent.colors.join(', ') || 'not detected';
        const fontList = extractedContent.fonts.join(', ') || 'not detected';
        const autonomousPrompt = `Migrate this website into CWP. It has the following backend features that need Supabase infrastructure: ${backendFeatures.join(', ')}.

DETECTED BACKEND FEATURES:
${backendFeatures.map(f => `- ${f}`).join('\n')}

SITE CONTENT:
Title: ${extractedContent.title}
Colors: ${colorList}
Fonts: ${fontList}
Nav: ${extractedContent.navLinks.join(', ')}
H1s: ${extractedContent.h1s.join(' | ')}
Phone: ${extractedContent.phoneNumbers.join(', ')}
Email: ${extractedContent.emailAddresses.join(', ')}
Primary color: ${primary_color || extractedContent.colorPalette.primary[0] || extractedContent.colors[0] || '#4F46E5'}
Tone: ${tone}

Raw text sample:
${extractedContent.rawText.slice(0, 2000)}

First, provision all required Supabase infrastructure using the available tools. Then call provision_complete with the full website_json.`;

        // Use the actual Anthropic model ID (strip openrouter prefix if needed)
        const anthropicModel = providerConfig.provider === 'openrouter'
          ? providerConfig.model.replace('anthropic/', '')
          : providerConfig.model;

        websiteJson = await generateWithSupabaseAutonomy(
          autonomousPrompt,
          supabaseAdmin,
          client_id,
          anthropicModel,
        );
      } else {
        // Standard non-agentic generation
        websiteJson = await generateWebsiteJson(
          extractedContent,
          tone,
          resolvedProviderId,
          primary_color,
          extractedImages,
          extractedLinks,
          detectedProjectType,
        );
      }
    } catch (e: any) {
      console.error(`[import-site] ${providerConfig.name} generation error:`, e.message);
      await supabaseAdmin
        .from('website_briefs')
        .update({ generation_status: 'error', generation_error: `AI (${providerConfig.name}) error: ${e.message}` })
        .eq('client_id', client_id);
      return errorResponse(`AI (${providerConfig.name}) error: ${e.message}`, 500);
    }

    // ── 3. Validate and hydrate images ────────────────────────────────────────
    websiteJson = validateAndHydrateImages(websiteJson, extractedImages);

    // ── 4. Validate and normalise ─────────────────────────────────────────────
    if (!websiteJson.global || !Array.isArray(websiteJson.pages) || websiteJson.pages.length === 0) {
      await supabaseAdmin
        .from('website_briefs')
        .update({ generation_status: 'error', generation_error: 'AI response was missing required fields.' })
        .eq('client_id', client_id);
      return errorResponse('AI response was missing required fields.', 500);
    }

    // Ensure global fallbacks — prefer extracted palette over AI guess
    websiteJson.global.phone = websiteJson.global.phone || extractedContent.phoneNumbers[0] || '';
    websiteJson.global.primary_color =
      primary_color ||
      extractedContent.colorPalette.primary[0] ||
      websiteJson.global.primary_color ||
      extractedContent.colors[0] ||
      '#4F46E5';
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

    // ── 5. Determine slug ─────────────────────────────────────────────────────
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

    // ── 6. Save to website_briefs ─────────────────────────────────────────────
    const businessName = websiteJson.global.business_name || extractedContent.title || 'Imported Site';
    const navText = extractedContent.navLinks.join(', ');

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
      `[import-site] Success client_id=${client_id} slug="${clientSlug}" ` +
      `pages=${websiteJson.pages.length} provider=${resolvedProviderId} ` +
      `backend_features=${backendFeatures.join(',')}`
    );

    return jsonResponse({
      success: true,
      client_slug: clientSlug,
      website_json: websiteJson,
      backend_features: backendFeatures,
      pages_imported: websiteJson.pages.length,
      business_name: businessName,
      ai_provider: resolvedProviderId,
      ai_model: providerConfig.model,
      autonomous_provisioning: useAutonomous,
      project_type: detectedProjectType,
      images_found: extractedImages.length,
      links_found: extractedLinks.length,
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
