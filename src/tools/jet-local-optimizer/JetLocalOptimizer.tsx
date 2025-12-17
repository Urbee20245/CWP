import React, { useState } from 'react';
import { AnalyzerForm } from './components/AnalyzerForm';
import { ResultsDashboard } from './components/ResultsDashboard';
import { CTASection } from './components/CTASection';
import { AnalyzerService } from './services/analyzer';
import { getCurrentBrand } from './config/brands';
import type { AnalysisRequest, AnalysisResult } from './types';

export function JetLocalOptimizer() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  
  // Get brand config based on env var or default to first one
  const brandConfig = getCurrentBrand();

  const handleAnalyze = async (request: AnalysisRequest) => {
    setIsLoading(true);
    try {
      const data = await AnalyzerService.analyzeWebsite(request);
      setResult(data);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl mb-4">
            <span className="block text-indigo-600">{brandConfig.name}</span>
            <span className="block text-3xl sm:text-4xl mt-2">{brandConfig.title}</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            {brandConfig.description}
          </p>
        </div>

        {!result ? (
          <AnalyzerForm onAnalyze={handleAnalyze} isLoading={isLoading} />
        ) : (
          <div className="space-y-12 animate-fade-in-up">
             <div className="flex justify-center">
                <button 
                  onClick={handleReset}
                  className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-2"
                >
                  ← Analyze Another Site
                </button>
             </div>
            <ResultsDashboard result={result} />
            <CTASection brandConfig={brandConfig} result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
