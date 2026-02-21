import React from 'react';
import { WebsiteJson, SectionType, PremiumFeatureId } from '../../types/website';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import HeroSection from './sections/HeroSection';
import ServicesSection from './sections/ServicesSection';
import AboutSection from './sections/AboutSection';
import SocialProofSection from './sections/SocialProofSection';
import ContactCtaSection from './sections/ContactCtaSection';
import FaqSection from './sections/FaqSection';
import StatsSection from './sections/StatsSection';
import GallerySection from './sections/GallerySection';
import PricingSection from './sections/PricingSection';
import BlogPreviewSection from './sections/BlogPreviewSection';
import ContactFormSection from './sections/ContactFormSection';
import CalendarSection from './sections/CalendarSection';
import ChatWidgetSection from './sections/ChatWidgetSection';
import BlogLatestSection from './sections/BlogLatestSection';

interface SiteRendererProps {
  websiteJson: WebsiteJson;
  currentPageId?: string;
  siteSlug: string;
  customDomain?: boolean;
  /** Premium feature IDs enabled for this client site */
  premiumFeatures?: PremiumFeatureId[];
  /** Supabase client_id — needed for blog post lookups */
  clientId?: string;
  /** Full Cal.com booking URL, e.g. "https://cal.com/jane/30min" */
  calBookingLink?: string;
}

type SectionComponent = React.FC<{
  content: any;
  global: any;
  variant: string;
  siteSlug?: string;
  customDomain?: boolean;
}>;

const SECTION_MAP: Record<SectionType, SectionComponent> = {
  hero:          HeroSection         as SectionComponent,
  services:      ServicesSection     as SectionComponent,
  about:         AboutSection        as SectionComponent,
  social_proof:  SocialProofSection  as SectionComponent,
  contact_cta:   ContactCtaSection   as SectionComponent,
  contact_form:  ContactFormSection  as SectionComponent,
  faq:           FaqSection          as SectionComponent,
  stats:         StatsSection        as SectionComponent,
  gallery:       GallerySection      as SectionComponent,
  pricing_cards: PricingSection      as SectionComponent,
  blog_preview:  BlogPreviewSection  as SectionComponent,
};

const SiteRenderer: React.FC<SiteRendererProps> = ({
  websiteJson,
  currentPageId = 'home',
  siteSlug,
  customDomain,
  premiumFeatures = [],
  clientId,
  calBookingLink,
}) => {
  const { global: g, pages } = websiteJson;

  // Find the active page; fall back to the first page
  const activePage = pages.find(p => p.id === currentPageId) ?? pages[0];

  // ── Premium feature flags ──────────────────────────────────────────────────
  const hasCalendar = premiumFeatures.includes('cal_com') && !!calBookingLink;

  // Render a contact form section if the premium feature is enabled AND
  // the current page doesn't already have one (avoids duplicates).
  const hasContactFormFeature = premiumFeatures.includes('contact_forms');
  const pageHasContactForm =
    activePage?.sections.some(s => s.section_type === 'contact_form') ?? false;
  const showExtraContactForm = hasContactFormFeature && !pageHasContactForm;

  const hasChatWidget =
    premiumFeatures.includes('chat_widget') ||
    premiumFeatures.includes('ai_chatbot');

  const hasBlog = premiumFeatures.includes('blog') && !!clientId;

  return (
    <div
      className="min-h-screen font-sans"
      style={
        {
          '--brand-color': g.primary_color,
          fontFamily: g.font_body || 'Inter, sans-serif',
        } as React.CSSProperties
      }
    >
      <SiteHeader
        global={g}
        pages={pages}
        siteSlug={siteSlug}
        currentPageId={activePage?.id ?? 'home'}
        customDomain={customDomain}
      />

      {/* ── Standard page sections from website_json ── */}
      {activePage?.sections.map((section, i) => {
        const Component = SECTION_MAP[section.section_type as SectionType];
        if (!Component) {
          console.warn(`[SiteRenderer] Unknown section_type: ${section.section_type}`);
          return null;
        }
        return (
          <Component
            key={i}
            content={section.content}
            global={g}
            variant={section.variant}
            siteSlug={siteSlug}
            customDomain={customDomain}
          />
        );
      })}

      {/* ── Premium: contact form (only when not already in page sections) ── */}
      {showExtraContactForm && (
        <ContactFormSection
          content={{}}
          global={g}
          variant="standard"
          siteSlug={siteSlug}
          customDomain={customDomain}
        />
      )}

      {/* ── Premium: Cal.com booking calendar ── */}
      {hasCalendar && (
        <CalendarSection global={g} calLink={calBookingLink!} />
      )}

      {/* ── Premium: blog latest posts ── */}
      {hasBlog && (
        <BlogLatestSection
          global={g}
          clientId={clientId!}
          siteSlug={siteSlug}
          customDomain={customDomain}
        />
      )}

      <SiteFooter
        global={g}
        pages={pages}
        siteSlug={siteSlug}
        customDomain={customDomain}
      />

      {/* ── Premium: floating chat widget (rendered outside flow) ── */}
      {hasChatWidget && <ChatWidgetSection global={g} />}
    </div>
  );
};

export default SiteRenderer;
