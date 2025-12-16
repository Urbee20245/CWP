import { useState } from 'react';
import { AnalyzerForm } from './components/AnalyzerForm';
import { ResultsDashboard } from './components/ResultsDashboard';
import { CTASection } from './components/CTASection';
import { VisualAnalyzerService } from './services/visualAnalyzer';
import { getCurrentBrand } from './config/brands';
import type { AnalysisRequest, AnalysisResult } from './types';

export function JetViz() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const brandConfig = getCurrentBrand();

  const handleAnalyze = async (request: AnalysisRequest) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const analysisResult = await VisualAnalyzerService.analyzeWebsite(request);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            JetViz - Visual Website Analyzer
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover how your website's design compares to modern standards. 
            Get instant visual analysis and see what's holding your site back.
          </p>
        </div>

        {/* Analyzer Form */}
        {!result && (
          <div className="mb-12">
            <AnalyzerForm onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
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
                className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-lg shadow-lg hover:shadow-xl transition border-2 border-purple-600 hover:bg-purple-50"
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
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🎨</span>
                </div>
                <h3 className="font-bold mb-2">Design Era Detection</h3>
                <p className="text-sm text-gray-600">
                  We identify if your site looks like it's from the 2000s, 2010s, or modern era based on design patterns.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">✅</span>
                </div>
                <h3 className="font-bold mb-2">Trust Signals</h3>
                <p className="text-sm text-gray-600">
                  Check for professional hero images, contact info, SSL, modern colors, whitespace, and typography.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="font-bold mb-2">Mobile Experience</h3>
                <p className="text-sm text-gray-600">
                  Visual mobile preview showing how your site looks on phones and tablets with usability scoring.
                </p>
              </div>
            </div>

            <div className="mt-12 bg-white rounded-lg shadow-md p-8 text-center">
              <h3 className="text-xl font-bold mb-4">Why Visual Analysis Matters</h3>
              <p className="text-gray-600 max-w-3xl mx-auto mb-6">
                Technical performance is important, but first impressions are visual. 
                Studies show that 94% of first impressions are design-related, and users judge 
                your credibility within 0.05 seconds based on visual design alone.
              </p>
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Screenshot Capture</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Design Pattern Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Modernization Recommendations</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
