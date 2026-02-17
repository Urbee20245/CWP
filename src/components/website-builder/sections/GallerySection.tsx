import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { ImageIcon } from 'lucide-react';

// Gallery renders a placeholder grid since images are uploaded separately
const GallerySection: React.FC<SectionComponentProps & { variant: string }> = ({ content, global: g, variant }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-6xl mx-auto">
      <h2
        className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 text-center"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      {content.subtext && (
        <p className="text-slate-600 text-center mb-10" style={{ fontFamily: g.font_body }}>
          {content.subtext}
        </p>
      )}
      <div
        className={`grid gap-4 ${variant === 'masonry_grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}
      >
        {Array.from({ length: variant === 'simple_grid' ? 8 : 6 }).map((_, i) => (
          <div
            key={i}
            className={`rounded-xl flex items-center justify-center ${variant === 'masonry_grid' && i % 3 === 0 ? 'row-span-2 h-64' : 'h-40'}`}
            style={{ backgroundColor: `${g.primary_color}${12 + i * 3}` }}
          >
            <ImageIcon className="w-8 h-8 opacity-40" style={{ color: g.primary_color }} />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default GallerySection;
