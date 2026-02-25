import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GITHUB_REPO = 'Urbee20245/CWP';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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
];

// ─── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an intelligent admin assistant for CWP (Custom Websites Plus), a SaaS platform for web agencies.

You have two main capabilities:
1. **Supabase database access** – query clients, projects, billing, appointments, and more.
2. **GitHub repository access** – browse and read files in the CWP codebase (Urbee20245/CWP), view issues.

Key database tables include: profiles, clients, projects, appointments, billing_products, subscriptions, invoices, website_briefs, sms_messages, blog_posts, voice_integrations, addons.

Guidelines:
- Be concise and helpful. Use markdown for formatting when returning data.
- Always query before proposing updates — confirm you have the right record.
- When proposing a database change, write a clear, specific description of the change.
- Never expose raw tokens, passwords, or secrets.
- If asked to modify multiple records, propose them one at a time so the admin can review each.`;

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
    // Truncate large files to avoid token overflow
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

async function executeTool(name: string, input: any, supabaseAdmin: any): Promise<any> {
  switch (name) {
    case 'list_tables':            return await listTables();
    case 'query_database':         return await queryDatabase(supabaseAdmin, input);
    case 'github_list_directory':  return await githubListDirectory(input.path ?? '');
    case 'github_get_file':        return await githubGetFile(input.path);
    case 'github_get_issues':      return await githubGetIssues(input.limit, input.state);
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ─── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Verify admin JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return errorResponse('Unauthorized', 401);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') return errorResponse('Forbidden: admin access required', 403);

    const body = await req.json();
    const { messages: inputMessages = [], confirmed_operation } = body;

    // Build message history, ensuring valid alternation
    let messages: Anthropic.Messages.MessageParam[] = [...inputMessages];

    // If admin approved/rejected a proposed DB change, resolve the pending tool_use
    if (confirmed_operation?.tool_id) {
      let toolResultContent: string;
      if (confirmed_operation.approved) {
        try {
          const result = await executeDbChange(supabaseAdmin, confirmed_operation.operation);
          toolResultContent = JSON.stringify({ success: true, ...result });
        } catch (e: any) {
          toolResultContent = JSON.stringify({ success: false, error: e.message });
        }
      } else {
        toolResultContent = JSON.stringify({ success: false, rejected_by_admin: true, message: 'Admin chose not to apply this change.' });
      }
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: confirmed_operation.tool_id, content: toolResultContent }],
      });
    }

    // Agentic loop — up to 10 Claude turns
    const toolCallHistory: Array<{ tool: string; input: any; result: any }> = [];

    for (let turn = 0; turn < 10; turn++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      // Append Claude's response to history
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
            // Extract any text Claude produced before the tool call
            const precedingText = response.content
              .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('\n')
              .trim();

            return jsonResponse({
              type: 'confirmation_required',
              operation: block.input,
              tool_id: block.id,
              preceding_text: precedingText,
              messages,  // full history so frontend can resume
            });
          }

          const result = await executeTool(block.name, block.input, supabaseAdmin);
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
