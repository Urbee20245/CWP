/**
 * UnknownSection — renders ANY unrecognised section type generically.
 *
 * The AI can add any section_type it likes and the renderer will always
 * show something clean rather than silently dropping content. It reads
 * common content keys intelligently: heading, subtext, body, items[],
 * areas[], links[], list[], stats[], hours[], members[], etc.
 */
import React from 'react';

interface Props {
  content: Record<string, any>;
  global: {
    primary_color: string;
    font_heading?: string;
    [key: string]: any;
  };
  variant?: string;
  style_overrides?: Record<string, any>;
  [key: string]: any;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

/** Returns true if the value is a non-empty array */
const isArr = (v: any): v is any[] => Array.isArray(v) && v.length > 0;

/** Returns true if the value is a non-empty string */
const isStr = (v: any): v is string => typeof v === 'string' && v.trim() !== '';

/** Returns true if the value is a plain object */
const isObj = (v: any): boolean => v !== null && typeof v === 'object' && !Array.isArray(v);

// ── Render helpers ────────────────────────────────────────────────────────────

/** Render a flat list of items (objects or strings) as a readable list */
const ItemList: React.FC<{ items: any[]; primaryColor: string }> = ({ items, primaryColor }) => (
  <ul className="mt-4 space-y-3">
    {items.map((item, i) => {
      if (isStr(item)) {
        return (
          <li key={i} className="flex items-start gap-2 text-slate-700">
            <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: primaryColor }} />
            <span>{item}</span>
          </li>
        );
      }
      if (isObj(item)) {
        const obj = item as Record<string, any>;
        // Common object shapes: {name, title, description/bio/text, year, issuer, time, day, …}
        const heading = obj.name || obj.title || obj.label || obj.day || obj.heading || '';
        const sub = obj.description || obj.bio || obj.text || obj.time || obj.issuer || obj.subtext || '';
        const extra = obj.year || obj.url || '';
        return (
          <li key={i} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
            <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: primaryColor }} />
            <div>
              {isStr(heading) && <p className="font-semibold text-slate-800">{heading}{isStr(extra) ? <span className="ml-2 text-xs text-slate-400 font-normal">{extra}</span> : null}</p>}
              {isStr(sub) && <p className="text-sm text-slate-600 mt-0.5">{sub}</p>}
              {obj.image_url && (
                <img src={obj.image_url} alt={heading || ''} className="mt-2 w-16 h-16 rounded-lg object-cover" />
              )}
            </div>
          </li>
        );
      }
      return null;
    })}
  </ul>
);

/** Render a grid of badge-style chips */
const BadgeGrid: React.FC<{ items: string[]; primaryColor: string }> = ({ items, primaryColor }) => (
  <div className="mt-4 flex flex-wrap gap-2">
    {items.map((item, i) => (
      <span
        key={i}
        className="px-4 py-2 rounded-full text-sm font-medium text-white"
        style={{ backgroundColor: primaryColor }}
      >
        {item}
      </span>
    ))}
  </div>
);

/** Render a stats row */
const StatsRow: React.FC<{ stats: any[]; primaryColor: string }> = ({ stats, primaryColor }) => (
  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
    {stats.map((s, i) => {
      const value = s.value || s.number || s.stat || '';
      const label = s.label || s.name || s.description || '';
      return (
        <div key={i} className="text-center">
          <p className="text-3xl font-bold" style={{ color: primaryColor }}>{value}</p>
          {isStr(label) && <p className="text-sm text-slate-600 mt-1">{label}</p>}
        </div>
      );
    })}
  </div>
);

/** Render a links list */
const LinksList: React.FC<{ links: any[]; primaryColor: string }> = ({ links, primaryColor }) => (
  <div className="mt-4 flex flex-wrap gap-3">
    {links.map((link, i) => {
      const label = link.label || link.text || link.name || (isStr(link) ? link : '');
      const url = link.url || link.href || (isStr(link) ? link : '#');
      return (
        <a
          key={i}
          href={url}
          target={link.target || '_self'}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-90"
          style={{ borderColor: primaryColor, color: primaryColor }}
        >
          {label}
        </a>
      );
    })}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const UnknownSection: React.FC<Props> = ({ content = {}, global: g, style_overrides }) => {
  const primary = g.primary_color || '#4F46E5';

  // Extract well-known top-level text fields
  const heading  = content.heading  || content.title  || content.name  || '';
  const subtext  = content.subtext  || content.subtitle || content.description || content.intro || '';
  const body     = content.body     || content.text    || content.copy  || '';
  const cta      = content.button_text || content.cta_text || content.cta || '';
  const ctaUrl   = content.button_url  || content.cta_url  || '#';

  // Detect which array key has data
  const itemsArr  = content.items   || content.services || content.features || null;
  const areasArr  = content.areas   || content.locations || null;
  const linksArr  = content.links   || content.nav_links || null;
  const listArr   = content.list    || null;
  const statsArr  = content.stats   || null;
  const hoursArr  = content.hours   || null;
  const membersArr = content.members || content.team || null;

  // Background / text overrides
  const bg   = style_overrides?.background || '#ffffff';
  const txtC = style_overrides?.text_color || '#0f172a';

  return (
    <section style={{ backgroundColor: bg, color: txtC, padding: style_overrides?.padding || '4rem 0' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading area */}
        {isStr(heading) && (
          <h2
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: g.font_heading, color: primary }}
          >
            {heading}
          </h2>
        )}
        {isStr(subtext) && (
          <p className="text-lg text-slate-600 mb-2 max-w-2xl">{subtext}</p>
        )}
        {isStr(body) && (
          <p className="text-base text-slate-700 mb-4 max-w-2xl whitespace-pre-line">{body}</p>
        )}

        {/* Arrays — render in priority order */}
        {isArr(statsArr) && <StatsRow stats={statsArr} primaryColor={primary} />}
        {isArr(areasArr) && <BadgeGrid items={areasArr.map(a => isStr(a) ? a : (a.name || JSON.stringify(a)))} primaryColor={primary} />}
        {isArr(itemsArr) && <ItemList items={itemsArr} primaryColor={primary} />}
        {isArr(hoursArr) && <ItemList items={hoursArr} primaryColor={primary} />}
        {isArr(membersArr) && <ItemList items={membersArr} primaryColor={primary} />}
        {isArr(listArr) && <ItemList items={listArr} primaryColor={primary} />}
        {isArr(linksArr) && <LinksList links={linksArr} primaryColor={primary} />}

        {/* Render any remaining unknown keys as key: value pairs */}
        {Object.entries(content)
          .filter(([k, v]) => {
            const known = new Set(['heading','title','name','subtext','subtitle','description','intro','body','text','copy','button_text','cta_text','cta','button_url','cta_url','items','services','features','areas','locations','links','nav_links','list','stats','hours','members','team','background_image_url','image_url']);
            return !known.has(k) && isStr(v);
          })
          .map(([k, v]) => (
            <p key={k} className="text-sm text-slate-600 mt-1">
              <span className="font-semibold text-slate-800 capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
              {v as string}
            </p>
          ))
        }

        {/* CTA button */}
        {isStr(cta) && (
          <div className="mt-6">
            <a
              href={ctaUrl}
              className="inline-flex items-center px-6 py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              {cta}
            </a>
          </div>
        )}
      </div>
    </section>
  );
};

export default UnknownSection;
