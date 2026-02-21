-- ─── Public Site Renderer: RLS & Schema Additions ────────────────────────────
--
-- 1. Add an anon-readable policy on website_briefs so the Coming Soon page
--    can be shown for unpublished slugs (the existing "Public can view
--    published sites" policy returns NULL for unpublished rows, making them
--    indistinguishable from truly missing slugs).
--
-- 2. Add cal_booking_link to client_cal_calendar so the Cal.com embed has a
--    stored URL to render.
--
-- 3. Add an anon-readable policy on client_cal_calendar (scoped to published
--    sites only) so the SiteRenderer can fetch the booking link.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. website_briefs: allow anon to check slug existence ────────────────────
-- The original "Public can view published sites" policy hides unpublished rows
-- entirely, so the renderer cannot distinguish "not found" from "coming soon".
-- This additive policy lets anon read any row that has a client_slug set,
-- which is needed purely to check is_published. The app renders content only
-- when is_published = true; unpublished sites show the Coming Soon screen.

DROP POLICY IF EXISTS "Public can check site status by slug" ON public.website_briefs;

CREATE POLICY "Public can check site status by slug"
  ON public.website_briefs
  FOR SELECT
  TO anon
  USING (client_slug IS NOT NULL);


-- ── 2. client_cal_calendar: add cal_booking_link column ─────────────────────
-- Stores the full Cal.com booking URL, e.g. https://cal.com/jane/30min
-- Admins / the cal-oauth-callback edge function set this after the OAuth flow.

ALTER TABLE public.client_cal_calendar
  ADD COLUMN IF NOT EXISTS cal_booking_link TEXT;

COMMENT ON COLUMN public.client_cal_calendar.cal_booking_link IS
  'Full Cal.com booking URL used by the public site renderer, '
  'e.g. https://cal.com/username/30min. '
  'Set by the admin or the cal-oauth-callback edge function after OAuth.';


-- ── 3. client_cal_calendar: anon read for published-site clients ─────────────
-- The SiteRenderer needs to fetch cal_booking_link for clients who have an
-- active, published website. Only rows whose owner has a published site are
-- visible to anon.

DROP POLICY IF EXISTS "Public can read cal booking link for published sites" ON public.client_cal_calendar;

CREATE POLICY "Public can read cal booking link for published sites"
  ON public.client_cal_calendar
  FOR SELECT
  TO anon
  USING (
    client_id IN (
      SELECT client_id
      FROM   public.website_briefs
      WHERE  is_published = true
      AND    client_slug  IS NOT NULL
    )
  );
