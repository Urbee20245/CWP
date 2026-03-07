// ─── Autonomous Supabase Provisioning Tools ───────────────────────────────────
// Gives Claude the ability to create Supabase infrastructure (tables, functions,
// storage buckets, RLS policies) during site import/generation.
//
// Prerequisites — run once in Supabase SQL Editor:
//
//   CREATE OR REPLACE FUNCTION exec(query text)
//   RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
//   BEGIN EXECUTE query; END; $$;
//
//   REVOKE ALL ON FUNCTION exec(text) FROM PUBLIC;
//   GRANT EXECUTE ON FUNCTION exec(text) TO service_role;
//
//   CREATE TABLE IF NOT EXISTS ai_provisioned_resources (
//     id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//     client_id    text NOT NULL,
//     resource_type text NOT NULL,
//     resource_name text NOT NULL,
//     details      jsonb DEFAULT '{}',
//     sql_executed  text,
//     status       text NOT NULL DEFAULT 'created',
//     created_at   timestamptz DEFAULT now()
//   );
//   ALTER TABLE ai_provisioned_resources ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "service_role_all" ON ai_provisioned_resources
//     FOR ALL TO service_role USING (true);

// ─── Anthropic tool definitions (tool_use format) ───────────────────────────

export const SUPABASE_TOOLS = [
  {
    name: 'create_table',
    description: 'Create a new PostgreSQL table in the Supabase database with the specified columns and RLS enabled.',
    input_schema: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'Name of the table to create (snake_case)',
        },
        columns: {
          type: 'array',
          description: 'Column definitions',
          items: {
            type: 'object',
            properties: {
              name:       { type: 'string', description: 'Column name' },
              type:       { type: 'string', description: 'PostgreSQL type (text, uuid, timestamptz, boolean, jsonb, integer, numeric)' },
              nullable:   { type: 'boolean', description: 'Whether NULL is allowed', default: true },
              default:    { type: 'string',  description: 'Default value expression (optional)' },
              primary_key:{ type: 'boolean', description: 'Mark as primary key', default: false },
            },
            required: ['name', 'type'],
          },
        },
        rls_policies: {
          type: 'array',
          description: 'RLS policies to create',
          items: {
            type: 'object',
            properties: {
              name:    { type: 'string', description: 'Policy name' },
              command: { type: 'string', enum: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'], description: 'SQL command' },
              role:    { type: 'string', description: 'Role (anon, authenticated, service_role)' },
              using:   { type: 'string', description: 'USING expression (optional)' },
              check:   { type: 'string', description: 'WITH CHECK expression (optional)' },
            },
            required: ['name', 'command', 'role'],
          },
        },
      },
      required: ['table_name', 'columns'],
    },
  },
  {
    name: 'run_sql',
    description: 'Run arbitrary SQL against the Supabase database. Use for index creation, triggers, data seeding, or anything not covered by create_table.',
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'Valid PostgreSQL SQL to execute',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this SQL does',
        },
      },
      required: ['sql', 'description'],
    },
  },
  {
    name: 'create_storage_bucket',
    description: 'Create a Supabase Storage bucket for file uploads (images, documents, etc).',
    input_schema: {
      type: 'object',
      properties: {
        bucket_name: {
          type: 'string',
          description: 'Bucket name (lowercase, hyphens allowed)',
        },
        public: {
          type: 'boolean',
          description: 'Whether the bucket is publicly readable',
          default: false,
        },
        allowed_mime_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Allowed MIME types (e.g. ["image/jpeg", "image/png"])',
        },
        file_size_limit: {
          type: 'integer',
          description: 'Maximum file size in bytes',
          default: 5242880,
        },
      },
      required: ['bucket_name'],
    },
  },
  {
    name: 'provision_complete',
    description: 'Signal that all required infrastructure has been provisioned. Also return the website_json for the site.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Brief summary of what was provisioned',
        },
        website_json: {
          type: 'object',
          description: 'The complete website_json object for the CWP site',
        },
      },
      required: ['summary', 'website_json'],
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ProvisionedResource {
  resource_type: string;
  resource_name: string;
  details: Record<string, any>;
  sql_executed?: string;
  status: 'created' | 'skipped' | 'error';
}

/**
 * Execute a single Claude tool call against the live Supabase instance.
 * Returns a structured result and (optionally) the provisioned resource record.
 */
export async function executeSupabaseTool(
  toolName: string,
  toolInput: any,
  supabaseAdmin: any,
  clientId: string,
): Promise<{ result: ToolResult; resource?: ProvisionedResource }> {

  console.log(`[supabase-tools] Executing tool: ${toolName}`, JSON.stringify(toolInput).slice(0, 200));

  try {
    switch (toolName) {

      case 'create_table': {
        const { table_name, columns, rls_policies = [] } = toolInput;

        // Build CREATE TABLE SQL
        const colDefs = columns.map((col: any) => {
          let def = `"${col.name}" ${col.type}`;
          if (col.primary_key) def += ' PRIMARY KEY';
          if (!col.nullable && !col.primary_key) def += ' NOT NULL';
          if (col.default !== undefined) def += ` DEFAULT ${col.default}`;
          return def;
        });

        // Add standard audit columns if not present
        const hasId = columns.some((c: any) => c.primary_key || c.name === 'id');
        const hasCreatedAt = columns.some((c: any) => c.name === 'created_at');
        if (!hasId) colDefs.unshift('"id" uuid DEFAULT gen_random_uuid() PRIMARY KEY');
        if (!hasCreatedAt) colDefs.push('"created_at" timestamptz DEFAULT now()');

        const createSql = [
          `CREATE TABLE IF NOT EXISTS "${table_name}" (`,
          colDefs.map(d => `  ${d}`).join(',\n'),
          ');',
          `ALTER TABLE "${table_name}" ENABLE ROW LEVEL SECURITY;`,
          ...rls_policies.map((p: any) => {
            const parts = [
              `CREATE POLICY "${p.name}" ON "${table_name}"`,
              `FOR ${p.command} TO ${p.role}`,
            ];
            if (p.using) parts.push(`USING (${p.using})`);
            if (p.check) parts.push(`WITH CHECK (${p.check})`);
            return parts.join(' ') + ';';
          }),
        ].join('\n');

        // Execute via the exec() SQL function
        const { error } = await supabaseAdmin.rpc('exec', { query: createSql });
        if (error) throw new Error(error.message);

        // Log the resource
        await supabaseAdmin.from('ai_provisioned_resources').insert({
          client_id: clientId,
          resource_type: 'table',
          resource_name: table_name,
          details: { columns: columns.length, rls_policies: rls_policies.length },
          sql_executed: createSql,
          status: 'created',
        });

        return {
          result: { success: true, output: `Table "${table_name}" created with ${columns.length} columns and ${rls_policies.length} RLS policies.` },
          resource: { resource_type: 'table', resource_name: table_name, details: {}, sql_executed: createSql, status: 'created' },
        };
      }

      case 'run_sql': {
        const { sql, description } = toolInput;
        const { error } = await supabaseAdmin.rpc('exec', { query: sql });
        if (error) throw new Error(error.message);

        await supabaseAdmin.from('ai_provisioned_resources').insert({
          client_id: clientId,
          resource_type: 'sql',
          resource_name: description.slice(0, 80),
          details: { description },
          sql_executed: sql,
          status: 'created',
        });

        return {
          result: { success: true, output: `SQL executed: ${description}` },
          resource: { resource_type: 'sql', resource_name: description, details: {}, sql_executed: sql, status: 'created' },
        };
      }

      case 'create_storage_bucket': {
        const {
          bucket_name,
          public: isPublic = false,
          allowed_mime_types,
          file_size_limit = 5 * 1024 * 1024,
        } = toolInput;

        // Create bucket via Supabase Storage Admin API
        const { error } = await supabaseAdmin.storage.createBucket(bucket_name, {
          public: isPublic,
          allowedMimeTypes: allowed_mime_types || null,
          fileSizeLimit: file_size_limit,
        });

        // Ignore "already exists" errors
        if (error && !error.message?.includes('already exists')) {
          throw new Error(error.message);
        }

        await supabaseAdmin.from('ai_provisioned_resources').insert({
          client_id: clientId,
          resource_type: 'storage_bucket',
          resource_name: bucket_name,
          details: { public: isPublic, file_size_limit, allowed_mime_types },
          status: error ? 'skipped' : 'created',
        });

        return {
          result: { success: true, output: `Storage bucket "${bucket_name}" ${error ? 'already exists (skipped)' : 'created'}.` },
          resource: { resource_type: 'storage_bucket', resource_name: bucket_name, details: {}, status: error ? 'skipped' : 'created' },
        };
      }

      case 'provision_complete':
        // This is a signal tool — no DB operation needed
        return {
          result: { success: true, output: `Provisioning complete: ${toolInput.summary}` },
        };

      default:
        return {
          result: { success: false, output: '', error: `Unknown tool: ${toolName}` },
        };
    }
  } catch (err: any) {
    const errMsg = err.message || String(err);
    console.error(`[supabase-tools] Tool ${toolName} failed:`, errMsg);

    // Log the error to provisioned resources
    try {
      await supabaseAdmin.from('ai_provisioned_resources').insert({
        client_id: clientId,
        resource_type: toolName,
        resource_name: toolInput.table_name || toolInput.bucket_name || toolInput.description || toolName,
        details: { error: errMsg, input: toolInput },
        status: 'error',
      });
    } catch { /* ignore secondary failure */ }

    return {
      result: { success: false, output: '', error: errMsg },
      resource: { resource_type: toolName, resource_name: toolName, details: { error: errMsg }, status: 'error' },
    };
  }
}

// ─── System prompt for autonomous provisioning ────────────────────────────────

export const AUTONOMOUS_SUPABASE_SYSTEM = `You are an expert full-stack developer migrating an existing website into CWP. You have two jobs:

JOB 1 — PROVISION INFRASTRUCTURE
The source site has backend features that need real Supabase infrastructure:
- For contact_form: create a "contact_submissions" table + storage if needed
- For ecommerce: create "products" and "orders" tables with appropriate columns
- For auth_pages: the client back-office premium feature handles this — just note it
- For api_calls: create "api_cache" or equivalent tables as needed
- For wordpress_cms / blog: create "blog_posts" table
- For comments: create "comments" table
- For search: no special infrastructure needed — just note it

For each feature, call the appropriate tool (create_table, run_sql, create_storage_bucket).
Enable RLS on all tables. Add a policy allowing "anon" INSERT for public-facing tables.
Add a policy allowing "service_role" ALL for admin access.

JOB 2 — GENERATE WEBSITE JSON
After provisioning is complete, call provision_complete with the full website_json.
The website_json must follow the CWP schema (global + pages array).

SCHEMA REMINDER:
{
  "global": { "business_name", "phone", "address", "primary_color", "font_heading", "font_body", "logo_url": "", "hero_image_url": "" },
  "pages": [{ "id", "name", "slug", "seo": { "title", "meta_description", "keywords" }, "sections": [...] }]
}

SECTION TYPES: hero, services, about, social_proof, contact_cta, faq, stats, gallery, pricing_cards, blog_preview
Always include a contact_cta section on every page.

Use real content from the source site. Return ONLY the complete JSON in provision_complete.`;

// ─── Agentic provisioning loop ────────────────────────────────────────────────

/**
 * Run an agentic loop with Claude using tool_use to:
 * 1. Provision the required Supabase infrastructure
 * 2. Return the website_json for the site
 *
 * Requires ANTHROPIC_API_KEY to be set — only works with Claude models.
 */
export async function generateWithSupabaseAutonomy(
  userPrompt: string,
  supabaseAdmin: any,
  clientId: string,
  model = 'claude-opus-4-5',
  maxTurns = 10,
): Promise<any> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for autonomous provisioning.');

  const messages: any[] = [{ role: 'user', content: userPrompt }];
  let websiteJson: any = null;
  let turn = 0;

  while (turn < maxTurns) {
    turn++;
    console.log(`[supabase-tools] Agentic turn ${turn}/${maxTurns}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system: AUTONOMOUS_SUPABASE_SYSTEM,
        tools: SUPABASE_TOOLS,
        messages,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const stopReason: string = data.stop_reason;
    const content: any[] = data.content || [];

    // Add assistant turn to conversation
    messages.push({ role: 'assistant', content });

    if (stopReason === 'end_turn') {
      // Claude finished without tool calls — extract any JSON from text
      const textBlock = content.find((b: any) => b.type === 'text');
      if (textBlock?.text) {
        const cleaned = textBlock.text
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        try { websiteJson = JSON.parse(cleaned); } catch { /* ignore */ }
      }
      break;
    }

    if (stopReason === 'tool_use') {
      const toolUseBlocks = content.filter((b: any) => b.type === 'tool_use');
      const toolResults: any[] = [];

      for (const tool of toolUseBlocks) {
        const { result, } = await executeSupabaseTool(
          tool.name,
          tool.input,
          supabaseAdmin,
          clientId,
        );

        // If this is provision_complete, capture the website_json
        if (tool.name === 'provision_complete' && tool.input?.website_json) {
          websiteJson = tool.input.website_json;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: result.success
            ? result.output
            : `ERROR: ${result.error}`,
        });
      }

      messages.push({ role: 'user', content: toolResults });

      // If we received provision_complete, we have the website_json — stop
      if (websiteJson) break;
    } else {
      // Unexpected stop reason
      console.warn(`[supabase-tools] Unexpected stop_reason: ${stopReason}`);
      break;
    }
  }

  if (!websiteJson) {
    throw new Error('Autonomous provisioning did not return a website_json after ' + turn + ' turns.');
  }

  return websiteJson;
}
