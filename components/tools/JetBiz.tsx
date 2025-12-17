import React, { useMemo, useState } from 'react';
import { AlertTriangle, Building2, Download, Search, MapPin, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GeneratingEffect } from '../../src/tools/jet-local-optimizer/components/GeneratingEffect';
import { GoogleBusinessAnalyzer } from '../../analyzers/google-business-analyzer';
import type { JetBizAnalysisResult, JetBizPlacePrediction, JetBizRecommendation } from '../../analyzers/google-business-types';

const MIN_GENERATING_MS = 5000;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const gradeColor = (grade: JetBizAnalysisResult['grade']) => {
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

const scoreBarColor = (score: number) => {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
};

const priorityStyles: Record<JetBizRecommendation['priority'], { label: string; classes: string }> = {
  critical: { label: 'CRITICAL', classes: 'border-red-500 bg-red-50 text-red-800' },
  important: { label: 'IMPORTANT', classes: 'border-orange-500 bg-orange-50 text-orange-800' },
  suggested: { label: 'SUGGESTED', classes: 'border-amber-500 bg-amber-50 text-amber-800' },
};

export const JetBiz: React.FC = () => {
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [industry, setIndustry] = useState('');

  const [predictions, setPredictions] = useState<JetBizPlacePrediction[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<JetBizAnalysisResult | null>(null);

  const apiUsage = useMemo(() => GoogleBusinessAnalyzer.getApiUsage(), [isLoading, result]);
  const usagePct = apiUsage.dailyLimit > 0 ? (apiUsage.usedToday / apiUsage.dailyLimit) * 100 : 0;

  const reset = () => {
    setResult(null);
    setPredictions([]);
    setSelectedPlaceId(null);
    setError(null);
    setErrorCode(null);
  };

  const handleFind = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setResult(null);
    setSelectedPlaceId(null);
    setPredictions([]);

    try {
      setIsLoading(true);
      const preds = await GoogleBusinessAnalyzer.getPredictions({ businessName, location, googleMapsUrl, industry });
      setPredictions(preds);
      if (!preds.length) {
        setError('Business not found. Try adding the city/state and spelling it exactly like Google.');
        setErrorCode('NOT_FOUND');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to search right now.');
      setErrorCode(err?.code || null);
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalysis = async (placeId: string) => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    setResult(null);

    try {
      const [data] = await Promise.all([
        GoogleBusinessAnalyzer.analyze({ businessName, location, googleMapsUrl, industry, placeId }),
        delay(MIN_GENERATING_MS),
      ]);
      setResult(data);
      setSelectedPlaceId(placeId);
    } catch (err: any) {
      setErrorCode(err?.code || null);
      if (err?.code === 'RATE_LIMIT') {
        setError('API limit reached. Join the waitlist and we’ll enable higher-capacity scans.');
      } else if (err?.code === 'INVALID_URL') {
        setError('That Google Maps URL does not contain a Place ID. Try searching by name + city, or paste a URL that includes “query_place_id=”.');
      } else if (err?.code === 'MISSING_API_KEY') {
        setError('JetBiz is not configured yet. Missing Google Places API key.');
      } else {
        setError(err?.message || 'Analysis failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const exportPdf = () => {
    if (!result) return;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=900');
    if (!w) return;
    const safe = (s: string) => s.replace(/[<>]/g, '');

    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>JetBiz Report</title>
      <style>
        body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 28px; color: #0f172a; }
        h1,h2,h3 { margin: 0 0 10px; }
        .muted { color: #475569; }
        .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 12px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .badge { display:inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        .critical { background:#fee2e2; color:#991b1b; }
        .important { background:#ffedd5; color:#9a3412; }
        .suggested { background:#fef3c7; color:#92400e; }
        table { width:100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 12px; }
      </style>
    </head><body>`);

    w.document.write(`<h1>JetBiz — Google Business Profile Optimizer</h1>`);
    w.document.write(`<p class="muted">Generated: ${safe(new Date(result.generatedAt).toLocaleString())}</p>`);

    w.document.write(`<div class="card"><h2>${safe(result.place.name || 'Business')}</h2>
      <p class="muted">${safe(result.place.formattedAddress || '')}</p>
      <p><strong>Overall:</strong> ${result.overallScore}/100 (${result.grade})</p></div>`);

    w.document.write(`<div class="card"><h3>Category Scores</h3><div class="grid">`);
    result.categories.forEach((c) => {
      w.document.write(`<div><strong>${safe(c.label)}:</strong> ${c.score}/100</div>`);
    });
    w.document.write(`</div></div>`);

    w.document.write(`<div class="card"><h3>Competitor Benchmarks</h3>
      <p class="muted">Compared to ${result.benchmarks.competitorCount} nearby competitors.</p>
      <table><thead><tr><th>Metric</th><th>Your value</th><th>Median</th><th>Rank</th></tr></thead><tbody>
        <tr><td>Rating</td><td>${result.place.rating ?? 0}</td><td>${result.benchmarks.medians.rating.toFixed(2)}</td><td>#${result.benchmarks.rank.rating}</td></tr>
        <tr><td>Reviews</td><td>${result.place.userRatingsTotal ?? 0}</td><td>${result.benchmarks.medians.userRatingsTotal}</td><td>#${result.benchmarks.rank.userRatingsTotal}</td></tr>
        <tr><td>Photos</td><td>${result.place.photos.length}</td><td>${result.benchmarks.medians.photoCount}</td><td>#${result.benchmarks.rank.photoCount}</td></tr>
      </tbody></table></div>`);

    w.document.write(`<div class="card"><h3>Priority Recommendations</h3>`);
    result.recommendations.forEach((r) => {
      w.document.write(`<div style="margin:10px 0;">
        <span class="badge ${r.priority}">${r.priority.toUpperCase()}</span>
        <div style="font-weight:700; margin-top:6px;">${safe(r.title)}</div>
        <div class="muted">${safe(r.whyItMatters)}</div>
      </div>`);
    });
    w.document.write(`</div>`);

    w.document.write(`<p class="muted">Tip: Use your browser’s Print → “Save as PDF”.</p>`);
    w.document.write(`</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {!result ? (
          <>
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-widest mb-4">
                <Building2 className="w-4 h-4" />
                JetBiz — Google Business Profile Optimizer
              </div>
              <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl mb-3">
                Your competitors are outranking you. Here’s why.
              </h1>
              <p className="text-slate-600 max-w-3xl mx-auto">
                Analyze your Google Business Profile, compare it to nearby competitors, and get a prioritized fix list to win local visibility.
              </p>
            </div>

            <form onSubmit={handleFind} className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold mb-6">Find Your Business</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Business name *</label>
                    <input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., Acme Plumbing"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">City / location *</label>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., Loganville, GA"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Industry (optional)</label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
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
                    <label className="block text-sm font-medium mb-2">
                      Google Maps URL (optional)
                    </label>
                    <input
                      value={googleMapsUrl}
                      onChange={(e) => setGoogleMapsUrl(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Paste a Maps link (Place ID supported)"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3 px-6 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    <Search className="w-5 h-5" />
                    {isLoading ? 'Searching…' : 'Find Business'}
                  </button>
                  <div className="text-xs text-slate-500 text-right min-w-[180px]">
                    API usage: <span className="font-bold">{apiUsage.usedToday}</span> / {apiUsage.dailyLimit}
                    <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, usagePct)}%` }} />
                    </div>
                  </div>
                </div>

                {isLoading && (
                  <div className="pt-2">
                    <GeneratingEffect
                      theme="light"
                      durationMs={5000}
                      title="Finding your business…"
                      subtitle="Searching Google Places and preparing a competitive benchmark."
                      steps={[
                        'Finding your business…',
                        'Fetching profile details…',
                        'Locating nearby competitors…',
                        'Benchmarking key metrics…',
                        'Preparing recommendations…',
                      ]}
                    />
                  </div>
                )}

                {error && (
                  <div className="mt-2 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Unable to continue</div>
                      <div>{error}</div>
                      {errorCode === 'RATE_LIMIT' && (
                        <div className="mt-3">
                          <Link
                            to="/contact"
                            className="inline-flex items-center gap-2 text-indigo-700 font-bold underline underline-offset-4"
                          >
                            Join the waitlist / get help <MapPin className="w-4 h-4" />
                          </Link>
                        </div>
                      )}
                      {errorCode === 'NOT_FOUND' && (
                        <ul className="mt-2 list-disc pl-5 text-xs text-red-700/90 space-y-1">
                          <li>Try adding the state (e.g., “Loganville, GA”).</li>
                          <li>Use the exact business name shown on Google.</li>
                          <li>Remove keywords like “best” or “near me”.</li>
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {predictions.length > 0 && (
                  <div className="mt-6">
                    <div className="text-sm font-bold text-slate-900 mb-2">Select your business</div>
                    <div className="space-y-2">
                      {predictions.map((p) => (
                        <button
                          key={p.placeId}
                          type="button"
                          onClick={() => runAnalysis(p.placeId)}
                          disabled={isLoading}
                          className="w-full text-left p-4 rounded-lg border border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all disabled:opacity-60"
                        >
                          <div className="font-semibold text-slate-900">{p.description}</div>
                          <div className="text-xs text-slate-500">Place ID: {p.placeId}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-10 animate-fade-in-up">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={reset}
                className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Analyze Another Business
              </button>
              <button
                onClick={exportPdf}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                Google Business Profile Score
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">{result.place.name}</h2>
              <div className={`text-7xl font-extrabold ${gradeColor(result.grade)}`}>
                {result.overallScore}/100
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Grade: <span className={`font-bold ${gradeColor(result.grade)}`}>{result.grade}</span>
                <span className="mx-2 text-slate-300">•</span>
                Rank: <span className="font-bold">#{Math.min(6, result.benchmarks.rank.userRatingsTotal)}</span> by reviews in your area
              </div>
              <p className="mt-4 text-slate-500 max-w-3xl mx-auto">
                Compared against {result.benchmarks.competitorCount} nearby competitors. The gaps below explain why you’re losing visibility.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Category Scores</h3>
              <div className="space-y-4">
                {result.categories.map((c) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-slate-900">{c.label}</span>
                      <span className="font-bold text-slate-700">{c.score}/100</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full ${scoreBarColor(c.score)}`} style={{ width: `${c.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Competitor Comparison</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="text-left py-2 pr-4">Business</th>
                      <th className="text-left py-2 pr-4">Rating</th>
                      <th className="text-left py-2 pr-4">Reviews</th>
                      <th className="text-left py-2 pr-4">Photos</th>
                      <th className="text-left py-2 pr-4">Website</th>
                      <th className="text-left py-2 pr-4">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-800">
                    <tr className="border-t border-slate-200 bg-indigo-50/40">
                      <td className="py-3 pr-4 font-bold">{result.place.name} (You)</td>
                      <td className="py-3 pr-4">{result.place.rating ?? 0}</td>
                      <td className="py-3 pr-4">{result.place.userRatingsTotal ?? 0}</td>
                      <td className="py-3 pr-4">{result.place.photos.length}</td>
                      <td className="py-3 pr-4">{result.place.website ? '✅' : '❌'}</td>
                      <td className="py-3 pr-4">{result.place.openingHours?.weekdayText?.length ? '✅' : '❌'}</td>
                    </tr>
                    {result.competitors.map((c) => (
                      <tr key={c.placeId} className="border-t border-slate-200">
                        <td className="py-3 pr-4">{c.name}</td>
                        <td className="py-3 pr-4">{c.rating ?? 0}</td>
                        <td className="py-3 pr-4">{c.userRatingsTotal ?? 0}</td>
                        <td className="py-3 pr-4">{c.photoCount}</td>
                        <td className="py-3 pr-4">{c.hasWebsite ? '✅' : '❌'}</td>
                        <td className="py-3 pr-4">{c.hasHours ? '✅' : '❌'}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 text-slate-600">
                      <td className="py-3 pr-4 font-semibold">Median (area)</td>
                      <td className="py-3 pr-4">{result.benchmarks.medians.rating.toFixed(2)}</td>
                      <td className="py-3 pr-4">{result.benchmarks.medians.userRatingsTotal}</td>
                      <td className="py-3 pr-4">{result.benchmarks.medians.photoCount}</td>
                      <td className="py-3 pr-4">—</td>
                      <td className="py-3 pr-4">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-xs text-slate-500">
                Gaps vs median: Rating <span className="font-bold">{result.benchmarks.gaps.rating.toFixed(2)}</span>, Reviews{' '}
                <span className="font-bold">{result.benchmarks.gaps.userRatingsTotal}</span>, Photos{' '}
                <span className="font-bold">{result.benchmarks.gaps.photoCount}</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">Priority Recommendations</h3>
              <div className="space-y-4">
                {result.recommendations.map((r) => {
                  const s = priorityStyles[r.priority];
                  return (
                    <div key={r.id} className={`border-l-4 ${s.classes} p-4 rounded-lg`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-bold">{r.title}</div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">{s.label}</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-700">{r.whyItMatters}</div>
                      <div className="mt-2 text-sm text-slate-700">
                        <span className="font-semibold">Expected impact:</span> {r.expectedImpact}
                      </div>
                      <ol className="mt-3 list-decimal pl-5 text-sm text-slate-700 space-y-1">
                        {r.steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
              </div>
            </div>

            {result.notes.length > 0 && (
              <div className="bg-slate-900 text-slate-100 rounded-lg p-6">
                <div className="text-sm font-bold mb-2">Notes (API limitations)</div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
                  {result.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-center">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all duration-300 hover:scale-105"
              >
                Your competitors are outranking you. Fix it now → Book a consult
              </Link>
              <div className="mt-2 text-xs text-slate-500">
                We’ll review your GBP + local competition and map out a plan to win your area.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

