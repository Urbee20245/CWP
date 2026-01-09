// Helper to ensure a value is an array, even if it's null, undefined, or a single object.
export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  // Handle single object return from Supabase when expecting an array (e.g., count query)
  // We check if it's a non-null object that isn't already an array.
  if (typeof value === 'object' && value !== null) {
    return [value] as T[];
  }
  return [];
}

// Core normalization function (Part 1 - currently unused but kept for future expansion)
// This function is generally less useful than targeted DTO mapping for complex objects,
// but provides a generic safety net.
export function normalizeSupabaseResponse<T extends Record<string, any>>(data: T | null | undefined): T | null {
  if (!data) return null;

  const normalized: T = { ...data };

  // Apply normalization to common relational fields
  for (const key of ['threads', 'project_threads', 'messages', 'tasks', 'files', 'milestones']) {
    if (normalized[key] !== undefined) {
      normalized[key] = ensureArray(normalized[key]);
    }
  }

  return normalized;
}