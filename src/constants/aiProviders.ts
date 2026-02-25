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
}

export const AI_PROVIDER_OPTIONS: AIProviderOption[] = [
  // ── Direct Anthropic ──────────────────────────────────────────────────────
  {
    id: 'claude-opus-4-5',
    label: 'Claude Opus 4.5',
    description: 'Best quality — highest fidelity design replication',
    badge: '$15/1M',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    description: 'Fast & balanced — great for most sites',
    badge: '$3/1M',
    badgeColor: 'bg-indigo-100 text-indigo-700',
  },
  // ── Direct Google ─────────────────────────────────────────────────────────
  {
    id: 'gemini-2-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Google AI — free tier, excellent speed',
    badge: 'Free',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'gemini-2-pro',
    label: 'Gemini 2.0 Pro',
    description: 'Google AI advanced — superior visual understanding',
    badge: '$1.25/1M',
    badgeColor: 'bg-teal-100 text-teal-700',
  },
  // ── Direct DeepSeek ───────────────────────────────────────────────────────
  {
    id: 'deepseek-v3',
    label: 'DeepSeek v3',
    description: 'Ultra cost-effective — great for content-heavy sites',
    badge: '$0.27/1M',
    badgeColor: 'bg-sky-100 text-sky-700',
  },
  // ── Direct OpenAI ─────────────────────────────────────────────────────────
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'OpenAI — strong reasoning and layout analysis',
    badge: '$5/1M',
    badgeColor: 'bg-green-100 text-green-700',
  },
  {
    id: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'OpenAI — high context capacity for complex sites',
    badge: '$10/1M',
    badgeColor: 'bg-lime-100 text-lime-700',
  },
  // ── OpenRouter (single key, all providers) ────────────────────────────────
  {
    id: 'or-claude-opus-4-5',
    label: 'Claude Opus 4.5 (OpenRouter)',
    description: 'Anthropic via OpenRouter — one API key for all providers',
    badge: '$15/1M',
    badgeColor: 'bg-purple-100 text-purple-700',
    viaOpenRouter: true,
  },
  {
    id: 'or-claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5 (OpenRouter)',
    description: 'Anthropic Sonnet via OpenRouter — fast & balanced',
    badge: '$3/1M',
    badgeColor: 'bg-indigo-100 text-indigo-700',
    viaOpenRouter: true,
  },
  {
    id: 'or-gemini-2-flash',
    label: 'Gemini 2.0 Flash (OpenRouter)',
    description: 'Google free tier via OpenRouter',
    badge: 'Free',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    viaOpenRouter: true,
  },
  {
    id: 'or-deepseek-v3',
    label: 'DeepSeek v3 (OpenRouter)',
    description: 'Budget option via OpenRouter',
    badge: '$0.27/1M',
    badgeColor: 'bg-sky-100 text-sky-700',
    viaOpenRouter: true,
  },
];

export const DEFAULT_PROVIDER_ID = 'claude-opus-4-5';

/** Quick lookup by ID */
export function getProviderOption(id: string): AIProviderOption | undefined {
  return AI_PROVIDER_OPTIONS.find(p => p.id === id);
}
