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

// ─── Detect all image slots from user message ─────────────────────────────────

interface ImageSlot {
  fieldPath: string;       // JSON path in website_json
  section: string;         // section type for logging
  searchQuery: string;     // what to search on Pexels/Unsplash
  pageIdx: number;
  sectionIdx: number;
}

function detectAllImageSlots(
  message: string,
  websiteJson: any,
  businessName: string,
  industry: string
): { wantsImages: boolean; slots: ImageSlot[] } {
  const wantsImages = /\b(image|photo|picture|banner|background|visual|stock|unsplash|pexels|add.*img|place.*image|hero image|use.*photo|wealth picture|add.*picture|put.*picture|put.*image|place.*picture|all.*image|image.*section|everywhere)\b/i.test(message);
  if (!wantsImages) return { wantsImages: false, slots: [] };

  const pages = websiteJson?.pages || [];
  const slots: ImageSlot[] = [];

  // Determine scope: "all sections" vs specific section
  const wantsAll = /\ball\b|\beverywhere\b|\beach\b|\bevery section\b|\ball image\b|\ball.*section/i.test(message);
  const wantsHeroOnly = !wantsAll && /\bhero\b|\bbanner\b|\btop\b/i.test(message);
  const wantsAboutOnly = !wantsAll && /\babout\b|\bfounder\b|\bteam\b/i.test(message);

  // Build search context from message
  const quotedMatch = message.match(/["']([^"']+)["']/);
  const baseQuery = quotedMatch
    ? quotedMatch[1]
    : message
        .replace(/add|place|put|use|find|get|show|insert|a|an|the|image|photo|picture|stock|background|in|for|section|please|all|every|everywhere|relevant|professional|high.quality/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50);

  const fallbackQuery = baseQuery.length >= 6
    ? baseQuery
    : `${industry} ${businessName} professional`;

  pages.forEach((page: any, pi: number) => {
    (page.sections || []).forEach((section: any, si: number) => {
      const type = section.section_type;
      const variant = section.variant || '';

      // hero sections
      if (type === 'hero') {
        if (wantsAll || wantsHeroOnly) {
          const isSplit = variant.includes('split_image');
          const field = isSplit ? 'image_url' : 'background_image_url';
          const existing = section.content?.[field];
          if (!existing || wantsAll) {
            slots.push({
              fieldPath: `pages[${pi}].sections[${si}].content.${field}`,
              section: `hero (${page.id})`,
              searchQuery: `${fallbackQuery} hero banner professional`,
              pageIdx: pi,
              sectionIdx: si,
            });
            // Also set background_style for non-split heroes
            if (!isSplit) {
              slots.push({
                fieldPath: `pages[${pi}].sections[${si}].content.background_style`,
                section: `hero_style`,
                searchQuery: '',  // style marker, not a photo search
                pageIdx: pi,
                sectionIdx: si,
              });
            }
          }
        }
      }

      // about sections
      if (type === 'about') {
        if (wantsAll || wantsAboutOnly) {
          const existing = section.content?.image_url;
          if (!existing || wantsAll) {
            slots.push({
              fieldPath: `pages[${pi}].sections[${si}].content.image_url`,
              section: `about (${page.id})`,
              searchQuery: `${industry} professional advisor consultation`,
              pageIdx: pi,
              sectionIdx: si,
            });
          }
        }
      }

      // gallery sections
      if (type === 'gallery' && wantsAll) {
        const images = section.content?.images || [];
        images.forEach((_: any, imgIdx: number) => {
          slots.push({
            fieldPath: `pages[${pi}].sections[${si}].content.images[${imgIdx}].url`,
            section: `gallery (${page.id})`,
            searchQuery: `${fallbackQuery} gallery`,
            pageIdx: pi,
            sectionIdx: si,
          });
        });
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

    // ── Image placement: detect all slots that need images ────────────────────
    let placedPhotos: { slot: ImageSlot; photo: StockPhoto }[] = [];
    let updatedJson: any = website_json ? JSON.parse(JSON.stringify(website_json)) : null;

    if (website_json) {
      const { wantsImages, slots } = detectAllImageSlots(
        userMessage, website_json, business_name || '', industry || ''
      );

      if (wantsImages && slots.length > 0) {
        const photoSlots = slots.filter(s => s.searchQuery !== '');
        const styleSlots = slots.filter(s => s.searchQuery === '');

        for (const slot of photoSlots) {
          const photo = await findStockPhoto(slot.searchQuery);
          if (photo && updatedJson) {
            updatedJson = setByPath(updatedJson, slot.fieldPath, photo.url);
            placedPhotos.push({ slot, photo });
          }
        }

        // Apply dark style to all non-split hero sections that got images
        for (const slot of styleSlots) {
          updatedJson = setByPath(updatedJson, slot.fieldPath, 'dark');
        }

        // Save to DB if any images were placed
        if (placedPhotos.length > 0 && client_id) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
          await supabase
            .from('website_briefs')
            .update({ website_json: updatedJson })
            .eq('client_id', client_id);
        }
      }
    }

    const anyImagePlaced = placedPhotos.length > 0;

    // ── Step 3b: If no image intent, check for text/style edit intent ────────
    let imageContext = '';
    if (!anyImagePlaced && website_json && client_id) {
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
    if (anyImagePlaced) {
      const summary = placedPhotos.map(({ slot, photo }) =>
        `• ${slot.section}: ${photo.credit}`
      ).join('\n');
      imageContext = `\n\nACTION COMPLETED: Placed ${placedPhotos.length} real stock photo(s) automatically:\n${summary}\nAll sections updated and saved. Confirm in 1-2 sentences what was done.`;
    } else if (/\b(image|photo|picture)\b/i.test(userMessage)) {
      imageContext = `\n\nNOTE: No matching image sections found, or photos unavailable. Tell the user to try the Media tab to upload their own images.`;
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
      image_placed: anyImagePlaced,
      images_placed_count: placedPhotos.length,
      photos: placedPhotos.map(({ slot, photo }) => ({
        section: slot.section,
        url: photo.url,
        thumb: photo.thumb,
        credit: photo.credit,
        source: photo.source,
      })),
      updated_json: updatedJson,
    });

  } catch (error: any) {
    console.error("[website-chat] Error:", error.message);
    return errorResponse(error.message || "Internal server error", 500);
  }
});

export const config = { auth: false };
