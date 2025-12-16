import { useState, useEffect } from 'react';
import { AnalyzerForm } from './components/AnalyzerForm';
import { ResultsDashboard } from './components/ResultsDashboard';
import { CTASection } from './components/CTASection';
import { AnalyzerService } from './services/analyzer';
import { getCurrentBrand } from './config/brands';
import type { AnalysisRequest, AnalysisResult } from './types';

interface JetLocalOptimizerProps {
  initialUrl?: string;
  autoAnalyze?: boolean;
}

export function JetLocalOptimizer({ initialUrl = '', autoAnalyze = false }: JetLocalOptimizerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const brandConfig = getCurrentBrand();

  // Auto-analyze if URL is provided and autoAnalyze is true
  useEffect(() => {
    if (autoAnalyze && initialUrl) {
      handleAnalyze({ websiteUrl: initialUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalyze, initialUrl]);

  const handleAnalyze = async (request: AnalysisRequest) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const analysisResult = await AnalyzerService.analyzeWebsite(request);
      setResult(analysisResult);
      
      // Scroll to results
      setTimeout(() => {
        const resultsElement = document.getElementById('analysis-results');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze website. Please check the URL and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNewAnalysis = () => {
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Jet Local Optimizer
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Analyze your website's technical performance, SEO, and local search optimization.
            Get actionable insights to improve your rankings.
          </p>
        </div>

        {/* Analyzer Form */}
        {!result && (
          <div className="mb-12">
            <AnalyzerForm 
              onAnalyze={handleAnalyze} 
              isLoading={isAnalyzing}
              initialUrl={initialUrl}
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-center">{error}</p>
            <button
              onClick={handleNewAnalysis}
              className="mt-4 mx-auto block px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div id="analysis-results" className="space-y-8">
            <ResultsDashboard result={result} />
            <CTASection brandConfig={brandConfig} result={result} />
            
            {/* New Analysis Button */}
            <div className="text-center mt-8">
              <button
                onClick={handleNewAnalysis}
                className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg shadow-lg hover:shadow-xl transition border-2 border-blue-600 hover:bg-blue-50"
              >
                Analyze Another Website
              </button>
            </div>
          </div>
        )}

        {/* Features Section (shown when no results) */}
        {!result && !isAnalyzing && (
          <div className="mt-16 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">
              What We Analyze
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="font-bold mb-2">Core Web Vitals</h3>
                <p className="text-sm text-gray-600">
                  Measure your site's loading speed, interactivity, and visual stability.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="font-bold mb-2">Mobile Responsiveness</h3>
                <p className="text-sm text-gray-600">
                  Check how well your site works on mobile devices and tablets.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🔍</span>
                </div>
                <h3 className="font-bold mb-2">SEO & Local Search</h3>
                <p className="text-sm text-gray-600">
                  Analyze your SEO structure and local business optimization.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
