import { useState } from 'react';
import { getCurrentBrand } from './config/brands';
import { AnalyzerForm } from './components/AnalyzerForm';
import { ResultsDashboard } from './components/ResultsDashboard';
import { CTASection } from './components/CTASection';
import { AnalyzerService } from './services/analyzer';
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
      const analysisResult = await AnalyzerService.analyzeWebsite(request);
      setResult(analysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      console.error('Analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" style={{ color: brandConfig.primaryColor }}>
            Jet Local Optimizer
          </h1>
          <p className="text-xl text-gray-600">
            Complete website health check in 60 seconds
          </p>
          <p className="text-gray-500 mt-2">
            Speed • Mobile • SEO • Local Relevance • Keywords
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {!result && (
          <AnalyzerForm 
            onAnalyze={handleAnalyze} 
            isLoading={isLoading} 
          />
        )}

        {result && (
          <>
            <div className="mb-6 text-center">
              <button
                onClick={handleReset}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                ← Analyze Another Website
              </button>
            </div>
            
            <ResultsDashboard result={result} />
            
            <CTASection 
              brandConfig={brandConfig} 
              result={result} 
            />
          </>
        )}
      </div>
    </div>
  );
}