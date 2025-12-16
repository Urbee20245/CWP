import { Eye, Monitor, Smartphone, Tablet, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
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

  const getEraColor = (era: string) => {
    if (era === 'modern') return 'bg-green-100 text-green-800';
    if (era === '2010s') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getEraLabel = (era: string) => {
    if (era === 'modern') return '✅ Modern Design';
    if (era === '2010s') return '⚠️ 2010s Style';
    return '❌ Outdated (2000s)';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Overall Score */}
      <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg shadow-2xl p-8 text-center text-white">
        <h2 className="text-3xl font-bold mb-4">Visual Design Score</h2>
        <div className="text-8xl font-bold mb-4">
          {result.overallScore}/100
        </div>
        <p className="text-purple-100 text-lg mb-2">Website: {result.websiteUrl}</p>
        <div className="inline-block mt-4">
          <span className={`px-6 py-2 rounded-full text-lg font-semibold ${getEraColor(result.designEra.era)}`}>
            {getEraLabel(result.designEra.era)}
          </span>
        </div>
      </div>

      {/* Screenshots */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Website Screenshots
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Monitor className="w-4 h-4" />
              Desktop View
            </div>
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img 
                src={result.screenshots.desktop} 
                alt="Desktop screenshot" 
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Tablet className="w-4 h-4" />
              Tablet View
            </div>
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img 
                src={result.screenshots.tablet || result.screenshots.desktop} 
                alt="Tablet screenshot" 
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Smartphone className="w-4 h-4" />
              Mobile View
            </div>
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <img 
                src={result.screenshots.mobile} 
                alt="Mobile screenshot" 
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Design Era Analysis */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Design Era Analysis</h3>
        <div className={`inline-block px-4 py-2 rounded-full ${getScoreBg(result.designEra.score)}`}>
          <span className={`font-bold ${getScoreColor(result.designEra.score)}`}>
            {result.designEra.score}/100
          </span>
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">
            <strong>Detected Era:</strong> {result.designEra.era.toUpperCase()} 
            <span className="ml-2 text-xs">
              (Confidence: {Math.round(result.designEra.confidence)}%)
            </span>
          </p>
          <div className="mt-4">
            <p className="font-semibold text-sm mb-2">Design Indicators:</p>
            <ul className="space-y-2">
              {result.designEra.indicators.map((indicator, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  {indicator}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Trust Signals */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Visual Trust Signals</h3>
        <div className={`inline-block px-4 py-2 rounded-full ${getScoreBg(result.trustSignals.score)}`}>
          <span className={`font-bold ${getScoreColor(result.trustSignals.score)}`}>
            {result.trustSignals.score}/100
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            {result.trustSignals.hasHeroImage ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">Professional Hero Image</span>
          </div>
          <div className="flex items-center gap-2">
            {result.trustSignals.hasContactInfo ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">Contact Information Visible</span>
          </div>
          <div className="flex items-center gap-2">
            {result.trustSignals.hasSSL ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">SSL Certificate (HTTPS)</span>
          </div>
          <div className="flex items-center gap-2">
            {result.trustSignals.modernColorPalette ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">Modern Color Palette</span>
          </div>
          <div className="flex items-center gap-2">
            {result.trustSignals.goodWhitespace ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">Good Whitespace Usage</span>
          </div>
          <div className="flex items-center gap-2">
            {result.trustSignals.modernFonts ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm">Modern Font Choices</span>
          </div>
        </div>
      </div>

      {/* Mobile Preview */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Mobile Visual Experience</h3>
        <div className={`inline-block px-4 py-2 rounded-full ${getScoreBg(result.mobilePreview.mobileUsabilityScore)}`}>
          <span className={`font-bold ${getScoreColor(result.mobilePreview.mobileUsabilityScore)}`}>
            {result.mobilePreview.mobileUsabilityScore}/100
          </span>
        </div>
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            <strong>Responsive:</strong> {result.mobilePreview.responsive ? '✅ Yes' : '❌ No'}
          </p>
          <div>
            <p className="font-semibold text-sm mb-2">Detected Breakpoints:</p>
            <div className="flex flex-wrap gap-2">
              {result.mobilePreview.breakpointsDetected.map((bp, i) => (
                <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  {bp}
                </span>
              ))}
            </div>
          </div>
          {result.mobilePreview.issues.length > 0 && (
            <div>
              <p className="font-semibold text-sm mb-2 text-orange-600">Issues Found:</p>
              <ul className="space-y-1">
                {result.mobilePreview.issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Visual Comparison */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">What Needs to Improve</h3>
        
        {result.visualComparison.outdatedElements.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-sm mb-3 text-red-600">Outdated Elements Detected:</h4>
            <div className="space-y-4">
              {result.visualComparison.outdatedElements.map((element, i) => (
                <div key={i} className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 rounded-r">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="font-semibold text-sm">{element.type}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{element.description}</p>
                  <p className="text-xs text-green-700 bg-green-50 p-2 rounded">
                    💡 <strong>Suggestion:</strong> {element.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="font-semibold text-sm mb-3 text-blue-600">Modernization Opportunities:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.visualComparison.modernizationOpportunities.map((opportunity, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{opportunity}</span>
              </div>
            ))}
          </div>
        </div>

        {result.visualComparison.competitorExample && (
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
            <p className="text-sm text-gray-700">
              <strong className="text-purple-700">Modern Standard:</strong>{' '}
              {result.visualComparison.competitorExample}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
