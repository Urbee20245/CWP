import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import { Star } from 'lucide-react';

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
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <StarRating stars={review.stars || 5} color={g.primary_color} />
            <p className="mt-4 text-slate-700 italic leading-relaxed" style={{ fontFamily: g.font_body }}>
              "{review.text}"
            </p>
            <p className="mt-4 font-semibold text-slate-900 text-sm" style={{ fontFamily: g.font_heading }}>
              — {review.author}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

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

const SocialProofSection: React.FC<SectionComponentProps & { variant: string }> = ({ variant, ...props }) => {
  if (variant === 'review_wall') return <ReviewWall {...props} />;
  if (variant === 'stats_bar') return <StatsBar {...props} />;
  return <StarTestimonials {...props} />;
};

export default SocialProofSection;
