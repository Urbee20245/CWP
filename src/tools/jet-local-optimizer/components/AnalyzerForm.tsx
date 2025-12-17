import { useState } from 'react';
import type { AnalysisRequest } from '../types';
import { GeneratingEffect } from './GeneratingEffect';

interface AnalyzerFormProps {
  onAnalyze: (request: AnalysisRequest) => void;
  isLoading: boolean;
}

export function AnalyzerForm({ onAnalyze, isLoading }: AnalyzerFormProps) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!websiteUrl.trim()) {
      alert('Please enter a website URL');
      return;
    }

    onAnalyze({
      websiteUrl: websiteUrl.trim(),
      businessName: businessName.trim() || undefined,
      industry: industry.trim() || undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Analyze Your Website</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="websiteUrl" className="block text-sm font-medium mb-2">
            Website URL *
          </label>
          <input
            id="websiteUrl"
            type="url"
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="businessName" className="block text-sm font-medium mb-2">
            Business Name (Optional)
          </label>
          <input
            id="businessName"
            type="text"
            placeholder="Your Business Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="industry" className="block text-sm font-medium mb-2">
            Industry (Optional)
          </label>
          <input
            id="industry"
            type="text"
            placeholder="e.g., Plumbing, Restaurant, Real Estate"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {isLoading ? 'Analyzing...' : 'Analyze Website'}
        </button>

        {isLoading && (
          <div className="pt-2">
            <GeneratingEffect
              theme="light"
              durationMs={5000}
              title="Generating your audit…"
              subtitle="Hang tight — we’re compiling metrics and recommendations."
            />
          </div>
        )}
      </div>
    </form>
  );
}