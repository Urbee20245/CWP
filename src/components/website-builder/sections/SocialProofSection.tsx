import React, { useCallback, useEffect, useRef } from 'react';
import { SectionComponentProps } from '../../../types/website';
import { Star } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';

const StarRating: React.FC<{ stars: number; color: string }> = ({ stars, color }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        className="w-4 h-4"
        fill={i <= stars ? color : 'transparent'}
        stroke={color}
      />
    ))}
  </div>
);

// ─── ReviewCard ───────────────────────────────────────────────────────────────
const ReviewCard: React.FC<{ review: any; color: string; fontHeading: string; fontBody: string }> = ({
  review, color, fontHeading, fontBody,
}) => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-full">
    <StarRating stars={review.stars || 5} color={color} />
    <p className="mt-4 text-slate-700 italic leading-relaxed flex-1" style={{ fontFamily: fontBody }}>
      "{review.text}"
    </p>
    <p className="mt-4 font-semibold text-slate-900 text-sm" style={{ fontFamily: fontHeading }}>
      — {review.author}
    </p>
  </div>
);

// ─── Grid (default) ────────────────────────────────────────────────────────────
const StarTestimonials: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-slate-50">
    <div className="max-w-6xl mx-auto">
      <h2
        className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(content.reviews || []).map((review: any, i: number) => (
          <ReviewCard key={i} review={review} color={g.primary_color} fontHeading={g.font_heading} fontBody={g.font_body} />
        ))}
      </div>
    </div>
  </section>
);

// ─── Slider (embla-carousel) ───────────────────────────────────────────────────
const SliderTestimonials: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reviews: any[] = content.reviews || [];

  const startAutoplay = useCallback(() => {
    if (!emblaApi) return;
    autoplayRef.current = setInterval(() => emblaApi.scrollNext(), 4000);
  }, [emblaApi]);

  const stopAutoplay = useCallback(() => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', () => setSelectedIndex(emblaApi.selectedScrollSnap()));
    startAutoplay();
    return () => stopAutoplay();
  }, [emblaApi, startAutoplay, stopAutoplay]);

  return (
    <section className="py-20 px-4 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12"
          style={{ fontFamily: g.font_heading }}
        >
          {content.heading}
        </h2>
        <div
          className="overflow-hidden"
          ref={emblaRef}
          onMouseEnter={stopAutoplay}
          onMouseLeave={startAutoplay}
        >
          <div className="flex gap-6">
            {reviews.map((review, i) => (
              <div key={i} className="flex-none w-full sm:w-1/2 lg:w-1/3">
                <ReviewCard review={review} color={g.primary_color} fontHeading={g.font_heading} fontBody={g.font_body} />
              </div>
            ))}
          </div>
        </div>
        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {reviews.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className="w-2 h-2 rounded-full transition-all"
              style={{ backgroundColor: i === selectedIndex ? g.primary_color : `${g.primary_color}40` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Marquee (CSS-only infinite scroll) ───────────────────────────────────────
const MarqueeTestimonials: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const reviews: any[] = content.reviews || [];
  const doubled = [...reviews, ...reviews]; // duplicate for seamless loop

  return (
    <section className="py-20 bg-slate-50 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 mb-12">
        <h2
          className="text-3xl sm:text-4xl font-bold text-center text-slate-900"
          style={{ fontFamily: g.font_heading }}
        >
          {content.heading}
        </h2>
      </div>
      <style>{`
        @keyframes marquee-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .marquee-track { display: flex; gap: 1.5rem; width: max-content; }
        .marquee-left { animation: marquee-left 30s linear infinite; }
        .marquee-right { animation: marquee-right 28s linear infinite; }
        .marquee-wrap:hover .marquee-left,
        .marquee-wrap:hover .marquee-right { animation-play-state: paused; }
      `}</style>
      <div className="marquee-wrap space-y-4">
        {/* Row 1 — scrolls left */}
        <div style={{ overflow: 'hidden' }}>
          <div className="marquee-track marquee-left">
            {doubled.map((review, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 w-72 shrink-0">
                <StarRating stars={review.stars || 5} color={g.primary_color} />
                <p className="mt-3 text-slate-700 text-sm italic leading-relaxed" style={{ fontFamily: g.font_body }}>
                  "{review.text}"
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">— {review.author}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Row 2 — scrolls right */}
        {reviews.length > 2 && (
          <div style={{ overflow: 'hidden' }}>
            <div className="marquee-track marquee-right">
              {[...doubled].reverse().map((review, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 w-72 shrink-0">
                  <StarRating stars={review.stars || 5} color={g.primary_color} />
                  <p className="mt-3 text-slate-700 text-sm italic leading-relaxed" style={{ fontFamily: g.font_body }}>
                    "{review.text}"
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">— {review.author}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// ─── Cards 3D (framer-motion perspective hover) ───────────────────────────────
const Cards3DTestimonials: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  // Lazy import framer-motion to avoid breaking if not needed
  const reviews: any[] = content.reviews || [];
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-12"
          style={{ fontFamily: g.font_heading }}
        >
          {content.heading}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ perspective: '1000px' }}>
          {reviews.map((review, i) => (
            <Card3DItem key={i} review={review} color={g.primary_color} fontHeading={g.font_heading} fontBody={g.font_body} />
          ))}
        </div>
      </div>
    </section>
  );
};

const Card3DItem: React.FC<{ review: any; color: string; fontHeading: string; fontBody: string }> = ({
  review, color, fontHeading, fontBody,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `rotateY(${x * 16}deg) rotateX(${-y * 16}deg) scale(1.04)`;
  };

  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = 'rotateY(0) rotateX(0) scale(1)';
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 transition-transform duration-200"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <StarRating stars={review.stars || 5} color={color} />
      <p className="mt-4 text-slate-700 italic leading-relaxed" style={{ fontFamily: fontBody }}>
        "{review.text}"
      </p>
      <p className="mt-4 font-semibold text-slate-900 text-sm" style={{ fontFamily: fontHeading }}>
        — {review.author}
      </p>
    </div>
  );
};

// ─── Minimal (elegant typography only) ───────────────────────────────────────
const MinimalTestimonials: React.FC<SectionComponentProps> = ({ content, global: g }) => {
  const reviews: any[] = content.reviews || [];
  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-16"
          style={{ fontFamily: g.font_heading }}
        >
          {content.heading}
        </h2>
        <div className="space-y-12">
          {reviews.map((review, i) => (
            <div key={i} className="text-center max-w-2xl mx-auto">
              <p className="text-xl md:text-2xl text-slate-700 italic leading-relaxed mb-6" style={{ fontFamily: g.font_body }}>
                "{review.text}"
              </p>
              <StarRating stars={review.stars || 5} color={g.primary_color} />
              <p className="mt-3 font-semibold text-slate-900 text-sm tracking-wide uppercase" style={{ fontFamily: g.font_heading, color: g.primary_color }}>
                {review.author}
              </p>
              {i < reviews.length - 1 && (
                <div className="mt-12 border-b mx-auto w-16" style={{ borderColor: `${g.primary_color}30` }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Existing variants ─────────────────────────────────────────────────────────
const ReviewWall: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4" style={{ backgroundColor: g.primary_color }}>
    <div className="max-w-6xl mx-auto">
      <h2
        className="text-3xl sm:text-4xl font-bold text-center text-white mb-12"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {(content.reviews || []).map((review: any, i: number) => (
          <div key={i} className="break-inside-avoid bg-white rounded-2xl p-5 shadow-sm">
            <StarRating stars={review.stars || 5} color={g.primary_color} />
            <p className="mt-3 text-slate-700 text-sm italic leading-relaxed" style={{ fontFamily: g.font_body }}>
              "{review.text}"
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-500" style={{ fontFamily: g.font_heading }}>
              — {review.author}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const StatsBar: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-16 px-4 bg-white">
    <div className="max-w-6xl mx-auto">
      <h2
        className="text-2xl sm:text-3xl font-bold text-center text-slate-900 mb-10"
        style={{ fontFamily: g.font_heading }}
      >
        {content.heading}
      </h2>
      <div className="flex flex-wrap justify-center gap-8">
        {(content.reviews || []).slice(0, 3).map((review: any, i: number) => (
          <div key={i} className="text-center max-w-xs">
            <StarRating stars={review.stars || 5} color={g.primary_color} />
            <p className="mt-3 text-slate-600 text-sm italic" style={{ fontFamily: g.font_body }}>
              "{review.text}"
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">— {review.author}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const SocialProofSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'grid';
  const allProps = { content, ...props };
  if (v === 'review_wall') return <ReviewWall {...allProps} />;
  if (v === 'stats_bar')   return <StatsBar {...allProps} />;
  if (v === 'slider')      return <SliderTestimonials {...allProps} />;
  if (v === 'marquee')     return <MarqueeTestimonials {...allProps} />;
  if (v === 'cards_3d')    return <Cards3DTestimonials {...allProps} />;
  if (v === 'minimal')     return <MinimalTestimonials {...allProps} />;
  return <StarTestimonials {...allProps} />;
};

export default SocialProofSection;
