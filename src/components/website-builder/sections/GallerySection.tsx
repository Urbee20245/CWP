import React, { useCallback, useEffect, useState } from 'react';
import { SectionComponentProps } from '../../../types/website';
import { ImageIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';

// ─── Placeholder image helper ──────────────────────────────────────────────────
const GalleryPlaceholder: React.FC<{ color: string; index: number; height?: string }> = ({ color, index, height = 'h-40' }) => (
  <div className={`${height} rounded-xl flex items-center justify-center`} style={{ backgroundColor: `${color}18` }}>
    <ImageIcon className="w-8 h-8 opacity-40" style={{ color }} />
  </div>
);

// ─── Grid (default) ───────────────────────────────────────────────────────────
const GalleryGrid: React.FC<SectionComponentProps & { variant?: string }> = ({ content, global: g, variant }) => {
  const images: string[] = content.images || [];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 text-center" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="text-slate-600 text-center mb-10" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        <div className={`grid gap-4 ${variant === 'masonry_grid' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
          {images.length > 0
            ? images.map((url, i) => (
                <div key={i} className="h-40 rounded-xl overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                </div>
              ))
            : Array.from({ length: variant === 'simple_grid' ? 8 : 6 }).map((_, i) => (
                <div key={i} className={`rounded-xl flex items-center justify-center ${variant === 'masonry_grid' && i % 3 === 0 ? 'row-span-2 h-64' : 'h-40'}`} style={{ backgroundColor: `${g.primary_color}18` }}>
                  <ImageIcon className="w-8 h-8 opacity-40" style={{ color: g.primary_color }} />
                </div>
              ))
          }
        </div>
      </div>
    </section>
  );
};

// ─── Masonry (CSS columns) ────────────────────────────────────────────────────
const GalleryMasonry: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const images: string[] = content.images || [];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 text-center" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="text-slate-600 text-center mb-10" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {images.length > 0
            ? images.map((url, i) => (
                <div key={i} className="break-inside-avoid rounded-xl overflow-hidden mb-4">
                  <img src={url} alt="" className="w-full object-cover hover:scale-105 transition-transform duration-300" />
                </div>
              ))
            : Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="break-inside-avoid mb-4">
                  <GalleryPlaceholder color={g.primary_color} index={i} height={i % 3 === 0 ? 'h-64' : 'h-40'} />
                </div>
              ))
          }
        </div>
      </div>
    </section>
  );
};

// ─── Carousel (embla-carousel) ─────────────────────────────────────────────────
const GalleryCarousel: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const images: string[] = content.images || [];
  const items = images.length > 0 ? images : Array.from({ length: 6 }).map(() => null);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', () => setSelectedIndex(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 text-center" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="text-slate-600 text-center mb-10" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        <div className="relative">
          <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
            <div className="flex">
              {items.map((url, i) => (
                <div key={i} className="flex-none w-full sm:w-1/2 lg:w-1/3 px-2">
                  {url ? (
                    <div className="h-64 rounded-xl overflow-hidden">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <GalleryPlaceholder color={g.primary_color} index={i} height="h-64" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button onClick={scrollPrev} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow">
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <button onClick={scrollNext} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow">
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>
        </div>
        <div className="flex justify-center gap-2 mt-6">
          {items.map((_, i) => (
            <button key={i} onClick={() => emblaApi?.scrollTo(i)} className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: i === selectedIndex ? g.primary_color : `${g.primary_color}40` }} />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Lightbox (grid + click to open) ─────────────────────────────────────────
const GalleryLightbox: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const images: string[] = content.images || [];

  const goNext = () => setLightboxIndex(prev => prev !== null ? (prev + 1) % images.length : null);
  const goPrev = () => setLightboxIndex(prev => prev !== null ? (prev - 1 + images.length) % images.length : null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex]);

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 text-center" style={{ fontFamily: g.font_heading }}>
          {content.heading}
        </h2>
        {content.subtext && (
          <p className="text-slate-600 text-center mb-10" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.length > 0
            ? images.map((url, i) => (
                <div key={i} className="h-40 rounded-xl overflow-hidden cursor-pointer group relative" onClick={() => setLightboxIndex(i)}>
                  <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors" />
                </div>
              ))
            : Array.from({ length: 8 }).map((_, i) => (
                <GalleryPlaceholder key={i} color={g.primary_color} index={i} />
              ))
          }
        </div>
      </div>
      {/* Lightbox overlay */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button className="absolute top-4 right-4 text-white p-2" onClick={() => setLightboxIndex(null)}>
            <X className="w-8 h-8" />
          </button>
          <button className="absolute left-4 text-white p-2" onClick={e => { e.stopPropagation(); goPrev(); }}>
            <ChevronLeft className="w-10 h-10" />
          </button>
          <img
            src={images[lightboxIndex]}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <button className="absolute right-4 text-white p-2" onClick={e => { e.stopPropagation(); goNext(); }}>
            <ChevronRight className="w-10 h-10" />
          </button>
          <div className="absolute bottom-4 text-white text-sm opacity-70">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </section>
  );
};

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const GallerySection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'grid';
  const allProps = { content, ...props };

  if (v === 'masonry' || v === 'masonry_grid') return <GalleryMasonry {...allProps} />;
  if (v === 'carousel')                        return <GalleryCarousel {...allProps} />;
  if (v === 'lightbox')                        return <GalleryLightbox {...allProps} />;
  return <GalleryGrid variant={v} {...allProps} />;
};

export default GallerySection;
