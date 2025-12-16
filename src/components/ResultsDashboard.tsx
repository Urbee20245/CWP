import type { AnalysisResult } from '../types';

interface ResultsDashboardProps {
  result: AnalysisResult;
}

export function ResultsDashboard({ result }: ResultsDashboardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Overall Score */}
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Overall Score</h2>
        <div className={`text-7xl font-bold ${getScoreColor(result.overallScore)}`}>
          {result.overallScore}/100
        </div>
        <p className="text-gray-600 mt-4">Website: {result.websiteUrl}</p>
      </div>

      {/* Core Web Vitals */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Core Web Vitals</h3>
        <div className={`inline-block px-4 py-2 rounded-full ${getScoreBg(result.coreWebVitals.score)}`}>
          <span className={`font-bold ${getScoreColor(result.coreWebVitals.score)}`}>
            {result.coreWebVitals.score}/100
          </span>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p>
            LCP (Load Speed): <strong>{result.coreWebVitals.lcp}s</strong>{' '}
            {result.coreWebVitals.lcp > 2.5 ? '❌' : '✅'}
          </p>
          <p>
            FID (Interactivity): <strong>{result.coreWebVitals.fid}ms</strong>{' '}
            {result.coreWebVitals.fid > 100 ? '❌' : '✅'}
          </p>
          <p>
            CLS (Visual Stability): <strong>{result.coreWebVitals.cls}</strong>{' '}
            {result.coreWebVitals.cls > 0.1 ? '❌' : '✅'}
          </p>
        </div>
      </div>

      {/* Mobile Responsiveness */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Mobile Responsiveness</h3>
        <div className={`inline-block px-4 py-2 rounded-full ${getScoreBg(result.mobileScore.score)}`}>
          <span className={`font-bold ${getScoreColor(result.mobileScore.score)}`}>
            {result.mobileScore.score}/100
          </span>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p>Touch Targets: {result.mobileScore.touchTargets ? '✅ Passed' : '❌ Failed'}</p>
          <p>Viewport Scaling: {result.mobileScore.viewportScaling ? '✅ Passed' : '❌ Failed'}</p>
          <p>Text Readability: {result.mobileScore.textReadability ? '✅ Passed' : '❌ Failed'}</p>
        </div>
      </div>

      {/* SEO Structure */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">SEO Structure</h3>
        <div className={`inline-block px-4 py-2 rounded-full ${getScoreBg(result.seoStructure.score)}`}>
          <span className={`font-bold ${getScoreColor(result.seoStructure.score)}`}>
            {result.seoStructure.score}/100
          </span>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p>H1 Tag: {result.seoStructure.hasH1 ? '✅ Found' : '❌ Missing'}</p>
          <p>Meta Description: {result.seoStructure.metaDescription ? '✅ Found' : '❌ Missing'}</p>
          <p>Title Tag: {result.seoStructure.titleTag ? '✅ Found' : '❌ Missing'}</p>
          <p>Schema Markup: {result.seoStructure.schemaMarkup ? '✅ Found' : '❌ Missing'}</p>
          <p>
            Images with Alt Tags: <strong>{result.seoStructure.altTags}</strong>
          </p>
        </div>
      </div>

      {/* Local Relevance */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Local Relevance</h3>
        <div className={`inline-block px-4 py-2 rounded-full ${getScoreBg(result.localRelevance.score)}`}>
          <span className={`font-bold ${getScoreColor(result.localRelevance.score)}`}>
            {result.localRelevance.score}/100
          </span>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p>NAP Consistency: {result.localRelevance.napConsistency ? '✅ Consistent' : '❌ Inconsistent'}</p>
          <p>Google My Business: {result.localRelevance.googleMyBusiness ? '✅ Connected' : '❌ Not Found'}</p>
          <p>
            Local Keywords Found: <strong>{result.localRelevance.localKeywords}</strong>
          </p>
        </div>
      </div>

      {/* Keyword Gap Analysis */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Keyword Gap Analysis</h3>
        <div
          className={`inline-block px-4 py-2 rounded-full ${getScoreBg(result.keywordGap.opportunityScore)}`}
        >
          <span className={`font-bold ${getScoreColor(result.keywordGap.opportunityScore)}`}>
            {result.keywordGap.opportunityScore}/100
          </span>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <p className="font-semibold text-sm mb-2">Keywords You're Missing:</p>
            <div className="flex flex-wrap gap-2">
              {result.keywordGap.missingKeywords.map((keyword, i) => (
                <span key={i} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
