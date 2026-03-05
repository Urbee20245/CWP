// ─── AI Provider Abstraction Layer ───────────────────────────────────────────
// Supports Anthropic (Claude), Google (Gemini), DeepSeek, OpenRouter, and OpenAI
// OpenRouter is recommended: single API key, access to all models, built-in fallback.

export interface AIProviderConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'google' | 'deepseek' | 'openrouter' | 'openai';
  /** The model identifier used by the provider's API */
  model: string;
  maxTokens: number;
  /** USD cost per 1 million input tokens */
  costPer1MInput: number;
  /** USD cost per 1 million output tokens */
  costPer1MOutput: number;
  /** Whether this model accepts image/screenshot input */
  supportsVision: boolean;
}

export const AI_PROVIDERS: Record<string, AIProviderConfig> = {
  'claude-opus-4-5': {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    model: 'claude-opus-4-5',
    maxTokens: 8192,
    costPer1MInput: 15.00,
    costPer1MOutput: 75.00,
    supportsVision: true,
  },
  'claude-sonnet-4-5': {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    maxTokens: 8192,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    supportsVision: true,
  },
  'gemini-2-flash': {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    model: 'gemini-2.0-flash',
    maxTokens: 8192,
    costPer1MInput: 0.00,
    costPer1MOutput: 0.00,
    supportsVision: true,
  },
  'gemini-2-flash-lite': {
    id: 'gemini-2-flash-lite',
    name: 'Gemini 2.0 Flash-Lite',
    provider: 'google',
    model: 'gemini-2.0-flash-lite',
    maxTokens: 8192,
    costPer1MInput: 0.00,
    costPer1MOutput: 0.00,
    supportsVision: true,
  },
  'gemini-2-pro': {
    id: 'gemini-2-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'google',
    model: 'gemini-2.0-pro-exp',
    maxTokens: 8192,
    costPer1MInput: 0.00,
    costPer1MOutput: 0.00,
    supportsVision: true,
  },
  'gemini-1-5-flash': {
    id: 'gemini-1-5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    model: 'gemini-1.5-flash',
    maxTokens: 8192,
    costPer1MInput: 0.00,
    costPer1MOutput: 0.00,
    supportsVision: true,
  },
  'gemini-1-5-pro': {
    id: 'gemini-1-5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    model: 'gemini-1.5-pro',
    maxTokens: 8192,
    costPer1MInput: 1.25,
    costPer1MOutput: 5.00,
    supportsVision: true,
  },
  'deepseek-v3': {
    id: 'deepseek-v3',
    name: 'DeepSeek v3',
    provider: 'deepseek',
    model: 'deepseek-chat',
    maxTokens: 8192,
    costPer1MInput: 0.27,
    costPer1MOutput: 1.10,
    supportsVision: false,
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    model: 'gpt-4-turbo',
    maxTokens: 8192,
    costPer1MInput: 10.00,
    costPer1MOutput: 30.00,
    supportsVision: true,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 8192,
    costPer1MInput: 5.00,
    costPer1MOutput: 15.00,
    supportsVision: true,
  },
  // ── Gemini 3 series ──
  'gemini-3-flash': {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'google',
    model: 'gemini-3-flash-preview',
    maxTokens: 8192,
    costPer1MInput: 0.00,
    costPer1MOutput: 0.00,
    supportsVision: true,
  },
  'gemini-3-1-flash-lite': {
    id: 'gemini-3-1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    provider: 'google',
    model: 'gemini-3.1-flash-lite-preview',
    maxTokens: 8192,
    costPer1MInput: 0.00,
    costPer1MOutput: 0.00,
    supportsVision: true,
  },
  'gemini-3-1-pro': {
    id: 'gemini-3-1-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'google',
    model: 'gemini-3.1-pro-preview',
    maxTokens: 8192,
    costPer1MInput: 1.25,
    costPer1MOutput: 5.00,
    supportsVision: true,
  },
  // ── OpenAI latest ──
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 8192,
    costPer1MInput: 0.15,
    costPer1MOutput: 0.60,
    supportsVision: true,
  },
  'gpt-4-1': {
    id: 'gpt-4-1',
    name: 'GPT-4.1',
    provider: 'openai',
    model: 'gpt-4.1',
    maxTokens: 8192,
    costPer1MInput: 2.00,
    costPer1MOutput: 8.00,
    supportsVision: true,
  },
  'gpt-4-1-mini': {
    id: 'gpt-4-1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    maxTokens: 8192,
    costPer1MInput: 0.40,
    costPer1MOutput: 1.60,
    supportsVision: true,
  },
  'o4-mini': {
    id: 'o4-mini',
    name: 'o4 Mini',
    provider: 'openai',
    model: 'o4-mini',
    maxTokens: 8192,
    costPer1MInput: 1.10,
    costPer1MOutput: 4.40,
    supportsVision: true,
  },
  'o3': {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    model: 'o3',
    maxTokens: 8192,
    costPer1MInput: 10.00,
    costPer1MOutput: 40.00,
    supportsVision: true,
  },
  // OpenRouter variants — same models routed through openrouter.ai (one API key for all)
  'or-claude-opus-4-5': {
    id: 'or-claude-opus-4-5',
    name: 'Claude Opus 4.5 (via OpenRouter)',
    provider: 'openrouter',
    model: 'anthropic/claude-opus-4-5',
    maxTokens: 8192,
    costPer1MInput: 15.00,
    costPer1MOutput: 75.00,
    supportsVision: true,
  },
  'or-claude-sonnet-4-5': {
    id: 'or-claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5 (via OpenRouter)',
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4-5',
    maxTokens: 8192,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00,
    supportsVision: true,
  },
  'or-gemini-2-flash': {
    id: 'or-gemini-2-flash',
    name: 'Gemini 2.0 Flash (via OpenRouter)',
    provider: 'openrouter',
    model: 'google/gemini-2.0-flash-exp',
    maxTokens: 8192,
    costPer1MInput: 0.00,
    costPer1MOutput: 0.00,
    supportsVision: true,
  },
  'or-deepseek-v3': {
    id: 'or-deepseek-v3',
    name: 'DeepSeek v3 (via OpenRouter)',
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat',
    maxTokens: 8192,
    costPer1MInput: 0.27,
    costPer1MOutput: 1.10,
    supportsVision: false,
  },
  // ── OpenRouter — Gemini 3 & latest OpenAI ──
  'or-gemini-3-flash': {
    id: 'or-gemini-3-flash',
    name: 'Gemini 3 Flash (via OpenRouter)',
    provider: 'openrouter',
    model: 'google/gemini-3-flash-preview',
    maxTokens: 8192,
    costPer1MInput: 0.00,
    costPer1MOutput: 0.00,
    supportsVision: true,
  },
  'or-gpt-4o': {
    id: 'or-gpt-4o',
    name: 'GPT-4o (via OpenRouter)',
    provider: 'openrouter',
    model: 'openai/gpt-4o',
    maxTokens: 8192,
    costPer1MInput: 5.00,
    costPer1MOutput: 15.00,
    supportsVision: true,
  },
  'or-gpt-4-1': {
    id: 'or-gpt-4-1',
    name: 'GPT-4.1 (via OpenRouter)',
    provider: 'openrouter',
    model: 'openai/gpt-4.1',
    maxTokens: 8192,
    costPer1MInput: 2.00,
    costPer1MOutput: 8.00,
    supportsVision: true,
  },
  'or-o4-mini': {
    id: 'or-o4-mini',
    name: 'o4 Mini (via OpenRouter)',
    provider: 'openrouter',
    model: 'openai/o4-mini',
    maxTokens: 8192,
    costPer1MInput: 1.10,
    costPer1MOutput: 4.40,
    supportsVision: true,
  },
  'or-gpt-4o-mini': {
    id: 'or-gpt-4o-mini',
    name: 'GPT-4o Mini (via OpenRouter)',
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    maxTokens: 8192,
    costPer1MInput: 0.15,
    costPer1MOutput: 0.60,
    supportsVision: true,
  },
};

/** Default provider when none is specified */
export const DEFAULT_PROVIDER_ID = 'claude-opus-4-5';

// ─── Provider call functions ──────────────────────────────────────────────────

/**
 * Call Anthropic Claude via its native SDK.
 * Requires ANTHROPIC_API_KEY env variable.
 */
export async function callAnthropic(
  model: string,
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 8192,
): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return (data.content?.[0]?.text || '').trim();
}

/**
 * Call Google Gemini via the generativelanguage REST API.
 * Requires GOOGLE_AI_API_KEY env variable.
 */
export async function callGemini(
  model: string,
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 8192,
): Promise<string> {
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not configured.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Google AI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}

/**
 * Call DeepSeek via its OpenAI-compatible API.
 * Requires DEEPSEEK_API_KEY env variable.
 */
export async function callDeepSeek(
  model: string,
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 8192,
): Promise<string> {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured.');

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

/**
 * Call any model via OpenRouter's unified API.
 * Requires OPENROUTER_API_KEY env variable.
 * OpenRouter is recommended for multi-model access — one key, all providers.
 */
export async function callOpenRouter(
  model: string,
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 8192,
): Promise<string> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://cwp.app';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': supabaseUrl,
      'X-Title': 'CWP Website Builder',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

/**
 * Call OpenAI via its chat completions API.
 * Requires OPENAI_API_KEY env variable.
 */
export async function callOpenAI(
  model: string,
  userPrompt: string,
  systemPrompt: string,
  maxTokens = 8192,
): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

/**
 * Route a generation request to the correct provider based on config.
 * Falls back to Anthropic Claude Opus 4.5 if the provider is unknown.
 */
export async function generateWithProvider(
  providerId: string,
  userPrompt: string,
  systemPrompt: string,
): Promise<string> {
  const config = AI_PROVIDERS[providerId] || AI_PROVIDERS[DEFAULT_PROVIDER_ID];

  console.log(`[ai-providers] Using provider=${config.provider} model=${config.model}`);

  switch (config.provider) {
    case 'anthropic':
      return callAnthropic(config.model, userPrompt, systemPrompt, config.maxTokens);
    case 'google':
      return callGemini(config.model, userPrompt, systemPrompt, config.maxTokens);
    case 'deepseek':
      return callDeepSeek(config.model, userPrompt, systemPrompt, config.maxTokens);
    case 'openrouter':
      return callOpenRouter(config.model, userPrompt, systemPrompt, config.maxTokens);
    case 'openai':
      return callOpenAI(config.model, userPrompt, systemPrompt, config.maxTokens);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
