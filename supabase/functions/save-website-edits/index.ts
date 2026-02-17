export const config = {
  auth: false,
};

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Resolve a dot-path like "content.services[0].description" into a value from an object
function getByPath(obj: any, path: string): any {
  return path.split(/[\.\[\]]+/).filter(Boolean).reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[isNaN(Number(key)) ? key : Number(key)];
  }, obj);
}

// Set a value at a dot-path — returns a deep clone with the value updated
function setByPath(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const parts = path.split(/[\.\[\]]+/).filter(Boolean);
  let cursor: any = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = isNaN(Number(parts[i])) ? parts[i] : Number(parts[i]);
    cursor = cursor[key];
    if (cursor === undefined || cursor === null) return clone; // path doesn't exist, skip
  }
  const lastKey = isNaN(Number(parts[parts.length - 1])) ? parts[parts.length - 1] : Number(parts[parts.length - 1]);
  cursor[lastKey] = value;
  return clone;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Missing authorization header.', 401);

  // Verify the user's JWT to get their profile id
  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return errorResponse('Unauthorized.', 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { client_id, edits } = await req.json();
    // edits: Array<{ field_path: string; new_value: string }>

    if (!client_id || !Array.isArray(edits)) {
      return errorResponse('Missing client_id or edits array.', 400);
    }

    // Verify the requesting user owns this client
    const { data: clientRow } = await supabaseAdmin
      .from('clients')
      .select('id, owner_profile_id')
      .eq('id', client_id)
      .single();

    if (!clientRow || clientRow.owner_profile_id !== user.id) {
      return errorResponse('Access denied.', 403);
    }

    // Fetch the current brief
    const { data: brief, error: briefError } = await supabaseAdmin
      .from('website_briefs')
      .select('website_json')
      .eq('client_id', client_id)
      .single();

    if (briefError || !brief?.website_json) {
      return errorResponse('Website not found.', 404);
    }

    // Collect all allowed editable_fields across all sections
    const allowedPaths = new Set<string>();
    for (const section of brief.website_json.page_structure || []) {
      for (const path of section.editable_fields || []) {
        allowedPaths.add(path);
      }
    }
    // Also allow global fields
    ['global.phone', 'global.address'].forEach(p => allowedPaths.add(p));

    // Validate and apply edits
    let updatedJson = brief.website_json;
    const rejected: string[] = [];

    for (const edit of edits) {
      const { field_path, new_value } = edit;
      if (!field_path || typeof new_value !== 'string') continue;

      // Check if this path is allowed. We check both exact match and pattern match
      // (e.g., "content.services[0].description" should match "content.services[0].description")
      const isAllowed = allowedPaths.has(field_path);

      if (!isAllowed) {
        console.warn(`[save-website-edits] Rejected unauthorized path: ${field_path}`);
        rejected.push(field_path);
        continue;
      }

      // Apply the edit to the correct section or global
      if (field_path.startsWith('global.')) {
        const globalKey = field_path.replace('global.', '');
        updatedJson = { ...updatedJson, global: { ...updatedJson.global, [globalKey]: new_value } };
      } else {
        // Find which section owns this path
        for (let i = 0; i < updatedJson.page_structure.length; i++) {
          const section = updatedJson.page_structure[i];
          if ((section.editable_fields || []).includes(field_path)) {
            // path is relative to the section — field_path already has "content." prefix
            const newSection = setByPath(section, field_path, new_value);
            const newStructure = [...updatedJson.page_structure];
            newStructure[i] = newSection;
            updatedJson = { ...updatedJson, page_structure: newStructure };
            break;
          }
        }
      }
    }

    // Save back
    const { error: saveError } = await supabaseAdmin
      .from('website_briefs')
      .update({ website_json: updatedJson })
      .eq('client_id', client_id);

    if (saveError) {
      console.error('[save-website-edits] Save error:', saveError.message);
      return errorResponse('Failed to save edits.', 500);
    }

    console.log(`[save-website-edits] Saved edits for client_id=${client_id}. Rejected paths: ${rejected.join(', ') || 'none'}`);
    return jsonResponse({ success: true, rejected });

  } catch (error: any) {
    console.error('[save-website-edits] Unhandled error:', error.message);
    return errorResponse(error.message, 500);
  }
});
