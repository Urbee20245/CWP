export const config = { auth: false };

/**
 * process-blog-schedules
 *
 * Designed to be called daily by a cron job (pg_cron or external scheduler).
 * Finds all active blog schedules where today's day-of-week is in days_of_week,
 * generates a blog post for each qualifying client, and updates schedule stats.
 *
 * Setup pg_cron (run once in Supabase SQL editor):
 *   SELECT cron.schedule(
 *     'process-blog-schedules',
 *     '0 8 * * *',   -- 8 AM UTC daily
 *     $$SELECT net.http_post(
 *       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-blog-schedules',
 *       headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}',
 *       body := '{}'
 *     )$$
 *   );
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, jsonResponse, errorResponse } from '../_shared/utils.ts';

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GENERATE_BLOG_FUNCTION_URL = `${SUPABASE_URL.replace('https://', 'https://')}/functions/v1/generate-blog-post`;
const SUPABASE_ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!;

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const today = DAY_NAMES[new Date().getDay()]; // e.g. 'monday'
    console.log(`[process-blog-schedules] Running for day: ${today}`);

    // Find all active schedules whose days_of_week includes today
    const { data: schedules, error: fetchError } = await supabaseAdmin
      .from('blog_schedules')
      .select('id, client_id, word_count, auto_publish, generate_images, total_posts_target, posts_generated, author_name, days_of_week')
      .eq('is_active', true)
      .contains('days_of_week', [today]);

    if (fetchError) {
      console.error('[process-blog-schedules] Failed to fetch schedules:', fetchError.message);
      return errorResponse('Failed to fetch schedules.', 500);
    }

    if (!schedules || schedules.length === 0) {
      console.log('[process-blog-schedules] No schedules to process today.');
      return jsonResponse({ processed: 0, message: `No schedules for ${today}.` });
    }

    console.log(`[process-blog-schedules] Found ${schedules.length} schedule(s) to process.`);

    const results: { client_id: string; status: string; post_id?: string; error?: string }[] = [];

    for (const schedule of schedules) {
      // If a target is set and already reached, deactivate and skip
      if (schedule.total_posts_target !== null && schedule.posts_generated >= schedule.total_posts_target) {
        await supabaseAdmin
          .from('blog_schedules')
          .update({ is_active: false })
          .eq('id', schedule.id);
        results.push({ client_id: schedule.client_id, status: 'target_reached_deactivated' });
        continue;
      }

      try {
        // Call generate-blog-post edge function
        const genRes = await fetch(GENERATE_BLOG_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            client_id:      schedule.client_id,
            word_count:     schedule.word_count,
            auto_publish:   schedule.auto_publish,
            generate_image: schedule.generate_images,
            author_name:    schedule.author_name,
            schedule_id:    schedule.id,
          }),
        });

        const genData = await genRes.json();

        if (!genRes.ok || !genData.success) {
          const errMsg = genData?.error || `HTTP ${genRes.status}`;
          console.error(`[process-blog-schedules] Generation failed for client ${schedule.client_id}:`, errMsg);
          results.push({ client_id: schedule.client_id, status: 'error', error: errMsg });
          continue;
        }

        // Update schedule stats
        const newCount  = (schedule.posts_generated || 0) + 1;
        const isReached = schedule.total_posts_target !== null && newCount >= schedule.total_posts_target;

        await supabaseAdmin
          .from('blog_schedules')
          .update({
            posts_generated: newCount,
            last_run_at:     new Date().toISOString(),
            is_active:       !isReached,
          })
          .eq('id', schedule.id);

        results.push({ client_id: schedule.client_id, status: 'generated', post_id: genData.post?.id });
        console.log(`[process-blog-schedules] Generated post for client ${schedule.client_id}: ${genData.post?.id}`);

      } catch (err: any) {
        console.error(`[process-blog-schedules] Exception for client ${schedule.client_id}:`, err.message);
        results.push({ client_id: schedule.client_id, status: 'exception', error: err.message });
      }
    }

    const successCount = results.filter(r => r.status === 'generated').length;
    console.log(`[process-blog-schedules] Done. ${successCount}/${schedules.length} posts generated.`);

    return jsonResponse({ processed: schedules.length, generated: successCount, results });

  } catch (error: any) {
    console.error('[process-blog-schedules] Fatal error:', error.message);
    return errorResponse(error.message, 500);
  }
});
