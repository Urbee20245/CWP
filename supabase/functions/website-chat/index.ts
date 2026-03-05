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

// ─── Detect ALL image slots that need photos ──────────────────────────────────

interface ImageSlot {
  fieldPath: string;
  section: string;
  searchQuery: string;
  isStyleMarker?: boolean; // true = set a string value, don't fetch a photo
}

function detectImageSlots(
  message: string,
  websiteJson: any,
  businessName: string,
  industry: string
): { wantsImages: boolean; slots: ImageSlot[] } {
  const wantsImages = /\b(image|photo|picture|banner|background|visual|stock|unsplash|pexels|add.*img|place.*image|hero image|use.*photo|wealth picture|add.*picture|put.*picture|put.*image|place.*picture)\b/i.test(message);
  if (!wantsImages) return { wantsImages: false, slots: [] };

  const wantsAll = /\ball\b|\beverywhere\b|\beach section\b|\bevery section\b|\ball.*section\b|\ball.*image\b|\ball.*photo\b/i.test(message);
  const wantsHeroOnly = !wantsAll && /\bhero\b|\bbanner\b|\btop\b/i.test(message);
  const wantsAboutOnly = !wantsAll && !wantsHeroOnly;

  // Build search query from message
  const quoted = message.match(/["']([^"']+)["']/);
  const baseQuery = quoted
    ? quoted[1]
    : message
        .replace(/add|place|put|use|find|get|show|insert|a|an|the|image|photo|picture|stock|background|in|for|section|please|all|every|everywhere|relevant|professional|high.quality/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50);
  const fallback = baseQuery.length >= 6 ? baseQuery : `${industry} ${businessName} professional`;

  const pages = websiteJson?.pages || [];
  const slots: ImageSlot[] = [];

  pages.forEach((page: any, pi: number) => {
    (page.sections || []).forEach((section: any, si: number) => {
      const type = section.section_type;
      const variant = section.variant || '';
      const content = section.content || {};

      // HERO sections
      if (type === 'hero' && (wantsAll || wantsHeroOnly)) {
        const isSplit = variant === 'split_image_left' || variant === 'split_image_right';
        if (isSplit) {
          if (!content.image_url || wantsAll) {
            slots.push({
              fieldPath: `pages[${pi}].sections[${si}].content.image_url`,
              section: `hero (${page.id})`,
              searchQuery: `${fallback} professional`,
            });
          }
        } else {
          if (!content.background_image_url || wantsAll) {
            slots.push({
              fieldPath: `pages[${pi}].sections[${si}].content.background_image_url`,
              section: `hero (${page.id})`,
              searchQuery: `${fallback} professional`,
            });
            slots.push({
              fieldPath: `pages[${pi}].sections[${si}].content.background_style`,
              section: `hero_style`,
              searchQuery: 'dark',
              isStyleMarker: true,
            });
          }
        }
      }

      // ABOUT sections use content.image_url
      if (type === 'about' && (wantsAll || wantsAboutOnly)) {
        if (!content.image_url || wantsAll) {
          slots.push({
            fieldPath: `pages[${pi}].sections[${si}].content.image_url`,
            section: `about (${page.id})`,
            searchQuery: `${industry} professional advisor consultation portrait`,
          });
        }
      }
    });
  });

  return { wantsImages: true, slots };
}

// ─── Detect text/style edit intent ───────────────────────────────────────────

interface EditIntent {
  detected: boolean;
  type: 'text' | 'color' | 'section_add' | 'section_remove' | 'style';
  instructions: string;
}

function detectEditIntent(message: string): EditIntent {
  const isEdit = /\b(change|update|make|set|replace|edit|modify|rewrite|rename|turn|switch|move)\b/i.test(message);
  if (!isEdit) return { detected: false, type: 'text', instructions: '' };

  if (/\bcolor\b|\btheme\b|\bpalette\b/i.test(message))
    return { detected: true, type: 'color', instructions: message };
  if (/\badd.*section\b|\badd.*page\b|\bnew.*section\b/i.test(message))
    return { detected: true, type: 'section_add', instructions: message };

  return { detected: true, type: 'text', instructions: message };
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

    // ── Detect and place images across ALL matching sections ──────────────────
    const { wantsImages, slots } = website_json
      ? detectImageSlots(userMessage, website_json, business_name || '', industry || '')
      : { wantsImages: false, slots: [] };

    let placedCount = 0;
    let updatedJson: any = website_json ? JSON.parse(JSON.stringify(website_json)) : null;
    const placedSections: string[] = [];

    if (wantsImages && slots.length > 0 && updatedJson) {
      for (const slot of slots) {
        if (slot.isStyleMarker) {
          updatedJson = setByPath(updatedJson, slot.fieldPath, slot.searchQuery);
        } else {
          const photo = await findStockPhoto(slot.searchQuery);
          if (photo) {
            updatedJson = setByPath(updatedJson, slot.fieldPath, photo.url);
            placedSections.push(slot.section);
            placedCount++;
          }
        }
      }

      if (placedCount > 0 && client_id) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
        await supabase
          .from('website_briefs')
          .update({ website_json: updatedJson })
          .eq('client_id', client_id);
      }
    }

    // ── Step 3b: If no image intent, check for text/style edit intent ────────
    let imageContext = '';
    if (placedCount === 0 && website_json && client_id) {
      const editIntent = detectEditIntent(userMessage);
      if (editIntent.detected) {
        try {
          const editResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5",
              max_tokens: 4096,
              system: `You are a website editor. The user wants to edit their website.
Apply the requested change to the website JSON and return ONLY the modified JSON.
No markdown, no explanation, just the updated JSON object.`,
              messages: [
                {
                  role: "user",
                  content: `Current website JSON:\n${JSON.stringify(website_json)}\n\nUser request: ${userMessage}\n\nReturn the complete updated website JSON with the change applied.`,
                },
              ],
            }),
          });

          if (editResponse.ok) {
            const editData = await editResponse.json();
            const editText = editData.content?.[0]?.text || "";
            try {
              const cleaned = editText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
              updatedJson = JSON.parse(cleaned);

              const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
              await supabase.from('website_briefs')
                .update({ website_json: updatedJson })
                .eq('client_id', client_id);

              imageContext = `\n\nACTION COMPLETED: The website has been updated based on the user's request. Confirm in ONE sentence what changed.`;
            } catch (_parseErr) {
              // JSON parse failed — fall through to normal chat response
            }
          }
        } catch (_editErr) {
          // Edit attempt failed — fall through to normal chat
        }
      }
    }

    // ── Step 4: Get AI reply ─────────────────────────────────────────────────
    if (placedCount > 0) {
      imageContext = `\n\nACTION COMPLETED: Placed ${placedCount} real stock photo(s) in: ${placedSections.join(', ')}. Website saved. Confirm in one sentence.`;
    } else if (wantsImages) {
      imageContext = `\n\nNOTE: Could not place images (no matching sections found, or stock photo search failed). Tell the user to try the Media tab to upload their own images.`;
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
      image_placed: placedCount > 0,
      images_placed_count: placedCount,
      updated_json: updatedJson,
    });

  } catch (error: any) {
    console.error("[website-chat] Error:", error.message);
    return errorResponse(error.message || "Internal server error", 500);
  }
});

export const config = { auth: false };
