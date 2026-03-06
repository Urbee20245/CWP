import React from 'react';
import { SectionComponentProps } from '../../../types/website';
import ReactPlayer from 'react-player';

// ─── Full Width ────────────────────────────────────────────────────────────────
const VideoFullWidth: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-16 px-4 bg-slate-900">
    {(content.title || content.subtitle) && (
      <div className="max-w-4xl mx-auto text-center mb-8">
        {content.title && <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: g.font_heading }}>{content.title}</h2>}
        {content.subtitle && <p className="text-slate-300 text-lg" style={{ fontFamily: g.font_body }}>{content.subtitle}</p>}
      </div>
    )}
    <div className="max-w-5xl mx-auto rounded-2xl overflow-hidden aspect-video bg-slate-800">
      {content.video_url ? (
        <ReactPlayer
          url={content.video_url}
          width="100%"
          height="100%"
          controls
          playing={content.autoplay || false}
          loop={content.loop || false}
          muted={content.autoplay || false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-500 text-lg">
          No video URL provided
        </div>
      )}
    </div>
  </section>
);

// ─── Contained (centered card) ─────────────────────────────────────────────────
const VideoContained: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-4xl mx-auto">
      {(content.title || content.subtitle) && (
        <div className="text-center mb-10">
          {content.title && <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3" style={{ fontFamily: g.font_heading }}>{content.title}</h2>}
          {content.subtitle && <p className="text-slate-600 text-lg" style={{ fontFamily: g.font_body }}>{content.subtitle}</p>}
        </div>
      )}
      <div className="rounded-2xl overflow-hidden shadow-2xl aspect-video bg-slate-100">
        {content.video_url ? (
          <ReactPlayer url={content.video_url} width="100%" height="100%" controls playing={content.autoplay || false} loop={content.loop || false} muted={content.autoplay || false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">Video placeholder</div>
        )}
      </div>
    </div>
  </section>
);

// ─── With text left ───────────────────────────────────────────────────────────
const VideoWithTextLeft: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div>
        {content.title && <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: g.font_heading }}>{content.title}</h2>}
        {content.subtitle && <p className="text-slate-600 text-lg leading-relaxed" style={{ fontFamily: g.font_body }}>{content.subtitle}</p>}
        {content.cta_text && (
          <a href={content.cta_link || '#contact'} className="inline-block mt-6 px-6 py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: g.primary_color }}>
            {content.cta_text}
          </a>
        )}
      </div>
      <div className="rounded-2xl overflow-hidden shadow-xl aspect-video bg-slate-100">
        {content.video_url ? (
          <ReactPlayer url={content.video_url} width="100%" height="100%" controls playing={content.autoplay || false} loop={content.loop || false} muted={content.autoplay || false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">Video placeholder</div>
        )}
      </div>
    </div>
  </section>
);

// ─── With text right ──────────────────────────────────────────────────────────
const VideoWithTextRight: React.FC<SectionComponentProps> = ({ content, global: g }) => (
  <section className="py-20 px-4 bg-white">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div className="rounded-2xl overflow-hidden shadow-xl aspect-video bg-slate-100">
        {content.video_url ? (
          <ReactPlayer url={content.video_url} width="100%" height="100%" controls playing={content.autoplay || false} loop={content.loop || false} muted={content.autoplay || false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">Video placeholder</div>
        )}
      </div>
      <div>
        {content.title && <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: g.font_heading }}>{content.title}</h2>}
        {content.subtitle && <p className="text-slate-600 text-lg leading-relaxed" style={{ fontFamily: g.font_body }}>{content.subtitle}</p>}
        {content.cta_text && (
          <a href={content.cta_link || '#contact'} className="inline-block mt-6 px-6 py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: g.primary_color }}>
            {content.cta_text}
          </a>
        )}
      </div>
    </div>
  </section>
);

// ─── Root dispatcher ───────────────────────────────────────────────────────────
const VideoSection: React.FC<SectionComponentProps & { variant?: string }> = ({ variant, content, ...props }) => {
  const v = variant || content?.variant || 'contained';
  const allProps = { content, ...props };

  if (v === 'full_width')       return <VideoFullWidth {...allProps} />;
  if (v === 'with_text_left')   return <VideoWithTextLeft {...allProps} />;
  if (v === 'with_text_right')  return <VideoWithTextRight {...allProps} />;
  return <VideoContained {...allProps} />;
};

export default VideoSection;
