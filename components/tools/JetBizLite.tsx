import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GeneratingEffect } from '../../src/tools/jet-local-optimizer/components/GeneratingEffect';
import { JetBizUpgradeOffer } from './JetBizUpgradeOffer';
import {
  calculateJetBizLite,
  gradeFromScore,
  progressBlocks,
  type JetBizLiteChecklist,
  type JetBizLiteInputs,
  type RadiusMeters,
} from '../../analyzers/jetbiz-lite-analyzer';

const MIN_GENERATING_MS = 5000;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const RADIUS_STORAGE_KEY = 'jetbiz_lite_radius_m';

const gradeColor = (grade: ReturnType<typeof gradeFromScore>) => {
  switch (grade) {
    case 'A':
      return 'text-emerald-600';
    case 'B':
      return 'text-green-600';
    case 'C':
      return 'text-amber-600';
    case 'D':
      return 'text-orange-600';
    default:
      return 'text-red-600';
  }
};

const scoreBarColor = (pct: number) => {
  if (pct >= 0.8) return 'bg-emerald-500';
  if (pct >= 0.6) return 'bg-amber-500';
  return 'bg-red-500';
};

const defaultChecklist: JetBizLiteChecklist = {
  hasHours: false,
  hasPhone: false,
  hasWebsite: false,
  hasDescriptionOptimized: false,
  hasServicesListed: false,
  hasPrimaryCategorySet: false,
  hasSecondaryCategories: false,
  photoCountRange: '0-9',
  reviewCountRange: '0-10',
  ratingRange: '<4.0',
  postFrequency: 'none',
  postedLast30Days: false,
  napConsistent: false,
  websiteConsistent: false,
  duplicatesCleaned: false,
  citationsUpdatedRecently: false,
};

const readSavedRadius = (): RadiusMeters => {
  try {
    const raw = localStorage.getItem(RADIUS_STORAGE_KEY);
    const n = Number(raw);
    if (n === 1609 || n === 3219 || n === 4828 || n === 8047) return n;
  } catch {
    // ignore
  }
  return 3219;
};

export const JetBizLite: React.FC = () => {
  const [inputs, setInputs] = useState<JetBizLiteInputs>({
    businessName: '',
    location: '',
    industry: '',
    gbpUrl: '',
    radiusMeters: readSavedRadius(),
  });
  const [checklist, setChecklist] = useState<JetBizLiteChecklist>(defaultChecklist);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof calculateJetBizLite> | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const livePreview = useMemo(() => calculateJetBizLite(checklist, inputs), [checklist, inputs]);

  useEffect(() => {
    if (!result) return;
    const t = window.setTimeout(() => setShowUpgrade(true), 2000);
    return () => window.clearTimeout(t);
  }, [result]);

  const handleRadiusChange = (radiusMeters: RadiusMeters) => {
    setInputs((p) => ({ ...p, radiusMeters }));
    try {
      localStorage.setItem(RADIUS_STORAGE_KEY, String(radiusMeters));
    } catch {
      // ignore
    }
  };

  const reset = () => {
    setResult(null);
    setChecklist(defaultChecklist);
    setShowUpgrade(false);
  };

  const runAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputs.businessName.trim() || !inputs.location.trim()) return;
    setIsLoading(true);
    try {
      const [final] = await Promise.all([
        Promise.resolve(calculateJetBizLite(checklist, inputs)),
        delay(MIN_GENERATING_MS),
      ]);
      setResult(final);
    } finally {
      setIsLoading(false);
    }
  };

  const exportPdf = () => {
    const data = result || livePreview;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=900');
    if (!w) return;
    const safe = (s: string) => s.replace(/[<>]/g, '');

    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>JetBiz Lite Self-Audit</title>
      <style>
        body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 28px; color: #0f172a; }
        h1,h2,h3 { margin: 0 0 10px; }
        .muted { color: #475569; }
        .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 12px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        ul { margin: 8px 0 0; }
      </style>
    </head><body>`);

    w.document.write(`<h1>JetBiz Lite — Free Self‑Audit</h1>`);
    w.document.write(`<p class="muted">${safe(inputs.businessName)} — ${safe(inputs.location)}</p>`);
    w.document.write(`<div class="card"><h2>Score</h2><p><strong>${data.overallScore}/100</strong> (Grade ${data.grade})</p></div>`);

    w.document.write(`<div class="card"><h3>Category Breakdown</h3><div class="grid">`);
    data.categories.forEach((c) => {
      w.document.write(`<div><strong>${safe(c.label)}:</strong> ${c.score}/${c.max}</div>`);
    });
    w.document.write(`</div></div>`);

    w.document.write(`<div class="card"><h3>Recommendations</h3><ul>`);
    data.recommendations.forEach((r) => w.document.write(`<li>${safe(r)}</li>`));
    w.document.write(`</ul></div>`);

    w.document.write(`<div class="card"><h3>Owner‑Only Checklist</h3><ul>`);
    data.ownerOnlyChecklist.forEach((r) => w.document.write(`<li>${safe(r)}</li>`));
    w.document.write(`</ul></div>`);

    w.document.write(`<p class="muted">Tip: Use your browser’s Print → “Save as PDF”.</p>`);
    w.document.write(`</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const data = result || livePreview;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {!result ? (
          <>
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-widest mb-4">
                <ClipboardCheck className="w-4 h-4" />
                JetBiz Lite — Free Self‑Audit Tool
              </div>
              <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl mb-3">
                Score your Google Business Profile in 2 minutes.
              </h1>
              <p className="text-slate-600 max-w-3xl mx-auto">
                No API calls. Just a fast checklist that tells you what’s missing and what to fix next.
              </p>
            </div>

            {/* Real-time score header */}
            <div className="max-w-4xl mx-auto mb-6 bg-white rounded-lg shadow-lg p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Real‑time score</div>
                  <div className={`text-4xl font-extrabold ${gradeColor(data.grade)}`}>
                    {data.overallScore}/100 <span className="text-slate-400 text-xl">({data.grade})</span>
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Competitor radius saved for Pro upgrade: <span className="font-bold">{inputs.radiusMeters}m</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={exportPdf}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>

            <form onSubmit={runAudit} className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold mb-6">Business Info</h2>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Business name *</label>
                    <input
                      value={inputs.businessName}
                      onChange={(e) => setInputs((p) => ({ ...p, businessName: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., Acme Plumbing"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">City / location *</label>
                    <input
                      value={inputs.location}
                      onChange={(e) => setInputs((p) => ({ ...p, location: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., Loganville, GA"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Industry</label>
                    <select
                      value={inputs.industry || ''}
                      onChange={(e) => setInputs((p) => ({ ...p, industry: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      disabled={isLoading}
                    >
                      <option value="">Select</option>
                      <option value="plumbing">Plumbing</option>
                      <option value="hvac">HVAC</option>
                      <option value="electrician">Electrician</option>
                      <option value="roofing">Roofing</option>
                      <option value="real estate">Real Estate</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="lawyer">Law</option>
                      <option value="dentist">Dentist</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Google Business Profile URL (optional)</label>
                    <input
                      value={inputs.gbpUrl || ''}
                      onChange={(e) => setInputs((p) => ({ ...p, gbpUrl: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Paste your GBP URL"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Competitor Search Radius</label>
                  <select
                    value={String(inputs.radiusMeters)}
                    onChange={(e) => handleRadiusChange(Number(e.target.value) as RadiusMeters)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={isLoading}
                  >
                    <option value="1609">1 mile (1609 meters)</option>
                    <option value="3219">2 miles (3219 meters) — default</option>
                    <option value="4828">3 miles (4828 meters)</option>
                    <option value="8047">5 miles (8047 meters)</option>
                  </select>
                  <div className="mt-1 text-xs text-slate-500">
                    We store this radius locally so it’s ready for your Pro upgrade flow later.
                  </div>
                </div>

                {/* Checklist sections */}
                <div className="border-t border-slate-200 pt-6 space-y-8">
                  <Section title="1) Profile Completeness (30pts)" subtitle={`${progressBlocks(data.categories[0].score, data.categories[0].max)}  ${data.categories[0].score}/${data.categories[0].max}`}>
                    <Checkbox label="Business hours set (including weekends if applicable)" checked={checklist.hasHours} onChange={(v) => setChecklist((p) => ({ ...p, hasHours: v }))} />
                    <Checkbox label="Primary phone number added" checked={checklist.hasPhone} onChange={(v) => setChecklist((p) => ({ ...p, hasPhone: v }))} />
                    <Checkbox label="Website link added" checked={checklist.hasWebsite} onChange={(v) => setChecklist((p) => ({ ...p, hasWebsite: v }))} />
                    <Checkbox label="Description optimized (200–400 chars w/ service + city)" checked={checklist.hasDescriptionOptimized} onChange={(v) => setChecklist((p) => ({ ...p, hasDescriptionOptimized: v }))} />
                    <Checkbox label="Services/products listed" checked={checklist.hasServicesListed} onChange={(v) => setChecklist((p) => ({ ...p, hasServicesListed: v }))} />
                    <Checkbox label="Primary category set correctly" checked={checklist.hasPrimaryCategorySet} onChange={(v) => setChecklist((p) => ({ ...p, hasPrimaryCategorySet: v }))} />
                    <Checkbox label="Secondary categories added (2–4)" checked={checklist.hasSecondaryCategories} onChange={(v) => setChecklist((p) => ({ ...p, hasSecondaryCategories: v }))} />
                  </Section>

                  <Section title="2) Visual Assets (25pts)" subtitle={`${progressBlocks(data.categories[1].score, data.categories[1].max)}  ${data.categories[1].score}/${data.categories[1].max}`}>
                    <RadioGroup
                      label="How many photos are on your profile?"
                      value={checklist.photoCountRange}
                      options={[
                        { value: '0-9', label: '0–9 photos' },
                        { value: '10-19', label: '10–19 photos' },
                        { value: '20-49', label: '20–49 photos' },
                        { value: '50+', label: '50+ photos' },
                      ]}
                      onChange={(v) => setChecklist((p) => ({ ...p, photoCountRange: v as any }))}
                    />
                  </Section>

                  <Section title="3) Review Performance (25pts)" subtitle={`${progressBlocks(data.categories[2].score, data.categories[2].max)}  ${data.categories[2].score}/${data.categories[2].max}`}>
                    <SelectRow
                      label="Total review count"
                      value={checklist.reviewCountRange}
                      options={[
                        { value: '0-10', label: '0–10' },
                        { value: '11-25', label: '11–25' },
                        { value: '26-50', label: '26–50' },
                        { value: '51-100', label: '51–100' },
                        { value: '100+', label: '100+' },
                      ]}
                      onChange={(v) => setChecklist((p) => ({ ...p, reviewCountRange: v as any }))}
                    />
                    <SelectRow
                      label="Average rating"
                      value={checklist.ratingRange}
                      options={[
                        { value: '<4.0', label: '< 4.0' },
                        { value: '4.0-4.3', label: '4.0–4.3' },
                        { value: '4.4-4.6', label: '4.4–4.6' },
                        { value: '4.7-4.8', label: '4.7–4.8' },
                        { value: '4.9-5.0', label: '4.9–5.0' },
                      ]}
                      onChange={(v) => setChecklist((p) => ({ ...p, ratingRange: v as any }))}
                    />
                  </Section>

                  <Section title="4) Posting Activity (10pts)" subtitle={`${progressBlocks(data.categories[3].score, data.categories[3].max)}  ${data.categories[3].score}/${data.categories[3].max}`}>
                    <RadioGroup
                      label="How often do you post?"
                      value={checklist.postFrequency}
                      options={[
                        { value: 'none', label: 'Never' },
                        { value: 'monthly', label: 'Monthly' },
                        { value: 'weekly', label: 'Weekly' },
                      ]}
                      onChange={(v) => setChecklist((p) => ({ ...p, postFrequency: v as any }))}
                    />
                    <Checkbox label="You’ve posted in the last 30 days" checked={checklist.postedLast30Days} onChange={(v) => setChecklist((p) => ({ ...p, postedLast30Days: v }))} />
                  </Section>

                  <Section title="5) Citations Consistency (10pts)" subtitle={`${progressBlocks(data.categories[4].score, data.categories[4].max)}  ${data.categories[4].score}/${data.categories[4].max}`}>
                    <Checkbox label="NAP consistent across top directories (Name/Address/Phone)" checked={checklist.napConsistent} onChange={(v) => setChecklist((p) => ({ ...p, napConsistent: v }))} />
                    <Checkbox label="Website URL consistent across listings" checked={checklist.websiteConsistent} onChange={(v) => setChecklist((p) => ({ ...p, websiteConsistent: v }))} />
                    <Checkbox label="Duplicates cleaned up" checked={checklist.duplicatesCleaned} onChange={(v) => setChecklist((p) => ({ ...p, duplicatesCleaned: v }))} />
                    <Checkbox label="Citations updated in the last 90 days" checked={checklist.citationsUpdatedRecently} onChange={(v) => setChecklist((p) => ({ ...p, citationsUpdatedRecently: v }))} />
                  </Section>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !inputs.businessName.trim() || !inputs.location.trim()}
                  className="w-full py-3 px-6 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? 'Scoring…' : 'Generate Results'}
                </button>

                {isLoading && (
                  <div className="pt-2">
                    <GeneratingEffect
                      theme="light"
                      durationMs={5000}
                      title="Generating your GBP audit…"
                      subtitle="Scoring your checklist and compiling next-step recommendations."
                      steps={[
                        'Calculating category scores…',
                        'Building recommendations…',
                        'Preparing results…',
                        'Formatting checklist…',
                        'Finalizing report…',
                      ]}
                    />
                  </div>
                )}
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-10 animate-fade-in-up">
            <JetBizUpgradeOffer
              isOpen={showUpgrade}
              onClose={() => setShowUpgrade(false)}
              businessName={inputs.businessName}
              location={inputs.location}
              liteScore={result.overallScore}
              competitorRadiusMeters={inputs.radiusMeters}
            />
            <div className="flex items-center justify-between gap-4">
              <button onClick={reset} className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Run Another Self‑Audit
              </button>
              <button
                onClick={exportPdf}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">JetBiz Lite Result</div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">{inputs.businessName}</h2>
              <div className={`text-7xl font-extrabold ${gradeColor(result.grade)}`}>{result.overallScore}/100</div>
              <div className="mt-2 text-sm text-slate-600">
                Grade: <span className={`font-bold ${gradeColor(result.grade)}`}>{result.grade}</span>
                <span className="mx-2 text-slate-300">•</span>
                Radius saved: <span className="font-bold">{result.radiusMeters}m</span>
              </div>
              <p className="mt-4 text-slate-500 max-w-3xl mx-auto">
                This is a self‑audit. Use it to spot gaps fast—then fix the highest‑impact items first.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Category Breakdown</h3>
              <div className="space-y-4">
                {result.categories.map((c) => {
                  const pct = c.max > 0 ? c.score / c.max : 0;
                  return (
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
                        <div className={`h-full ${scoreBarColor(pct)}`} style={{ width: `${Math.round(pct * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Basic Recommendations</h3>
              {result.recommendations.length > 0 ? (
                <ul className="list-disc pl-6 text-slate-700 space-y-2">
                  {result.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-700">Solid baseline. Next step is consistency + ongoing activity.</div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Owner‑Only Checklist</h3>
              <div className="text-sm text-slate-600 mb-3">Manual items you should verify inside your GBP:</div>
              <ul className="list-disc pl-6 text-slate-700 space-y-2">
                {result.ownerOnlyChecklist.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="text-center">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all duration-300 hover:scale-105"
              >
                Want a pro audit? Book a consult
              </Link>
              <div className="mt-2 text-xs text-slate-500">We’ll review your profile and prioritize the fixes that move rank + calls.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
      <div className="font-bold text-slate-900">{title}</div>
      <div className="font-mono text-xs text-slate-500">{subtitle}</div>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
    />
    <span className="text-sm text-slate-800">{label}</span>
  </label>
);

const RadioGroup: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div>
    <div className="text-sm font-semibold text-slate-900 mb-2">{label}</div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-indigo-300 transition">
          <input type="radio" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className="text-sm text-slate-800">{o.label}</span>
        </label>
      ))}
    </div>
  </div>
);

const SelectRow: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="block">
    <div className="text-sm font-semibold text-slate-900 mb-2">{label}</div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

