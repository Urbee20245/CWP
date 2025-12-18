import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Download, MapPin, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GeneratingEffect } from '../../src/tools/jet-local-optimizer/components/GeneratingEffect';
import { JetBizProAnalyzer, type JetBizProResult } from '../../analyzers/jetbiz-pro-analyzer';
import { progressBlocks } from '../../analyzers/jetbiz-lite-analyzer';
import { openPrintToPdf } from '../../lib/pdf-generator';

type RadiusMeters = 1609 | 3219 | 4828 | 8047;

const MIN_GENERATING_MS = 5000;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const gradeColor = (grade: string) => {
  if (grade === 'A') return 'text-emerald-600';
  if (grade === 'B') return 'text-green-600';
  if (grade === 'C') return 'text-amber-600';
  if (grade === 'D') return 'text-orange-600';
  return 'text-red-600';
};

const priorityStyle: Record<string, string> = {
  critical: 'border-red-500 bg-red-50 text-red-800',
  important: 'border-orange-500 bg-orange-50 text-orange-800',
  recommended: 'border-amber-500 bg-amber-50 text-amber-800',
};

function parseRadius(value: string): RadiusMeters {
  const n = Number(value);
  if (n === 1609 || n === 3219 || n === 4828 || n === 8047) return n;
  return 3219;
}

export const JetBizPro: React.FC<{ sessionId: string; analyzing?: boolean }> = ({ sessionId, analyzing }) => {
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    businessName: string;
    location: string;
    liteScore: number;
    radiusMeters: RadiusMeters;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(Boolean(analyzing));
  const [result, setResult] = useState<JetBizProResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    setMetaError(null);
    fetch(`/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) throw new Error(j?.error || 'Unable to load payment session');
        const md = j?.metadata || {};
        const businessName = String(md.business_name || '').trim();
        const location = String(md.location || '').trim();
        const liteScore = Number(md.lite_score || 0) || 0;
        const radiusMeters = parseRadius(String(md.competitor_radius || '3219'));
        if (!businessName || !location) throw new Error('Missing business metadata on checkout session');
        setMeta({ businessName, location, liteScore, radiusMeters });
      })
      .catch((e) => {
        if (!cancelled) setMetaError(e?.message || 'Unable to load Pro session');
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const run = async () => {
    if (!meta) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const [data] = await Promise.all([
        JetBizProAnalyzer.run({
          businessName: meta.businessName,
          location: meta.location,
          radiusMeters: meta.radiusMeters,
          liteScore: meta.liteScore,
        }),
        delay(MIN_GENERATING_MS),
      ]);
      setResult(data);
    } catch (e: any) {
      setError(e?.message || 'Pro analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!meta || metaLoading || metaError) return;
    if (!analyzing) return;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, metaLoading, metaError, analyzing]);

  const radiusMiles = useMemo(() => (meta ? Math.round((meta.radiusMeters / 1609.34) * 10) / 10 : 2), [meta]);

  const downloadPdf = () => {
    if (!result) return;

    const sections = [
      {
        title: 'Summary',
        html: `
          <p><strong>Lite score:</strong> ${result.liteScore}/100</p>
          <p><strong>Pro score:</strong> ${result.proScore}/100 (Grade ${result.proGrade})</p>
          <p class="muted">Analyzed within <strong>${result.radiusMiles} miles</strong> • Competitors found: <strong>${result.competitorsFound}</strong></p>
        `,
      },
      {
        title: 'Category Scores',
        html: `
          <div class="grid">
            ${result.categories
              .map((c) => `<div><strong>${c.label}:</strong> ${c.score}/${c.max}</div>`)
              .join('')}
          </div>
        `,
      },
      {
        title: 'You vs Top 3 Competitors (avg)',
        html: `
          <table>
            <thead><tr><th>Metric</th><th>You</th><th>Top 3 avg</th></tr></thead>
            <tbody>
              ${result.comparisonTable.map((r) => `<tr><td>${r.metric}</td><td>${r.you}</td><td>${r.top3Avg}</td></tr>`).join('')}
            </tbody>
          </table>
        `,
      },
      {
        title: 'Priority Action Plan',
        html: `
          ${result.actionPlan
            .map(
              (a) => `
              <div style="margin:10px 0;">
                <span class="badge ${a.priority}">${a.priority}</span>
                <div style="font-weight:800; margin-top:6px;">${a.title}</div>
                <div class="muted">${a.whyItMatters}</div>
                <div><strong>Impact:</strong> ${a.impactPercent}% • <strong>Time:</strong> ${a.timeRequired}</div>
              </div>`
            )
            .join('')}
        `,
      },
    ];

    openPrintToPdf({
      title: 'JetBiz Pro — Google Business Profile Optimizer',
      subtitle: `${result.generatedAt} • Within ${result.radiusMiles} miles`,
      sections,
      footerNote: 'Tip: Print → “Save as PDF”.',
    });
  };

  if (metaLoading) {
    return (
      <GeneratingEffect
        theme="light"
        durationMs={5000}
        title="Loading your Pro session…"
        subtitle="Verifying your checkout session and preparing analysis."
      />
    );
  }

  if (metaError || !meta) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 border border-red-200">
        <div className="flex gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <div className="font-bold">Unable to load JetBiz Pro</div>
            <div className="text-sm">{metaError || 'Missing metadata'}</div>
            <div className="mt-3">
              <Link to="/jetbiz-lite" className="text-indigo-700 font-bold underline underline-offset-4">
                Go back to JetBiz Lite
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !result) {
    return (
      <GeneratingEffect
        theme="light"
        durationMs={5000}
        title="Running JetBiz Pro analysis…"
        subtitle={`Analyzed within ${radiusMiles} miles of your business.`}
        steps={[
          'Finding your business…',
          'Fetching Google profile details…',
          `Scanning competitors within ${radiusMiles} miles…`,
          'Calculating Pro score…',
          'Generating action plan…',
        ]}
      />
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 border border-red-200">
        <div className="flex gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <div className="font-bold">Pro analysis failed</div>
            <div className="text-sm">{error}</div>
            <button
              onClick={run}
              className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
            >
              Retry
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="font-bold text-slate-900">Ready to run JetBiz Pro</div>
        <div className="text-sm text-slate-600 mt-1">We’ll analyze within {radiusMiles} miles using your paid radius.</div>
        <button
          onClick={run}
          className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:shadow-lg"
        >
          Run Pro Analysis
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-widest mb-4">
          <Building2 className="w-4 h-4" />
          JetBiz Pro — Google Business Profile Optimizer
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl mb-3">
          Analyzed within {result.radiusMiles} miles of your business
        </h1>
        <p className="text-slate-600 max-w-3xl mx-auto">
          Based on {result.competitorsFound} competitors found within {result.radiusMiles} miles of your location.
        </p>
      </div>

      {/* Score comparison */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Score comparison</div>
            <div className="mt-2 flex flex-wrap items-end gap-6">
              <div>
                <div className="text-sm text-slate-500">Lite</div>
                <div className="text-4xl font-extrabold text-slate-900">{result.liteScore}/100</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Pro</div>
                <div className={`text-4xl font-extrabold ${gradeColor(result.proGrade)}`}>
                  {result.proScore}/100 <span className="text-slate-400 text-xl">({result.proGrade})</span>
                </div>
              </div>
              <div className="text-sm text-slate-600">
                Delta:{' '}
                <span className="font-bold">
                  {result.proScore - result.liteScore >= 0 ? '+' : ''}
                  {result.proScore - result.liteScore}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={downloadPdf}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Category bars */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Pro Category Scores</h3>
        <div className="space-y-4">
          {result.categories.map((c) => (
            <div key={c.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-slate-900">
                  {c.label}{' '}
                  <span className="ml-2 font-mono text-slate-500">{progressBlocks(c.score, c.max)}</span>
                </span>
                <span className="font-bold text-slate-700">
                  {c.score}/{c.max}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${c.score / c.max >= 0.8 ? 'bg-emerald-500' : c.score / c.max >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.round((c.score / c.max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-slate-500 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Radius used (from payment metadata): <span className="font-bold">{result.radiusMeters}m</span>
        </div>
      </div>

      {/* You vs Top 3 avg */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">You vs Top 3 Competitors (avg)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left py-2 pr-4">Metric</th>
                <th className="text-left py-2 pr-4">You</th>
                <th className="text-left py-2 pr-4">Top 3 avg</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {result.comparisonTable.map((r) => (
                <tr key={r.metric} className="border-t border-slate-200">
                  <td className="py-3 pr-4 font-semibold">{r.metric}</td>
                  <td className="py-3 pr-4">{r.you}</td>
                  <td className="py-3 pr-4">{r.top3Avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Note: Based on {result.competitorsFound} competitors found within {result.radiusMiles} miles of your location.
        </div>
      </div>

      {/* Competitor cards */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Top Competitors (within {result.radiusMiles} miles)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {result.competitors.map((c) => (
            <div key={c.placeId} className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {c.distanceMiles} mi away • Rating {c.rating} • {c.reviewCount} reviews
                  </div>
                </div>
                <div className={`text-2xl font-extrabold ${gradeColor(c.grade)}`}>{c.score}</div>
              </div>
              <div className="mt-3 text-sm text-slate-700">
                Photos: <span className="font-bold">{c.photoCount}</span>{' '}
                <span className={c.photoDeltaVsYou >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  ({c.photoDeltaVsYou >= 0 ? '+' : ''}
                  {c.photoDeltaVsYou} vs you)
                </span>
              </div>
              {c.betterAt.length > 0 && (
                <div className="mt-3 text-sm text-slate-700">
                  <div className="font-semibold">What they’re doing better:</div>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {c.betterAt.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              <a
                href={c.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-indigo-700 font-bold underline underline-offset-4"
              >
                View on Google Maps <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Priority action plan */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Priority Action Plan
        </h3>
        <div className="space-y-4">
          {result.actionPlan.map((a) => (
            <div key={a.id} className={`border-l-4 ${priorityStyle[a.priority]} p-4 rounded-lg`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-bold">{a.title}</div>
                <div className="text-xs font-bold uppercase tracking-widest">
                  {a.priority} • {a.impactPercent}% impact • {a.timeRequired}
                </div>
              </div>
              <div className="mt-2 text-sm text-slate-700">{a.whyItMatters}</div>
              <ol className="mt-3 list-decimal pl-5 text-sm text-slate-700 space-y-1">
                {a.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* Owner-only checklist */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Owner‑Only Checklist</h3>
        <ul className="list-disc pl-6 text-slate-700 space-y-2">
          {result.ownerOnlyChecklist.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      {/* Citations upsell */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white rounded-2xl p-8 shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-widest text-white/80 mb-2">Next step</div>
        <div className="text-2xl font-extrabold mb-2">{result.citationsUpsell.headline}</div>
        <div className="text-slate-200 mb-6">
          Citations are the #1 hidden reason businesses get stuck under competitors. Lock in consistency and stop ranking volatility.
        </div>
        <ul className="space-y-2 mb-6">
          {result.citationsUpsell.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1 inline-block w-2 h-2 rounded-full bg-emerald-400" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <Link
          to="/contact"
          className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition-all"
        >
          Get Citations Cleanup — ${result.citationsUpsell.price}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {result.notes.length > 0 && (
        <div className="bg-slate-900 text-slate-100 rounded-lg p-6">
          <div className="text-sm font-bold mb-2">Notes</div>
          <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
            {result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

