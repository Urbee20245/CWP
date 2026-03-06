import React, { useRef, useState, useCallback } from 'react';
import { SectionComponentProps } from '../../../types/website';

const BeforeAfterSection: React.FC<SectionComponentProps & { variant?: string }> = ({ content, global: g }) => {
  const [sliderPos, setSliderPos] = useState(50); // percentage
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateSlider = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const onMouseDown = () => { dragging.current = true; };
  const onMouseMove = (e: React.MouseEvent) => { if (dragging.current) updateSlider(e.clientX); };
  const onMouseUp = () => { dragging.current = false; };
  const onTouchMove = (e: React.TouchEvent) => updateSlider(e.touches[0].clientX);

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        {content.heading && (
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-900 mb-4" style={{ fontFamily: g.font_heading }}>
            {content.heading}
          </h2>
        )}
        {content.subtext && (
          <p className="text-center text-slate-600 mb-10" style={{ fontFamily: g.font_body }}>{content.subtext}</p>
        )}
        <div
          ref={containerRef}
          className="relative h-80 md:h-[480px] rounded-2xl overflow-hidden cursor-col-resize select-none shadow-2xl"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
        >
          {/* After (full width background) */}
          {content.after_image
            ? <img src={content.after_image} alt="After" className="absolute inset-0 w-full h-full object-cover" />
            : <div className="absolute inset-0 bg-slate-200 flex items-center justify-center text-slate-400">After image</div>
          }

          {/* Before (clipped left) */}
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
            {content.before_image
              ? <img src={content.before_image} alt="Before" className="absolute inset-0 w-full h-full object-cover" style={{ width: `${100 / (sliderPos / 100)}%`, maxWidth: 'none' }} />
              : <div className="absolute inset-0 bg-slate-400 flex items-center justify-center text-white">Before image</div>
            }
          </div>

          {/* Divider */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10" style={{ left: `${sliderPos}%` }}>
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center" style={{ left: '50%' }}>
              <span className="text-slate-600 text-xs font-bold">◀▶</span>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 bg-black/50 text-white text-xs font-semibold px-2.5 py-1 rounded-full">Before</div>
          <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-semibold px-2.5 py-1 rounded-full">After</div>
        </div>
      </div>
    </section>
  );
};

export default BeforeAfterSection;
