import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";
import { generateWithProvider } from "../_shared/ai-providers.ts";

const ANTHROPIC_API_KEY       = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const UNSPLASH_ACCESS_KEY     = Deno.env.get("UNSPLASH_ACCESS_KEY") ?? "";
const PEXELS_API_KEY          = Deno.env.get("PEXELS_API_KEY") ?? "";
const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Image search ─────────────────────────────────────────────────────────────

interface StockPhoto {
  url: string;       // full-size URL
  thumb: string;     // thumbnail
  credit: string;    // "Photo by X on Unsplash"
  source: string;    // "unsplash" | "pexels"
}

async function searchUnsplash(query: string): Promise<StockPhoto | null> {
  if (!UNSPLASH_ACCESS_KEY) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;
    return {
      url:    photo.urls.regular,   // ~1080px wide, free to use
      thumb:  photo.urls.small,
      credit: `Photo by ${photo.user.name} on Unsplash`,
      source: "unsplash",
    };
  } catch { return null; }
}

async function searchPexels(query: string): Promise<StockPhoto | null> {
  if (!PEXELS_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return null;
    return {
      url:    photo.src.large2x,    // ~2x large
      thumb:  photo.src.medium,
      credit: `Photo by ${photo.photographer} on Pexels`,
      source: "pexels",
    };
  } catch { return null; }
}

async function findStockPhoto(query: string): Promise<StockPhoto | null> {
  // Try Unsplash first, fall back to Pexels
  const unsplash = await searchUnsplash(query);
  if (unsplash) return unsplash;
  return await searchPexels(query);
}

// ─── Detect image intent from user message ────────────────────────────────────

interface ImageIntent {
  detected: boolean;
  section: string;         // "hero" | "about" | "gallery" | "services" | "global"
  fieldPath: string;       // JSON path into website_json to update
  searchQuery: string;     // what to search for
}

function detectImageIntent(
  message: string,
  websiteJson: any,
  businessName: string,
  industry: string
): ImageIntent {
  const m = message.toLowerCase();

  // Does the message ask for an image?
  const wantsImage = /\b(image|photo|picture|banner|background|visual|stock photo|unsplash|pexels|add.*img|place.*image|hero image|use.*photo)\b/i.test(message);
  if (!wantsImage) return { detected: false, section: '', fieldPath: '', searchQuery: '' };

  // Determine which section
  let section = 'hero';
  let fieldPath = '';

  if (/\bhero\b|\bbanner\b|\btop.*section\b|\bheader.*image\b/i.test(m)) {
    section = 'hero';
    // Find the hero section index in website_json
    const pages = websiteJson?.pages || [];
    const homePage = pages.find((p: any) => p.id === 'home' || p.slug === '') || pages[0];
    const heroIdx = homePage?.sections?.findIndex((s: any) => s.section_type === 'hero') ?? 0;
    fieldPath = `pages[0].sections[${heroIdx}].content.background_image_url`;
  } else if (/\babout\b|\bfounder\b|\bteam\b|\bstaff\b/i.test(m)) {
    section = 'about';
    const pages = websiteJson?.pages || [];
    const homePage = pages.find((p: any) => p.id === 'home') || pages[0];
    const aboutIdx = homePage?.sections?.findIndex((s: any) => s.section_type === 'about') ?? -1;
    if (aboutIdx >= 0) fieldPath = `pages[0].sections[${aboutIdx}].content.image_url`;
  } else if (/\bglobal\b|\blogo\b/i.test(m)) {
    section = 'global';
    fieldPath = 'global.hero_image_url';
  }

  if (!fieldPath) {
    // Default: hero background
    const pages = websiteJson?.pages || [];
    const homePage = pages.find((p: any) => p.id === 'home' || p.slug === '') || pages[0];
    const heroIdx = homePage?.sections?.findIndex((s: any) => s.section_type === 'hero') ?? 0;
    fieldPath = `pages[0].sections[${Math.max(0, heroIdx)}].content.background_image_url`;
  }

  // Build search query from message context
  // Extract quoted keywords if present, otherwise use message + business context
  const quotedMatch = message.match(/["']([^"']+)["']/);
  let searchQuery = '';
  if (quotedMatch) {
    searchQuery = quotedMatch[1];
  } else {
    // Strip common filler words and use the rest as search terms
    searchQuery = message
      .replace(/add|place|put|use|find|get|show|insert|a|an|the|image|photo|picture|stock|background|in|for|the|section|please|relevant|professional|high.quality/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    // Append business context if short
    if (searchQuery.length < 10) {
      searchQuery = `${industry} ${businessName} professional`;
    }
  }

  return { detected: true, section, fieldPath, searchQuery };
}

// ─── Apply image to website_json ──────────────────────────────────────────────

function setByPath(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const parts = path.split(/[\.\[\]]+/).filter(Boolean);
  let cursor: any = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = isNaN(Number(parts[i])) ? parts[i] : Number(parts[i]);
    cursor = cursor[key];
    if (cursor === undefined || cursor === null) return clone;
  }
  const last = isNaN(Number(parts[parts.length - 1])) ? parts[parts.length - 1] : Number(parts[parts.length - 1]);
  cursor[last] = value;
  return clone;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { system, messages, provider, client_id, website_json, business_name, industry } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return errorResponse("messages array is required", 400);
    }

    const userMessage = messages[messages.length - 1]?.content || "";

    // ── Step 1: Detect if user wants an image placed ─────────────────────────
    const imageIntent = website_json
      ? detectImageIntent(userMessage, website_json, business_name || "", industry || "")
      : { detected: false, section: '', fieldPath: '', searchQuery: '' };

    let photo: StockPhoto | null = null;
    let updatedJson: any = null;

    if (imageIntent.detected && imageIntent.fieldPath) {
      // ── Step 2: Fetch the image ───────────────────────────────────────────
      photo = await findStockPhoto(imageIntent.searchQuery);

      if (photo && client_id) {
        // ── Step 3: Apply it to website_json and save to DB ────────────────
        updatedJson = setByPath(website_json, imageIntent.fieldPath, photo.url);

        // Also set background_style to "dark" for hero images (for overlay)
        if (imageIntent.section === 'hero' && imageIntent.fieldPath.includes('background_image_url')) {
          const stylePath = imageIntent.fieldPath.replace('background_image_url', 'background_style');
          updatedJson = setByPath(updatedJson, stylePath, 'dark');
        }

        // Save to Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
        await supabase
          .from('website_briefs')
          .update({ website_json: updatedJson })
          .eq('client_id', client_id);
      }
    }

    // ── Step 4: Get AI reply ─────────────────────────────────────────────────
    let imageContext = '';
    if (photo) {
      imageContext = `\n\nACTION TAKEN: You found and placed a real stock photo automatically.
Image URL: ${photo.url}
Credit: ${photo.credit}
Applied to: ${imageIntent.section} section background
The website has been updated in the database.`;
    } else if (imageIntent.detected) {
      imageContext = `\n\nNOTE: You tried to find a stock photo for "${imageIntent.searchQuery}" but no results were found. Tell the user and suggest they upload their own image via the Media tab.`;
    }

    const enrichedSystem = (system || "") + imageContext;

    let reply: string;
    if (provider && provider !== "claude-haiku-4-5") {
      const conversationText = (messages as Array<{ role: string; content: string }>)
        .map(m => (m.role === "user" ? "User" : "Assistant") + ": " + m.content)
        .join("\n\n");
      reply = await generateWithProvider(provider, conversationText, enrichedSystem);
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 512,
          system: enrichedSystem,
          messages,
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error("Anthropic API error " + response.status + ": " + err);
      }
      const data = await response.json();
      reply = data.content?.[0]?.text || "";
    }

    return jsonResponse({
      reply,
      image_placed: !!photo,
      photo: photo ? { url: photo.url, thumb: photo.thumb, credit: photo.credit, source: photo.source } : null,
      updated_json: updatedJson,
      field_path: imageIntent.fieldPath || null,
    });

  } catch (error: any) {
    console.error("[website-chat] Error:", error.message);
    return errorResponse(error.message || "Internal server error", 500);
  }
});

export const config = { auth: false };
