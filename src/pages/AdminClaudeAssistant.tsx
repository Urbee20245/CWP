"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { AdminService } from '../services/adminService';
import {
  Send, Bot, User, Loader2, AlertTriangle, CheckCircle2,
  XCircle, Database, Github, Trash2, ChevronDown, ChevronRight,
  Terminal,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────────

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
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  list_tables: <Database className="w-3.5 h-3.5" />,
  query_database: <Database className="w-3.5 h-3.5" />,
  propose_database_change: <Database className="w-3.5 h-3.5" />,
  github_list_directory: <Github className="w-3.5 h-3.5" />,
  github_get_file: <Github className="w-3.5 h-3.5" />,
  github_get_issues: <Github className="w-3.5 h-3.5" />,
};

// Convert API messages list back to the conversation history format
function buildApiHistory(chatMessages: ChatMessage[]): Array<{ role: string; content: string }> {
  const history: Array<{ role: string; content: string }> = [];
  for (const msg of chatMessages) {
    if (msg.role === 'user') {
      history.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      history.push({ role: 'assistant', content: msg.content });
    }
    // tool_status and confirmation are UI-only
  }
  return history;
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

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
  // Minimal inline markdown renderer — bold, code blocks, inline code, line breaks
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('```')) return null; // handled by code block logic below
        // Bold
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <p key={i} className={line.startsWith('# ') ? 'font-bold text-slate-800 text-sm' : line.startsWith('## ') ? 'font-semibold text-slate-700 text-sm' : 'text-sm text-slate-700'}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j}>{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={j} className="bg-slate-100 text-indigo-600 rounded px-1 font-mono text-xs">{part.slice(1, -1)}</code>;
              }
              return part.replace(/^#{1,3} /, '');
            })}
          </p>
        );
      })}
    </div>
  );
}

function ConfirmationCard({
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

// ─── Main page ──────────────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  'List all database tables',
  'Show me the last 10 clients',
  'How many active projects are there?',
  'List open GitHub issues',
  'Read the file src/pages/AdminDashboard.tsx',
];

const AdminClaudeAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (userText: string, resumeData?: {
    apiMessages: any[];
    confirmedOperation: { approved: boolean; operation: any; tool_id: string } | null;
    confirmationMsgId: string;
    resolution: 'approved' | 'rejected';
  }) => {
    if (!userText.trim() && !resumeData) return;
    setLoading(true);

    // Add user message to UI (only for new messages, not resumes)
    let currentMessages: ChatMessage[] = [];

    if (!resumeData) {
      const userMsg: UserMessage = { role: 'user', id: genId(), content: userText.trim() };
      setMessages(prev => {
        currentMessages = [...prev, userMsg];
        return currentMessages;
      });
      setInput('');
    } else {
      // For resume (confirmation), work with current state
      setMessages(prev => {
        currentMessages = prev;
        return prev;
      });
    }

    // Small delay to let state update flush
    await new Promise(r => setTimeout(r, 10));

    // Build API payload
    let apiMessages: any[];
    let confirmedOperation: any = null;

    if (resumeData) {
      apiMessages = resumeData.apiMessages;
      confirmedOperation = resumeData.confirmedOperation;
    } else {
      // Fresh send — build history from chat messages + new user message
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
      });

      if (response.type === 'response') {
        // Add tool status messages then the assistant reply
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
        newMsgs.push({
          role: 'assistant',
          id: genId(),
          content: response.content,
          toolCalls: response.tool_calls,
        });
        setMessages(prev => [...prev, ...newMsgs]);

      } else if (response.type === 'confirmation_required') {
        // Show tool status for any tool calls that happened before the proposal
        const newMsgs: ChatMessage[] = [];
        const confirmId = genId();
        newMsgs.push({
          role: 'confirmation',
          id: confirmId,
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
  }, []);

  const handleConfirmation = useCallback(async (msg: ConfirmationMessage, approved: boolean) => {
    // Mark the confirmation card as resolved
    setMessages(prev =>
      prev.map(m =>
        m.id === msg.id
          ? { ...m, resolved: true, resolution: approved ? 'approved' : 'rejected' } as ConfirmationMessage
          : m
      )
    );

    // Add a status message
    setMessages(prev => [
      ...prev,
      {
        role: 'tool_status',
        id: genId(),
        label: approved ? 'Applying database change...' : 'Rejecting change...',
        tool: 'propose_database_change',
      },
    ]);

    // Resume the conversation
    await sendMessage('', {
      apiMessages: msg.resumeMessages,
      confirmedOperation: approved
        ? { approved: true, operation: msg.operation, tool_id: msg.toolId }
        : { approved: false, operation: msg.operation, tool_id: msg.toolId },
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

  return (
    <AdminLayout>
      <div className="flex flex-col h-screen max-h-screen overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Claude Assistant</h1>
              <p className="text-xs text-slate-400">Supabase + GitHub access</p>
            </div>
          </div>
          {hasMessages && (
            <button
              onClick={() => setMessages([])}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-6 pb-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <Bot className="w-8 h-8 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Ask me anything</h2>
                <p className="text-slate-400 text-sm max-w-sm">
                  I can query your Supabase database, read your GitHub repo, and help you make changes with your approval.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTED_PROMPTS.map(p => (
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
                  <div className="flex items-end gap-2 max-w-[85%]">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mb-0.5">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                      <MarkdownText text={msg.content} />
                      {msg.toolCalls && <ToolCallsAccordion toolCalls={msg.toolCalls} />}
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.role === 'confirmation') {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="flex items-start gap-2 max-w-[85%]">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <ConfirmationCard
                      msg={msg as ConfirmationMessage}
                      onDecision={(approved) => handleConfirmation(msg as ConfirmationMessage, approved)}
                    />
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
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-4">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask Claude anything about your database or codebase…"
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
            Enter to send · Shift+Enter for new line · Database writes require your approval
          </p>
        </div>

      </div>
    </AdminLayout>
  );
};

export default AdminClaudeAssistant;
