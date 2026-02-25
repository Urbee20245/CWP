import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";
import { generateWithProvider } from "../_shared/ai-providers.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const { system, messages, provider } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return errorResponse("messages array is required", 400);
    }
    let reply: string;
    if (provider && provider !== "claude-haiku-4-5") {
      const conversationText = (messages as Array<{ role: string; content: string }>)
        .map(m => (m.role === "user" ? "User" : "Assistant") + ": " + m.content)
        .join("\n\n");
      reply = await generateWithProvider(provider, conversationText, system || "");
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
          system: system || "",
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
    return jsonResponse({ reply });
  } catch (error: any) {
    console.error("[website-chat] Error:", error.message);
    return errorResponse(error.message || "Internal server error", 500);
  }
});
