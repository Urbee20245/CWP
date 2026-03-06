// ─── Complete Platform Capabilities Schema ────────────────────────────────────
// Used by ai-command and website-chat edge functions for AI website editing.
// Keep this file as the single source of truth for section types and variants.

export const SECTION_CAPABILITIES = `
━━━ COMPLETE PLATFORM CAPABILITIES ━━━

SECTION VARIANTS — set the "variant" field on any section object:

hero: centered | split_left | split_right | video_bg | minimal | gradient | parallax
  split_left/split_right use content.image_url for the image panel
  video_bg uses content.video_url for looping background video
  gradient animates brand colors, parallax does scroll parallax on background_image_url

services: grid | cards | icons_grid | list | tabs | accordion
  any item can have: icon_name (e.g. "mdi:home", "tabler:phone", "heroicons:star")

social_proof: grid | slider | marquee | cards_3d | minimal
  slider auto-plays every 4s with dot nav, marquee infinite CSS scroll

gallery: grid | masonry | carousel | lightbox
  carousel uses embla touch-swipe, lightbox opens fullscreen on click

stats: row | grid | large
  ALL stats variants: numbers animate up from 0 on scroll (no extra config needed)

faq: accordion | two_col | minimal
  minimal uses +/- icons, two_col renders cards in a 2-column grid

team: card_grid | cards | carousel | founder_spotlight | minimal_list
  cards variant reveals bio overlay on hover, carousel is touch-swipeable

pricing_cards: cards | toggle | comparison_table
  toggle adds monthly/annual switch (use price_annual field on each tier)
  comparison_table auto-builds feature matrix from all tiers' features arrays

contact_form: standard | dark | stacked | side_by_side | minimal

about: split | centered_story | founder_focus | full_width | timeline | story
  timeline uses content.milestones: [{year, title, description}]
  story uses content.paragraphs: ["para 1", "para 2", ...]

process: steps | timeline | horizontal_flow | numbered | cards
  numbered shows giant transparent numbers with scroll reveal

features: grid | alternating | bento | icon_list | alternating_blocks | checklist
  alternating alternates image/text sides down the page with scroll reveal
  bento: first item is 2-col wide if ≥4 items; set item.size:"large" to force

newsletter: centered | banner | minimal
  all variants fire confetti on subscribe

━━━ NEW SECTION TYPES ━━━

Add any of these as new objects in pages[n].sections:

VIDEO:
{ section_type: "video", variant: "contained", content: { video_url: "https://...", title: "...", subtitle: "...", autoplay: false, loop: false } }
variants: contained | full_width | with_text_left | with_text_right

MAP:
{ section_type: "map_embed", variant: "split", content: { lat: 40.7128, lng: -74.006, zoom: 15, title: "Find Us", address: "123 Main St", hours: "Mon-Fri 9-5" } }
variants: split | full_width

TIMELINE:
{ section_type: "timeline", content: { heading: "Our Journey", items: [{ year: "2018", title: "Founded", description: "..." }] } }

COUNTDOWN:
{ section_type: "countdown", content: { heading: "Grand Opening", target_date: "2025-12-31T00:00:00Z", subtitle: "Don't miss it!" } }

LOGO GRID (clients/partners):
{ section_type: "logo_grid", variant: "marquee", content: { heading: "Trusted By", logos: [{ name: "Acme", image_url: "...", url: "https://acme.com" }] } }
variants: grid | marquee

BEFORE/AFTER:
{ section_type: "before_after", content: { heading: "See the Difference", before_image: "...", after_image: "...", subtext: "..." } }

CTA BANNER:
{ section_type: "cta_banner", variant: "gradient", content: { heading: "Ready to Start?", subtext: "...", button_text: "Get Started", button_url: "#contact" } }
variants: solid | gradient | image_bg

AWARDS:
{ section_type: "awards", variant: "badges", content: { heading: "Recognition", items: [{ title: "Best in Class", issuer: "Industry Mag", year: "2024", image_url: "..." }] } }
variants: grid | list | badges

━━━ ICON NAMES ━━━

Use Iconify icon names on any service/feature item:
  "mdi:home"  "tabler:phone"  "heroicons:star"  "mdi:check-circle"
  "mdi:shield-check"  "tabler:clock"  "mdi:map-marker"
Full library: https://icon-sets.iconify.design/

━━━ FOOTER FIELDS (inside global object) ━━━

  footer_links: [{label, url, target}]
  service_areas: ["City, State", ...]
  staff_login_url: "/admin/login"
  footer_tagline: "tagline text"

━━━ RULES ━━━

Always use exact field names. Always return the complete website_json. Never truncate.`;
