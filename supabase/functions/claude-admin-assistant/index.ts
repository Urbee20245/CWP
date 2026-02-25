import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GITHUB_REPO = 'Urbee20245/CWP';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Session context type ────────────────────────────────────────────────────

interface SessionContext {
  type: 'cwp' | 'client' | 'all_clients';
  label: string;
  repo?: string;
  clientId?: string;
  clientSlug?: string;
}

// ─── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'list_tables',
    description: 'List all public tables available in the Supabase database.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'query_database',
    description: 'Execute a SELECT query on a Supabase table. Use this to read clients, projects, billing, appointments, etc.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name to query (e.g. "clients", "projects")' },
        select: { type: 'string', description: 'Columns to select (default "*")' },
        filters: {
          type: 'array',
          description: 'Optional filter conditions',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'] },
              value: { description: 'Filter value' },
            },
            required: ['column', 'operator', 'value'],
          },
        },
        limit: { type: 'integer', description: 'Max rows to return (default 20, max 100)' },
        order_by: { type: 'string', description: 'Column to order results by' },
        ascending: { type: 'boolean', description: 'Sort ascending? Default false (newest first)' },
      },
      required: ['table'],
    },
  },
  {
    name: 'propose_database_change',
    description: 'Propose an INSERT, UPDATE, or DELETE operation. The admin must confirm before it is executed. Always call this instead of directly modifying data.',
    input_schema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['insert', 'update', 'delete'], description: 'Type of operation' },
        table: { type: 'string', description: 'Table to modify' },
        description: { type: 'string', description: 'Clear human-readable description of what this change will do' },
        data: { type: 'object', description: 'For insert/update: key-value pairs of column values to write' },
        filters: {
          type: 'array',
          description: 'For update/delete: filter conditions to target specific rows',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] },
              value: {},
            },
            required: ['column', 'operator', 'value'],
          },
        },
      },
      required: ['operation', 'table', 'description'],
    },
  },
  {
    name: 'github_list_directory',
    description: 'List files and directories in the CWP GitHub repository at a given path.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to repo root (e.g. "src/pages" or "" for root)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'github_get_file',
    description: 'Read the content of a file from the CWP GitHub repository.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to repo root (e.g. "src/pages/AdminDashboard.tsx")' },
      },
      required: ['path'],
    },
  },
  {
    name: 'github_get_issues',
    description: 'List issues in the CWP GitHub repository.',
    input_schema: {
      type: 'object',
      properties: {
        state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Filter by issue state (default "open")' },
        limit: { type: 'integer', description: 'Max issues to return (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'generate_feature_code',
    description: 'Generate code (React components, edge functions, SQL migrations, or configuration files) for a requested feature. Returns the code as a string with file path suggestions.',
    input_schema: {
      type: 'object',
      properties: {
        feature_description: { type: 'string', description: 'What feature to build' },
        target: {
          type: 'string',
          enum: ['cwp', 'client_site', 'supabase_function', 'database_migration'],
          description: 'What type of code to generate',
        },
        context_files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Relevant file paths to read first for context',
        },
      },
      required: ['feature_description', 'target'],
    },
  },
  {
    name: 'write_file_to_github',
    description: 'Create or update a file in the CWP GitHub repository. Always requires admin confirmation before executing.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Full file path in the repo (e.g. src/pages/NewFeature.tsx)' },
        content: { type: 'string', description: 'File content to write' },
        commit_message: { type: 'string', description: 'Git commit message' },
        description: { type: 'string', description: 'Human-readable description of what this change does' },
      },
      required: ['path', 'content', 'commit_message', 'description'],
    },
  },
  {
    name: 'check_tool_versions',
    description: 'Check the latest available versions of Supabase CLI and Claude Code from public registries.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

// ─── System prompt builder ───────────────────────────────────────────────────

function buildSystemPrompt(sessionContext?: SessionContext | null): string {
  return `You are the CWP All-in-One Code Builder — an expert admin assistant AND full-stack developer for CWP (Custom Website Plus), a multi-tenant SaaS platform.

${sessionContext ? `## Current Session Context
You are currently working on: **${sessionContext.label}** (type: ${sessionContext.type})
${sessionContext.clientId ? `Client ID: ${sessionContext.clientId}, Slug: ${sessionContext.clientSlug}` : ''}
Keep all actions, queries, and code generation scoped to this context unless the admin says otherwise.
` : ''}

## Your Capabilities
1. **Database Access** — Query any table, propose changes (require approval)
2. **GitHub Access** — Read any file, list directories, view issues
3. **Code Generation** — Generate React components, edge functions, SQL migrations, config files
4. **File Writing** — Write generated code directly to GitHub (requires approval)
5. **Feature Building** — Plan and implement complete features end-to-end

## Platform Stack
- Frontend: React 18 + TypeScript + Tailwind CSS + Vite → Vercel
- Backend: Supabase (PostgreSQL + 55+ Deno Edge Functions)
- Integrations: Stripe, Twilio, Retell, Cal.com, Resend
- Repo: Urbee20245/CWP

## Rules
- ALWAYS read relevant existing files before generating new code
- ALWAYS use the confirmation flow for database writes and file writes
- NEVER expose API keys, secrets, or tokens in responses
- For client-scoped tasks, always filter by the session client ID
- When building multi-step features, outline the plan first, then execute step by step`;
}

// ─── Tool executors ─────────────────────────────────────────────────────────────

async function listTables(): Promise<{ tables: string[] } | { error: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) return { error: `Schema fetch failed: ${res.status}` };
    const spec = await res.json();
    const tables = Object.keys(spec.paths ?? {})
      .filter((p: string) => p !== '/' && !p.includes('{') && !p.startsWith('/rpc'))
      .map((p: string) => p.replace(/^\//, ''));
    return { tables };
  } catch (e: any) {
    return { error: e.message };
  }
}

function applyFilter(query: any, filter: { column: string; operator: string; value: any }) {
  const { column, operator, value } = filter;
  switch (operator) {
    case 'eq':    return query.eq(column, value);
    case 'neq':   return query.neq(column, value);
    case 'gt':    return query.gt(column, value);
    case 'gte':   return query.gte(column, value);
    case 'lt':    return query.lt(column, value);
    case 'lte':   return query.lte(column, value);
    case 'like':  return query.like(column, value);
    case 'ilike': return query.ilike(column, value);
    case 'in':    return query.in(column, Array.isArray(value) ? value : [value]);
    case 'is':    return query.is(column, value);
    default:      return query;
  }
}

async function queryDatabase(supabaseAdmin: any, input: any) {
  const { table, select = '*', filters = [], limit = 20, order_by, ascending = false } = input;
  let query = supabaseAdmin.from(table).select(select).limit(Math.min(limit, 100));
  for (const f of filters) query = applyFilter(query, f);
  if (order_by) query = query.order(order_by, { ascending });
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { rows: data, count: data?.length ?? 0 };
}

async function executeDbChange(supabaseAdmin: any, operation: any) {
  const { operation: op, table, data, filters = [] } = operation;
  if (op === 'insert') {
    const { data: result, error } = await supabaseAdmin.from(table).insert(data).select();
    if (error) throw new Error(error.message);
    return { inserted: result };
  }
  if (op === 'update') {
    let query = supabaseAdmin.from(table).update(data);
    for (const f of filters) query = applyFilter(query, f);
    const { data: result, error } = await (query as any).select();
    if (error) throw new Error(error.message);
    return { updated: result };
  }
  if (op === 'delete') {
    let query = supabaseAdmin.from(table).delete();
    for (const f of filters) query = applyFilter(query, f);
    const { data: result, error } = await (query as any).select();
    if (error) throw new Error(error.message);
    return { deleted: result };
  }
  throw new Error(`Unknown operation: ${op}`);
}

async function executeFileWrite(input: any) {
  const { path, content, commit_message } = input;
  // First, try to get the current SHA if file exists
  const getUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const getRes = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CWP-Admin-Assistant',
    },
  });

  let sha: string | undefined;
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  // Encode content to base64
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Content = btoa(binary);

  const putBody: any = {
    message: commit_message,
    content: base64Content,
  };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(getUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'CWP-Admin-Assistant',
    },
    body: JSON.stringify(putBody),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub write failed: ${putRes.status} — ${errText}`);
  }

  const result = await putRes.json();
  return {
    success: true,
    path,
    sha: result.content?.sha,
    commit: result.commit?.sha,
    url: result.content?.html_url,
  };
}

async function githubListDirectory(path: string) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CWP-Admin-Assistant',
    },
  });
  if (!res.ok) return { error: `GitHub ${res.status}: ${await res.text()}` };
  const items = await res.json();
  return {
    path,
    items: (Array.isArray(items) ? items : [items]).map((i: any) => ({
      name: i.name,
      type: i.type,
      path: i.path,
      size: i.size,
    })),
  };
}

async function githubGetFile(path: string) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CWP-Admin-Assistant',
    },
  });
  if (!res.ok) return { error: `GitHub ${res.status}: ${await res.text()}` };
  const data = await res.json();
  if (data.encoding === 'base64') {
    const content = atob(data.content.replace(/\n/g, ''));
    const truncated = content.length > 20000;
    return { path, content: truncated ? content.slice(0, 20000) + '\n\n[... file truncated at 20k chars ...]' : content, size: data.size };
  }
  return { error: 'Unsupported file encoding or file is a directory' };
}

async function githubGetIssues(limit = 10, state: 'open' | 'closed' | 'all' = 'open') {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/issues?state=${state}&per_page=${Math.min(limit, 30)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CWP-Admin-Assistant',
    },
  });
  if (!res.ok) return { error: `GitHub ${res.status}: ${await res.text()}` };
  const issues = await res.json();
  return {
    issues: (Array.isArray(issues) ? issues : []).map((i: any) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      created_at: i.created_at,
      labels: i.labels?.map((l: any) => l.name),
      url: i.html_url,
      body: i.body?.slice(0, 500),
    })),
  };
}

async function generateFeatureCode(input: any, model: string) {
  const { feature_description, target, context_files = [] } = input;

  // Read context files from GitHub
  const contextParts: string[] = [];
  for (const filePath of context_files.slice(0, 5)) {
    const fileData = await githubGetFile(filePath);
    if ('content' in fileData) {
      contextParts.push(`### ${filePath}\n\`\`\`\n${fileData.content}\n\`\`\``);
    }
  }

  const contextSection = contextParts.length > 0
    ? `## Reference Files\n${contextParts.join('\n\n')}\n\n`
    : '';

  const codeGenSystemPrompt = `You are an expert TypeScript/React developer working on CWP (Custom Website Plus). The platform uses: React 18, TypeScript, Tailwind CSS, Vite, Supabase (PostgreSQL + Edge Functions in Deno), Lucide icons, Vercel hosting. Generate production-ready code only. No placeholders. No TODOs unless genuinely complex. Follow existing patterns in the codebase. Always include proper TypeScript types. For React components: use functional components, hooks, existing AdminLayout wrapper for admin pages. For edge functions: use Deno, import from esm.sh, include CORS handling via _shared/utils.ts, include proper error handling. For SQL: use IF NOT EXISTS, include RLS policies, use snake_case for columns.`;

  const userPrompt = `${contextSection}## Task
Generate ${target} code for: ${feature_description}

Respond with a JSON object in this exact format:
{
  "code": "<the complete code>",
  "suggested_path": "<file path suggestion>",
  "description": "<brief description of what was generated>",
  "next_steps": ["<step 1>", "<step 2>"]
}`;

  const response = await anthropic.messages.create({
    model: model,
    max_tokens: 8000,
    system: codeGenSystemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Try to parse JSON response
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // fallback
  }

  return {
    code: text,
    suggested_path: `src/components/${feature_description.replace(/\s+/g, '')}.tsx`,
    description: feature_description,
    next_steps: ['Review the generated code', 'Test in development', 'Deploy when ready'],
  };
}

async function checkToolVersions() {
  const results: any = {};

  try {
    const supabaseRes = await fetch('https://api.github.com/repos/supabase/cli/releases/latest', {
      headers: { 'User-Agent': 'CWP-Admin-Assistant', Accept: 'application/vnd.github.v3+json' },
    });
    if (supabaseRes.ok) {
      const data = await supabaseRes.json();
      results.supabase_cli_latest = data.tag_name?.replace(/^v/, '') ?? 'unknown';
    } else {
      results.supabase_cli_latest = 'unavailable';
    }
  } catch {
    results.supabase_cli_latest = 'unavailable';
  }

  try {
    const claudeRes = await fetch('https://registry.npmjs.org/claude-code/latest', {
      headers: { 'User-Agent': 'CWP-Admin-Assistant' },
    });
    if (claudeRes.ok) {
      const data = await claudeRes.json();
      results.claude_code_latest = data.version ?? 'unknown';
    } else {
      results.claude_code_latest = 'unavailable';
    }
  } catch {
    results.claude_code_latest = 'unavailable';
  }

  return results;
}

async function executeTool(name: string, input: any, supabaseAdmin: any, model: string): Promise<any> {
  switch (name) {
    case 'list_tables':            return await listTables();
    case 'query_database':         return await queryDatabase(supabaseAdmin, input);
    case 'github_list_directory':  return await githubListDirectory(input.path ?? '');
    case 'github_get_file':        return await githubGetFile(input.path);
    case 'github_get_issues':      return await githubGetIssues(input.limit, input.state);
    case 'generate_feature_code':  return await generateFeatureCode(input, model);
    case 'check_tool_versions':    return await checkToolVersions();
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // ── Auth: verify user JWT using anon key client (NOT service role) ──────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return errorResponse('Invalid or expired token', 401);

    // Use service role for everything else
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return errorResponse('Admin access required', 403);

    const body = await req.json();
    const {
      messages: inputMessages = [],
      confirmed_operation,
      session_context,
      model: requestedModel,
    } = body;

    const model = requestedModel ?? 'claude-sonnet-4-5';
    const sessionContext: SessionContext | null = session_context ?? null;

    // Build message history
    let messages: Anthropic.Messages.MessageParam[] = [...inputMessages];

    // If admin approved/rejected a proposed DB change or file write, resolve the pending tool_use
    if (confirmed_operation?.tool_id) {
      let toolResultContent: string;

      if (confirmed_operation.type === 'file_write') {
        // File write confirmation
        if (confirmed_operation.approved) {
          try {
            const result = await executeFileWrite(confirmed_operation.operation);
            toolResultContent = JSON.stringify({ success: true, ...result });
          } catch (e: any) {
            toolResultContent = JSON.stringify({ success: false, error: e.message });
          }
        } else {
          toolResultContent = JSON.stringify({ success: false, rejected_by_admin: true, message: 'Admin chose not to write this file.' });
        }
      } else {
        // Database change confirmation
        if (confirmed_operation.approved) {
          try {
            const result = await executeDbChange(adminClient, confirmed_operation.operation);
            toolResultContent = JSON.stringify({ success: true, ...result });
          } catch (e: any) {
            toolResultContent = JSON.stringify({ success: false, error: e.message });
          }
        } else {
          toolResultContent = JSON.stringify({ success: false, rejected_by_admin: true, message: 'Admin chose not to apply this change.' });
        }
      }

      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: confirmed_operation.tool_id, content: toolResultContent }],
      });
    }

    // Agentic loop — up to 10 Claude turns
    const toolCallHistory: Array<{ tool: string; input: any; result: any }> = [];
    const systemPrompt = buildSystemPrompt(sessionContext);

    for (let turn = 0; turn < 10; turn++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        return jsonResponse({ type: 'response', content: text, tool_calls: toolCallHistory });
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          // propose_database_change → pause for admin confirmation
          if (block.name === 'propose_database_change') {
            const precedingText = response.content
              .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('\n')
              .trim();

            return jsonResponse({
              type: 'confirmation_required',
              confirmation_type: 'database',
              operation: block.input,
              tool_id: block.id,
              preceding_text: precedingText,
              messages,
            });
          }

          // write_file_to_github → pause for admin confirmation
          if (block.name === 'write_file_to_github') {
            const precedingText = response.content
              .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('\n')
              .trim();

            return jsonResponse({
              type: 'confirmation_required',
              confirmation_type: 'file_write',
              operation: block.input,
              tool_id: block.id,
              preceding_text: precedingText,
              messages,
            });
          }

          const result = await executeTool(block.name, block.input, adminClient, model);
          toolCallHistory.push({ tool: block.name, input: block.input, result });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          });
        }

        messages.push({ role: 'user', content: toolResults });
      }
    }

    return errorResponse('Reached maximum tool-use turns without completing.', 500);

  } catch (error: any) {
    console.error('[claude-admin-assistant] Error:', error.message);
    return errorResponse(error.message || 'Internal server error', 500);
  }
});
