"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { AdminService } from '../services/adminService';
import { SiteContextSelector, type SessionContext } from '../components/admin/SiteContextSelector';
import { UpdateNotificationBanner } from '../components/admin/UpdateNotificationBanner';
import { CodeBlock, FileWritePreview } from '../components/admin/CodeBlock';
import {
  Send, Bot, User, Loader2, AlertTriangle, CheckCircle2,
  XCircle, Database, Github, Trash2, ChevronDown, ChevronRight,
  Terminal, X, Settings, Globe, Layers, Code2,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

interface ClaudeModel {
  id: string;
  label: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  section: 'haiku' | 'sonnet' | 'opus';
}

const CLAUDE_MODELS: ClaudeModel[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    description: 'Fastest & most affordable — ideal for quick queries',
    badge: 'Fastest',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    section: 'haiku',
  },
  {
    id: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    description: 'Balanced speed and intelligence — great for most tasks',
    badge: 'Recommended',
    badgeColor: 'bg-blue-100 text-blue-700',
    section: 'sonnet',
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    description: 'Latest Sonnet — enhanced reasoning and accuracy',
    badge: 'Latest',
    badgeColor: 'bg-indigo-100 text-indigo-700',
    section: 'sonnet',
  },
  {
    id: 'claude-opus-4-5',
    label: 'Claude Opus 4.5',
    description: 'Highly capable — excellent for complex code generation',
    badge: 'Powerful',
    badgeColor: 'bg-purple-100 text-purple-700',
    section: 'opus',
  },
  {
    id: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    description: 'Most powerful Claude — best for demanding tasks',
    badge: 'Most Powerful',
    badgeColor: 'bg-violet-100 text-violet-700',
    section: 'opus',
  },
];

const MODEL_SECTIONS = [
  { key: 'all',    label: 'All' },
  { key: 'haiku',  label: '⚡ Haiku' },
  { key: 'sonnet', label: '🎯 Sonnet' },
  { key: 'opus',   label: '🧠 Opus' },
] as const;

type ModelSection = typeof MODEL_SECTIONS[number]['key'];

type ModelId = string;

const SUGGESTED_PROMPTS: Record<SessionContext['type'], string[]> = {
  cwp: [
    'Show open GitHub issues',
    'List all edge functions',
    'What tables need RLS policies?',
    'Read src/pages/AdminDashboard.tsx',
    "What's the schema for the clients table?",
  ],
  client: [
    "Show this client's active projects",
    'What add-ons does this client have enabled?',
    'Generate a new blog section for their site',
    'Check their subscription status',
  ],
  all_clients: [
    "Which clients don't have a blog section?",
    'Show me all client sites missing voice integration',
    'Roll out a new footer to all sites',
  ],
};

const DEFAULT_PROMPTS = [
  'List all database tables',
  'Show me the last 10 clients',
  'How many active projects are there?',
  'List open GitHub issues',
  'Read the file src/pages/AdminDashboard.tsx',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserMessage {
  role: 'user';
  id: string;
  content: string;
}

interface AssistantMessage {
  role: 'assistant';
  id: string;
  content: string;
  toolCalls?: ToolCallRecord[];
  codeOutput?: CodeOutput;
}

interface ToolStatusMessage {
  role: 'tool_status';
  id: string;
  label: string;
  tool: string;
}

interface ConfirmationMessage {
  role: 'confirmation';
  id: string;
  confirmationType: 'database' | 'file_write';
  operation: any;
  toolId: string;
  precedingText: string;
  resumeMessages: any[];
  resolved: boolean;
  resolution?: 'approved' | 'rejected';
}

type ChatMessage = UserMessage | AssistantMessage | ToolStatusMessage | ConfirmationMessage;

interface ToolCallRecord {
  tool: string;
  input: any;
  result: any;
}

interface CodeOutput {
  code: string;
  suggested_path?: string;
  description?: string;
  next_steps?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2);
}

const TOOL_LABELS: Record<string, string> = {
  list_tables: 'Listing database tables',
  query_database: 'Querying database',
  propose_database_change: 'Proposing database change',
  github_list_directory: 'Reading GitHub directory',
  github_get_file: 'Reading GitHub file',
  github_get_issues: 'Fetching GitHub issues',
  generate_feature_code: 'Generating feature code',
  write_file_to_github: 'Writing file to GitHub',
  check_tool_versions: 'Checking tool versions',
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  list_tables: <Database className="w-3.5 h-3.5" />,
  query_database: <Database className="w-3.5 h-3.5" />,
  propose_database_change: <Database className="w-3.5 h-3.5" />,
  github_list_directory: <Github className="w-3.5 h-3.5" />,
  github_get_file: <Github className="w-3.5 h-3.5" />,
  github_get_issues: <Github className="w-3.5 h-3.5" />,
  generate_feature_code: <Code2 className="w-3.5 h-3.5" />,
  write_file_to_github: <Github className="w-3.5 h-3.5" />,
  check_tool_versions: <Terminal className="w-3.5 h-3.5" />,
};

const CONTEXT_ICONS: Record<SessionContext['type'], React.ReactNode> = {
  cwp: <Settings className="w-3.5 h-3.5" />,
  client: <Globe className="w-3.5 h-3.5" />,
  all_clients: <Layers className="w-3.5 h-3.5" />,
};

const CONTEXT_COLORS: Record<SessionContext['type'], string> = {
  cwp: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  client: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  all_clients: 'bg-purple-100 text-purple-700 border-purple-200',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToolCallsAccordion({ toolCalls }: { toolCalls: ToolCallRecord[] }) {
  const [open, setOpen] = useState(false);
  if (!toolCalls?.length) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Terminal className="w-3 h-3" />
        {toolCalls.length} tool call{toolCalls.length > 1 ? 's' : ''}
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {toolCalls.map((tc, i) => (
            <div key={i} className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-xs font-mono">
              <div className="font-semibold text-slate-600 mb-1">{tc.tool}({JSON.stringify(tc.input).slice(0, 80)}...)</div>
              <div className="text-slate-400 whitespace-pre-wrap break-words">
                {JSON.stringify(tc.result, null, 2).slice(0, 400)}
                {JSON.stringify(tc.result).length > 400 ? '\n...' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  // Split on code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, idx) => {
        if (part.startsWith('```')) {
          // Extract language and code
          const lines = part.slice(3).split('\n');
          const lang = lines[0].trim();
          const code = lines.slice(1).join('\n').replace(/```$/, '').trimEnd();
          return (
            <CodeBlock
              key={idx}
              code={code}
              language={lang || 'text'}
            />
          );
        }

        // Render inline markdown
        const lineNodes = part.split('\n').map((line, i) => {
          const inlineParts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
          const isH1 = line.startsWith('# ');
          const isH2 = line.startsWith('## ');
          const isH3 = line.startsWith('### ');
          const isBullet = line.startsWith('- ') || line.startsWith('* ');
          const isNumbered = /^\d+\.\s/.test(line);

          const cleanLine = line.replace(/^#{1,3} /, '').replace(/^[-*] /, '').replace(/^\d+\.\s/, '');

          const renderedInline = inlineParts.map((p, j) => {
            if (p.startsWith('**') && p.endsWith('**')) return <strong key={j}>{p.slice(2, -2)}</strong>;
            if (p.startsWith('`') && p.endsWith('`')) {
              return <code key={j} className="bg-slate-100 text-indigo-600 rounded px-1 font-mono text-xs">{p.slice(1, -1)}</code>;
            }
            return p.replace(/^#{1,3} /, '').replace(/^[-*] /, '').replace(/^\d+\.\s/, '');
          });

          if (isH1) return <p key={i} className="font-bold text-slate-800 text-base">{renderedInline}</p>;
          if (isH2) return <p key={i} className="font-semibold text-slate-800 text-sm mt-2">{renderedInline}</p>;
          if (isH3) return <p key={i} className="font-semibold text-slate-700 text-sm">{renderedInline}</p>;
          if (isBullet || isNumbered) return (
            <div key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="text-slate-400 flex-shrink-0">{isBullet ? '•' : line.match(/^\d+/)?.[0] + '.'}</span>
              <span>{inlineParts.map((p, j) => {
                if (p.startsWith('**') && p.endsWith('**')) return <strong key={j}>{p.slice(2, -2)}</strong>;
                if (p.startsWith('`') && p.endsWith('`')) return <code key={j} className="bg-slate-100 text-indigo-600 rounded px-1 font-mono text-xs">{p.slice(1, -1)}</code>;
                return p.replace(/^[-*] /, '').replace(/^\d+\.\s/, '');
              })}</span>
            </div>
          );
          if (!cleanLine.trim()) return <div key={i} className="h-1" />;
          return <p key={i} className="text-sm text-slate-700">{renderedInline}</p>;
        });

        return <div key={idx} className="space-y-1">{lineNodes}</div>;
      })}
    </div>
  );
}

function DbConfirmationCard({
  msg,
  onDecision,
}: {
  msg: ConfirmationMessage;
  onDecision: (approved: boolean) => void;
}) {
  const op = msg.operation;
  const label = op.operation?.toUpperCase() ?? '';
  const colorMap: Record<string, string> = {
    INSERT: 'bg-blue-50 border-blue-200 text-blue-800',
    UPDATE: 'bg-amber-50 border-amber-200 text-amber-800',
    DELETE: 'bg-red-50 border-red-200 text-red-800',
  };
  const headerColor = colorMap[label] ?? 'bg-amber-50 border-amber-200 text-amber-800';

  if (msg.resolved) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
        {msg.resolution === 'approved'
          ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Change approved and applied</>
          : <><XCircle className="w-3.5 h-3.5 text-slate-400" /> Change rejected</>
        }
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${headerColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4" />
        <span className="font-semibold text-sm">Confirm Database {label}</span>
      </div>

      {msg.precedingText && (
        <p className="text-sm mb-3 opacity-80">{msg.precedingText}</p>
      )}

      <p className="text-sm mb-3 font-medium">{op.description}</p>

      <div className="bg-white/70 rounded-lg p-3 text-xs font-mono text-slate-600 mb-4 space-y-1">
        <div><span className="text-slate-400">table: </span>{op.table}</div>
        {op.data && (
          <div>
            <span className="text-slate-400">data: </span>
            <pre className="inline whitespace-pre-wrap">{JSON.stringify(op.data, null, 2)}</pre>
          </div>
        )}
        {op.filters?.length > 0 && (
          <div>
            <span className="text-slate-400">where: </span>
            {op.filters.map((f: any, i: number) => (
              <span key={i}>{f.column} {f.operator} {JSON.stringify(f.value)}{i < op.filters.length - 1 ? ', ' : ''}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onDecision(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
          Approve
        </button>
        <button
          onClick={() => onDecision(false)}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-slate-600 text-sm font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Reject
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminClaudeAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>('claude-sonnet-4-5');
  const [modelSection, setModelSection] = useState<ModelSection>('all');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredModels = modelSection === 'all'
    ? CLAUDE_MODELS
    : CLAUDE_MODELS.filter(m => m.section === modelSection);
  const activeModel = CLAUDE_MODELS.find(m => m.id === selectedModel);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch tool versions for the update banner
  const fetchVersions = useCallback(async () => {
    const result = await (AdminService as any).callClaudeAssistant({
      messages: [{ role: 'user', content: 'check_tool_versions' }],
      model: 'claude-haiku-4-5',
      _direct_tool: 'check_tool_versions',
    });
    // The response is a text response — parse the tool call results
    if (result?.tool_calls?.length) {
      const versionTool = result.tool_calls.find((tc: any) => tc.tool === 'check_tool_versions');
      if (versionTool?.result) return versionTool.result;
    }
    return { supabase_cli_latest: 'unavailable', claude_code_latest: 'unavailable' };
  }, []);

  const sendMessage = useCallback(async (userText: string, resumeData?: {
    apiMessages: any[];
    confirmedOperation: { approved: boolean; operation: any; tool_id: string; type?: string } | null;
    confirmationMsgId: string;
    resolution: 'approved' | 'rejected';
  }) => {
    if (!userText.trim() && !resumeData) return;
    setLoading(true);

    let currentMessages: ChatMessage[] = [];

    if (!resumeData) {
      const userMsg: UserMessage = { role: 'user', id: genId(), content: userText.trim() };
      setMessages(prev => {
        currentMessages = [...prev, userMsg];
        return currentMessages;
      });
      setInput('');
    } else {
      setMessages(prev => {
        currentMessages = prev;
        return prev;
      });
    }

    await new Promise(r => setTimeout(r, 10));

    let apiMessages: any[];
    let confirmedOperation: any = null;

    if (resumeData) {
      apiMessages = resumeData.apiMessages;
      confirmedOperation = resumeData.confirmedOperation;
    } else {
      setMessages(prev => {
        currentMessages = prev;
        return prev;
      });
      await new Promise(r => setTimeout(r, 10));
      apiMessages = [];
      for (const m of currentMessages) {
        if (m.role === 'user') apiMessages.push({ role: 'user', content: (m as UserMessage).content });
        else if (m.role === 'assistant') apiMessages.push({ role: 'assistant', content: (m as AssistantMessage).content });
      }
    }

    try {
      const response = await (AdminService as any).callClaudeAssistant({
        messages: apiMessages,
        confirmed_operation: confirmedOperation,
        session_context: sessionContext,
        model: selectedModel,
      });

      if (response.type === 'response') {
        const newMsgs: ChatMessage[] = [];
        if (response.tool_calls?.length) {
          for (const tc of response.tool_calls) {
            newMsgs.push({
              role: 'tool_status',
              id: genId(),
              label: TOOL_LABELS[tc.tool] ?? tc.tool,
              tool: tc.tool,
            });
          }
        }

        // Check if any tool call has code output
        const codeToolCall = response.tool_calls?.find(
          (tc: any) => tc.tool === 'generate_feature_code' && tc.result?.code
        );

        newMsgs.push({
          role: 'assistant',
          id: genId(),
          content: response.content,
          toolCalls: response.tool_calls,
          codeOutput: codeToolCall ? codeToolCall.result : undefined,
        });
        setMessages(prev => [...prev, ...newMsgs]);

      } else if (response.type === 'confirmation_required') {
        const newMsgs: ChatMessage[] = [];
        newMsgs.push({
          role: 'confirmation',
          id: genId(),
          confirmationType: response.confirmation_type ?? 'database',
          operation: response.operation,
          toolId: response.tool_id,
          precedingText: response.preceding_text ?? '',
          resumeMessages: response.messages,
          resolved: false,
        });
        setMessages(prev => [...prev, ...newMsgs]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          id: genId(),
          content: `**Error:** ${err.message ?? 'Something went wrong. Please try again.'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [sessionContext, selectedModel]);

  const handleConfirmation = useCallback(async (msg: ConfirmationMessage, approved: boolean) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === msg.id
          ? { ...m, resolved: true, resolution: approved ? 'approved' : 'rejected' } as ConfirmationMessage
          : m
      )
    );

    setMessages(prev => [
      ...prev,
      {
        role: 'tool_status',
        id: genId(),
        label: approved
          ? (msg.confirmationType === 'file_write' ? 'Writing file to GitHub...' : 'Applying database change...')
          : (msg.confirmationType === 'file_write' ? 'Rejecting file write...' : 'Rejecting change...'),
        tool: msg.confirmationType === 'file_write' ? 'write_file_to_github' : 'propose_database_change',
      },
    ]);

    await sendMessage('', {
      apiMessages: msg.resumeMessages,
      confirmedOperation: {
        approved,
        operation: msg.operation,
        tool_id: msg.toolId,
        type: msg.confirmationType,
      },
      confirmationMsgId: msg.id,
      resolution: approved ? 'approved' : 'rejected',
    });
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) sendMessage(input);
    }
  };

  const hasMessages = messages.length > 0;
  const suggestedPrompts = sessionContext
    ? SUGGESTED_PROMPTS[sessionContext.type]
    : DEFAULT_PROMPTS;

  return (
    <AdminLayout>
      <div className="flex flex-col h-screen max-h-screen overflow-hidden">

        {/* Update notification banner */}
        <UpdateNotificationBanner fetchVersions={fetchVersions} />

        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">All-in-One Code Builder</h1>
              <p className="text-xs text-slate-400">Build features for CWP or any client site</p>
            </div>

            {/* Session context pill */}
            {sessionContext && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border flex-shrink-0 ${CONTEXT_COLORS[sessionContext.type]}`}>
                {CONTEXT_ICONS[sessionContext.type]}
                <span className="max-w-[150px] truncate">Working on: {sessionContext.label}</span>
                <button
                  onClick={() => { setSessionContext(null); setMessages([]); }}
                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                  title="Reset context"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Model selector */}
            <div className="flex flex-col gap-1">
              {/* Section tabs */}
              <div className="flex gap-1">
                {MODEL_SECTIONS.map(s => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setModelSection(s.key)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      modelSection === s.key
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                >
                  {filteredModels.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}{m.badge ? ` — ${m.badge}` : ''}
                    </option>
                  ))}
                </select>
                {activeModel?.badge && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${activeModel.badgeColor}`}>
                    {activeModel.badge}
                  </span>
                )}
              </div>
            </div>

            {hasMessages && (
              <button
                onClick={() => { setMessages([]); setSessionContext(null); }}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Messages / Context Selector */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

          {/* Show context selector if no context chosen and no messages */}
          {!sessionContext && !hasMessages && (
            <SiteContextSelector onSelect={(ctx) => setSessionContext(ctx)} />
          )}

          {/* Show suggested prompts if context is chosen but no messages yet */}
          {sessionContext && !hasMessages && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-6 pb-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <Bot className="w-8 h-8 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Ready to build</h2>
                <p className="text-slate-400 text-sm max-w-sm">
                  Working on <strong className="text-slate-600">{sessionContext.label}</strong>. What would you like to do?
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestedPrompts.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all shadow-sm"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="flex items-end gap-2 max-w-[80%]">
                    <div className="bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm shadow-sm">
                      {msg.content}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-0.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.role === 'tool_status') {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="flex items-center gap-2 bg-slate-100 text-slate-500 text-xs px-3 py-1.5 rounded-full">
                    {TOOL_ICONS[msg.tool] ?? <Terminal className="w-3.5 h-3.5" />}
                    {msg.label}
                  </div>
                </div>
              );
            }

            if (msg.role === 'assistant') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="flex items-end gap-2 max-w-[90%]">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mb-0.5">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm min-w-0 flex-1">
                      <MarkdownText text={msg.content} />
                      {msg.codeOutput && (
                        <div className="mt-3">
                          <CodeBlock
                            code={msg.codeOutput.code}
                            suggestedPath={msg.codeOutput.suggested_path}
                          />
                          {msg.codeOutput.next_steps?.length ? (
                            <div className="mt-2 text-xs text-slate-500">
                              <strong>Next steps:</strong>
                              <ul className="mt-1 space-y-0.5">
                                {msg.codeOutput.next_steps.map((s, i) => (
                                  <li key={i} className="flex gap-1.5">
                                    <span className="text-slate-400">{i + 1}.</span>
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      )}
                      {msg.toolCalls && <ToolCallsAccordion toolCalls={msg.toolCalls} />}
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.role === 'confirmation') {
              const confirmMsg = msg as ConfirmationMessage;

              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="flex items-start gap-2 max-w-[90%] flex-1">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1">
                      {confirmMsg.confirmationType === 'file_write' ? (
                        <FileWritePreview
                          path={confirmMsg.operation.path}
                          content={confirmMsg.operation.content}
                          description={confirmMsg.operation.description}
                          onApprove={() => handleConfirmation(confirmMsg, true)}
                          onReject={() => handleConfirmation(confirmMsg, false)}
                          resolved={confirmMsg.resolved}
                          resolution={confirmMsg.resolution}
                        />
                      ) : (
                        <DbConfirmationCard
                          msg={confirmMsg}
                          onDecision={(approved) => handleConfirmation(confirmMsg, approved)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking…</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input (only shown when context is set or when there are messages) */}
        {(sessionContext || hasMessages) && (
          <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-4">
            <div className="flex items-end gap-3 max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder={
                    sessionContext
                      ? `Ask Claude about ${sessionContext.label}…`
                      : 'Ask Claude anything about your database or codebase…'
                  }
                  rows={1}
                  style={{ resize: 'none' }}
                  className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-all"
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = 'auto';
                    t.style.height = Math.min(t.scrollHeight, 160) + 'px';
                  }}
                />
              </div>
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex-shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-center text-xs text-slate-300 mt-2">
              Enter to send · Shift+Enter for new line · Database & file writes require your approval
            </p>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};

export default AdminClaudeAssistant;
