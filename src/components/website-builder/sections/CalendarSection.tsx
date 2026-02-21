import React, { useEffect, useId } from 'react';
import { CalendarDays } from 'lucide-react';
import { WebsiteGlobal } from '../../../types/website';

interface CalendarSectionProps {
  global: WebsiteGlobal;
  /** Full Cal.com booking URL, e.g. "https://cal.com/jane/30min" */
  calLink: string;
}

// Extend Window to satisfy TypeScript for the Cal.com embed script
declare global {
  interface Window {
    Cal?: (...args: unknown[]) => void & {
      loaded?: boolean;
      ns?: Record<string, unknown>;
      q?: unknown[][];
    };
  }
}

/**
 * Renders an inline Cal.com booking calendar using their official embed script.
 * The script is loaded lazily and scoped to this section's mount lifecycle.
 */
const CalendarSection: React.FC<CalendarSectionProps> = ({ global: g, calLink }) => {
  // Use a stable unique ID so multiple embeds on the same page don't collide
  const uid = useId().replace(/:/g, '');
  const containerId = `cwp-cal-${uid}`;

  useEffect(() => {
    // Guard: don't embed if no link provided
    if (!calLink) return;

    // Load the Cal.com embed script exactly once per page
    if (!document.getElementById('cal-embed-script')) {
      const script = document.createElement('script');
      script.id = 'cal-embed-script';
      script.src = 'https://app.cal.com/embed/embed.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Initialise Cal and mount the inline widget once the script is ready
    const initCal = () => {
      if (!window.Cal) return;

      window.Cal('init', { origin: 'https://cal.com' });
      window.Cal('inline', {
        elementOrSelector: `#${containerId}`,
        calLink,
        layout: 'month_view',
      });
      window.Cal('ui', {
        theme: 'light',
        hideEventTypeDetails: false,
        layout: 'month_view',
      });
    };

    // Cal.com sets window.Cal synchronously when the script executes,
    // but the script may still be fetching. Poll until it is available.
    if (window.Cal) {
      initCal();
    } else {
      const interval = setInterval(() => {
        if (window.Cal) {
          clearInterval(interval);
          initCal();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [calLink, containerId]);

  return (
    <section id="booking" className="py-20 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        {/* Section heading */}
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{ backgroundColor: `${g.primary_color}15` }}
          >
            <CalendarDays className="w-7 h-7" style={{ color: g.primary_color }} />
          </div>
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3"
            style={{ fontFamily: g.font_heading }}
          >
            Book an Appointment
          </h2>
          <p
            className="text-lg text-slate-500 max-w-lg mx-auto"
            style={{ fontFamily: g.font_body }}
          >
            Choose a time that works for you — we'll take it from there.
          </p>
        </div>

        {/* Cal.com inline embed target */}
        <div
          id={containerId}
          className="min-h-[600px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm"
          style={{ width: '100%' }}
        />
      </div>
    </section>
  );
};

export default CalendarSection;
