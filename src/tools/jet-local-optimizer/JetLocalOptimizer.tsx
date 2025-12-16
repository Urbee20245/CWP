import { useState } from 'react';
import { AnalyzerForm } from './components/AnalyzerForm';
import { ResultsDashboard } from './components/ResultsDashboard';
import { CTASection } from './components/CTASection';
import { AnalyzerService } from './services/analyzer';
import { getCurrentBrand } from './config/brands';
import type { AnalysisRequest, AnalysisResult } from './types';

export function JetLocalOptimizer() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const brandConfig = getCurrentBrand();

  const handleAnalyze = async (request: AnalysisRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Starting website analysis...');
      const analysisResult = await AnalyzerService.analyzeWebsite(request);
      setResult(analysisResult);
      console.log('Analysis completed successfully');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Jet Local Optimizer
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Analyze your website's performance, SEO, and local optimization in seconds.
            Get actionable insights powered by real-time data.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Powered by Google PageSpeed Insights & Real-Time Analysis
          </div>
        </div>

        {/* Analyzer Form */}
        <AnalyzerForm onAnalyze={handleAnalyze} isLoading={isLoading} />

        {/* Loading State */}
        {isLoading && (
          <div className="mt-8 text-center">
            <div className="inline-flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-lg">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-gray-800">Analyzing your website...</p>
                <p className="text-sm text-gray-600">This may take 10-30 seconds</p>
                <div className="text-xs text-gray-500 space-y-1 mt-4">
                  <div>⚡ Running PageSpeed Insights analysis</div>
                  <div>🔍 Fetching and parsing HTML</div>
                  <div>📊 Calculating performance metrics</div>
                  <div>✨ Generating recommendations</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-8 p-6 bg-red-50 border-2 border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Analysis Failed</h3>
                <p className="text-red-700 mb-4">{error}</p>
                <div className="text-sm text-red-600 space-y-1">
                  <p><strong>Common issues:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Invalid or unreachable URL</li>
                    <li>Website blocks automated analysis tools</li>
                    <li>CORS restrictions or security policies</li>
                    <li>Rate limiting from PageSpeed API</li>
                  </ul>
                  <p className="mt-3"><strong>Tips:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Make sure the URL is correct and accessible</li>
                    <li>Try again in a few moments</li>
                    <li>Check if the website is publicly accessible</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Dashboard */}
        {result && !isLoading && (
          <div className="mt-8 space-y-8 animate-fade-in">
            <ResultsDashboard result={result} />
            <CTASection brandConfig={brandConfig} result={result} />
            
            {/* Analysis Details Footer */}
            <div className="mt-8 p-4 bg-white rounded-lg shadow text-center text-sm text-gray-500">
              <p>Analysis completed at {new Date(result.generatedAt).toLocaleString()}</p>
              <p className="mt-2">
                Results are based on real-time data from Google PageSpeed Insights and live website analysis
              </p>
            </div>
          </div>
        )}

        {/* Information Section */}
        {!result && !isLoading && !error && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-lg shadow-md">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-bold text-lg mb-2">Core Web Vitals</h3>
              <p className="text-sm text-gray-600">
                Real performance metrics from Google PageSpeed Insights including LCP, FID, and CLS
              </p>
            </div>
            
            <div className="p-6 bg-white rounded-lg shadow-md">
              <div className="text-3xl mb-3">🔍</div>
              <h3 className="font-bold text-lg mb-2">SEO Analysis</h3>
              <p className="text-sm text-gray-600">
                Comprehensive check of meta tags, headings, schema markup, and image optimization
              </p>
            </div>
            
            <div className="p-6 bg-white rounded-lg shadow-md">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="font-bold text-lg mb-2">Mobile Ready</h3>
              <p className="text-sm text-gray-600">
                Mobile responsiveness testing including viewport, touch targets, and readability
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
