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

interface SiteRendererProps {
  websiteJson: WebsiteJson;
}

type SectionComponent = React.FC<{ content: any; global: any; variant: string }>;

const SECTION_MAP: Record<SectionType, SectionComponent> = {
  hero: HeroSection as SectionComponent,
  services: ServicesSection as SectionComponent,
  about: AboutSection as SectionComponent,
  social_proof: SocialProofSection as SectionComponent,
  contact_cta: ContactCtaSection as SectionComponent,
  faq: FaqSection as SectionComponent,
  stats: StatsSection as SectionComponent,
  gallery: GallerySection as SectionComponent,
};

const SiteRenderer: React.FC<SiteRendererProps> = ({ websiteJson }) => {
  const { global: g, page_structure } = websiteJson;

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
      <SiteHeader global={g} />

      {page_structure.map((section, i) => {
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
          />
        );
      })}

      <SiteFooter global={g} />
    </div>
  );
};

export default SiteRenderer;
