import React from 'react';
import { WebsiteJson, SectionType } from '../../types/website';
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

interface SiteRendererProps {
  websiteJson: WebsiteJson;
  currentPageId?: string;
  siteSlug: string;
}

type SectionComponent = React.FC<{ content: any; global: any; variant: string; siteSlug?: string }>;

const SECTION_MAP: Record<SectionType, SectionComponent> = {
  hero: HeroSection as SectionComponent,
  services: ServicesSection as SectionComponent,
  about: AboutSection as SectionComponent,
  social_proof: SocialProofSection as SectionComponent,
  contact_cta: ContactCtaSection as SectionComponent,
  faq: FaqSection as SectionComponent,
  stats: StatsSection as SectionComponent,
  gallery: GallerySection as SectionComponent,
  pricing_cards: PricingSection as SectionComponent,
  blog_preview: BlogPreviewSection as SectionComponent,
};

const SiteRenderer: React.FC<SiteRendererProps> = ({
  websiteJson,
  currentPageId = 'home',
  siteSlug,
}) => {
  const { global: g, pages } = websiteJson;

  // Find the active page; fall back to first page
  const activePage = pages.find(p => p.id === currentPageId) || pages[0];

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
        currentPageId={activePage?.id || 'home'}
      />

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
          />
        );
      })}

      <SiteFooter global={g} pages={pages} siteSlug={siteSlug} />
    </div>
  );
};

export default SiteRenderer;
