// ─── Shared AI Provider Options ───────────────────────────────────────────────
// Used by both AdminSiteImport and AdminWebsiteBuilder.
// Keep IDs in sync with supabase/functions/_shared/ai-providers.ts

export interface AIProviderOption {
  id: string;
  label: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  /** True when this option routes through openrouter.ai */
  viaOpenRouter?: boolean;
  /** UI section grouping */
  section: 'free' | 'paid' | 'openrouter';
  /** Sort order within section (lower = shown first) */
  tier: number;
}

export const AI_PROVIDER_OPTIONS: AIProviderOption[] = [
  // ═══════════════════════════════════════════════════════
  // FREE TIER
  // ═══════════════════════════════════════════════════════
  {
    id: 'gemini-3-flash',
    label: 'Gemini 3 Flash',
    description: 'Latest Google — Pro-grade reasoning at Flash speed',
    badge: 'FREE',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    section: 'free',
    tier: 5,
  },
  {
    id: 'gemini-3-1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    description: 'Fastest & cheapest Gemini 3 model',
    badge: 'FREE',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    section: 'free',
    tier: 6,
  },
  {
    id: 'gemini-2-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Google — free tier, fast and reliable',
    badge: 'FREE',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    section: 'free',
    tier: 10,
  },
  {
    id: 'gemini-2-flash-lite',
    label: 'Gemini 2.0 Flash-Lite',
    description: 'Google — fastest free option, great for simple sites',
    badge: 'FREE',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    section: 'free',
    tier: 11,
  },
  {
    id: 'gemini-1-5-flash',
    label: 'Gemini 1.5 Flash',
    description: 'Google — stable free tier model',
    badge: 'FREE',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    section: 'free',
    tier: 12,
  },
  // ═══════════════════════════════════════════════════════
  // PAID — LOW TO HIGH
  // ═══════════════════════════════════════════════════════
  {
    id: 'deepseek-v3',
    label: 'DeepSeek v3',
    description: 'Ultra cost-effective — great for content-heavy sites',
    badge: '$0.27/1M',
    badgeColor: 'bg-sky-100 text-sky-700',
    section: 'paid',
    tier: 10,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'OpenAI — fast and affordable with vision support',
    badge: '$0.15/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'paid',
    tier: 11,
  },
  {
    id: 'gpt-4-1-mini',
    label: 'GPT-4.1 Mini',
    description: 'OpenAI — latest mini model, great value',
    badge: '$0.40/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'paid',
    tier: 12,
  },
  {
    id: 'gemini-1-5-pro',
    label: 'Gemini 1.5 Pro',
    description: 'Google — strong vision and long context',
    badge: '$1.25/1M',
    badgeColor: 'bg-teal-100 text-teal-700',
    section: 'paid',
    tier: 20,
  },
  {
    id: 'gemini-2-pro',
    label: 'Gemini 2.0 Pro',
    description: 'Google — advanced visual understanding',
    badge: '$1.25/1M',
    badgeColor: 'bg-teal-100 text-teal-700',
    section: 'paid',
    tier: 21,
  },
  {
    id: 'gemini-3-1-pro',
    label: 'Gemini 3.1 Pro',
    description: 'Most advanced Gemini — best reasoning & multimodal',
    badge: '$1.25/1M',
    badgeColor: 'bg-teal-100 text-teal-700',
    section: 'paid',
    tier: 22,
  },
  {
    id: 'o4-mini',
    label: 'o4 Mini',
    description: 'OpenAI reasoning model — great for complex layouts',
    badge: '$1.10/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'paid',
    tier: 23,
  },
  {
    id: 'gpt-4-1',
    label: 'GPT-4.1',
    description: 'OpenAI latest — strong coding & layout analysis',
    badge: '$2/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'paid',
    tier: 30,
  },
  {
    id: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    description: 'Anthropic — fast & balanced, great for most sites',
    badge: '$3/1M',
    badgeColor: 'bg-indigo-100 text-indigo-700',
    section: 'paid',
    tier: 40,
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'OpenAI — strong reasoning and layout analysis',
    badge: '$5/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'paid',
    tier: 50,
  },
  {
    id: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'OpenAI — high context capacity for complex sites',
    badge: '$10/1M',
    badgeColor: 'bg-lime-100 text-lime-700',
    section: 'paid',
    tier: 60,
  },
  {
    id: 'o3',
    label: 'o3',
    description: 'OpenAI most powerful reasoning — for premium complex sites',
    badge: '$10/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'paid',
    tier: 61,
  },
  {
    id: 'claude-opus-4-5',
    label: 'Claude Opus 4.5',
    description: 'Anthropic best — highest fidelity design replication',
    badge: '$15/1M',
    badgeColor: 'bg-purple-100 text-purple-700',
    section: 'paid',
    tier: 70,
  },
  // ═══════════════════════════════════════════════════════
  // OPENROUTER — one API key, all providers
  // ═══════════════════════════════════════════════════════
  {
    id: 'or-gemini-2-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Google free tier via OpenRouter',
    badge: 'FREE',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    section: 'openrouter',
    tier: 5,
    viaOpenRouter: true,
  },
  {
    id: 'or-gemini-3-flash',
    label: 'Gemini 3 Flash',
    description: 'Latest Google via OpenRouter — free tier',
    badge: 'FREE',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    section: 'openrouter',
    tier: 6,
    viaOpenRouter: true,
  },
  {
    id: 'or-deepseek-v3',
    label: 'DeepSeek v3',
    description: 'Budget option via OpenRouter',
    badge: '$0.27/1M',
    badgeColor: 'bg-sky-100 text-sky-700',
    section: 'openrouter',
    tier: 10,
    viaOpenRouter: true,
  },
  {
    id: 'or-gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'OpenAI affordable via OpenRouter',
    badge: '$0.15/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'openrouter',
    tier: 11,
    viaOpenRouter: true,
  },
  {
    id: 'or-o4-mini',
    label: 'o4 Mini',
    description: 'OpenAI reasoning via OpenRouter',
    badge: '$1.10/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'openrouter',
    tier: 20,
    viaOpenRouter: true,
  },
  {
    id: 'or-gpt-4-1',
    label: 'GPT-4.1',
    description: 'OpenAI latest via OpenRouter',
    badge: '$2/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'openrouter',
    tier: 30,
    viaOpenRouter: true,
  },
  {
    id: 'or-claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    description: 'Anthropic Sonnet via OpenRouter',
    badge: '$3/1M',
    badgeColor: 'bg-indigo-100 text-indigo-700',
    section: 'openrouter',
    tier: 40,
    viaOpenRouter: true,
  },
  {
    id: 'or-gpt-4o',
    label: 'GPT-4o',
    description: 'OpenAI GPT-4o via OpenRouter',
    badge: '$5/1M',
    badgeColor: 'bg-green-100 text-green-700',
    section: 'openrouter',
    tier: 50,
    viaOpenRouter: true,
  },
  {
    id: 'or-claude-opus-4-5',
    label: 'Claude Opus 4.5',
    description: 'Anthropic best quality via OpenRouter',
    badge: '$15/1M',
    badgeColor: 'bg-purple-100 text-purple-700',
    section: 'openrouter',
    tier: 70,
    viaOpenRouter: true,
  },
];

export const DEFAULT_PROVIDER_ID = 'claude-opus-4-5';

/** Quick lookup by ID */
export function getProviderOption(id: string): AIProviderOption | undefined {
  return AI_PROVIDER_OPTIONS.find(p => p.id === id);
}

/** Section labels shown in the filter UI */
export const PROVIDER_SECTIONS = [
  { key: 'all',        label: 'All Models' },
  { key: 'free',       label: '🆓 Free' },
  { key: 'paid',       label: '💳 Paid' },
  { key: 'openrouter', label: '🔀 OpenRouter' },
] as const;

export type ProviderSection = typeof PROVIDER_SECTIONS[number]['key'];

/** Returns options filtered by section, sorted by tier */
export function getProvidersBySection(section: ProviderSection): AIProviderOption[] {
  const list = section === 'all'
    ? AI_PROVIDER_OPTIONS
    : AI_PROVIDER_OPTIONS.filter(p => p.section === section);
  return [...list].sort((a, b) => a.tier - b.tier);
}
