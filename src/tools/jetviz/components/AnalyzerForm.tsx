import React, { useState, useEffect } from 'react';
import type { AnalysisRequest } from '../types';

interface AnalyzerFormProps {
  onAnalyze: (request: AnalysisRequest) => void;
  isLoading: boolean;
  initialUrl?: string;
}

export function AnalyzerForm({ onAnalyze, isLoading, initialUrl = '' }: AnalyzerFormProps) {
  const [websiteUrl, setWebsiteUrl] = useState(initialUrl);
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');

  // Update URL when initialUrl prop changes
  useEffect(() => {
    if (initialUrl) {
      setWebsiteUrl(initialUrl);
    }
  }, [initialUrl]);

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
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Analyze Your Website Design</h2>
        <p className="text-gray-600 text-sm">
          Get a visual analysis of your website's design and see how it compares to modern standards
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="websiteUrl" className="block text-sm font-medium mb-2 text-gray-700">
            Website URL *
          </label>
          <input
            id="websiteUrl"
            type="url"
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
            required
            disabled={isLoading}
            autoComplete="url"
          />
        </div>

        <div>
          <label htmlFor="businessName" className="block text-sm font-medium mb-2 text-gray-700">
            Business Name (Optional)
          </label>
          <input
            id="businessName"
            type="text"
            placeholder="Your Business Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
            disabled={isLoading}
            autoComplete="organization"
          />
        </div>

        <div>
          <label htmlFor="industry" className="block text-sm font-medium mb-2 text-gray-700">
            Industry (Optional)
          </label>
          <select
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
            disabled={isLoading}
          >
            <option value="">Select an industry...</option>
            <option value="Restaurant">Restaurant / Food Service</option>
            <option value="Retail">Retail / E-commerce</option>
            <option value="Healthcare">Healthcare / Medical</option>
            <option value="Real Estate">Real Estate</option>
            <option value="Legal">Legal / Law Firm</option>
            <option value="Construction">Construction / Contractors</option>
            <option value="Automotive">Automotive</option>
            <option value="Beauty">Beauty / Salon</option>
            <option value="Fitness">Fitness / Gym</option>
            <option value="Professional Services">Professional Services</option>
            <option value="Technology">Technology / Software</option>
            <option value="Education">Education / Training</option>
            <option value="Hospitality">Hospitality / Hotels</option>
            <option value="Home Services">Home Services / Plumbing</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition shadow-lg"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing Design...
            </span>
          ) : (
            'Analyze Mobile Design'
          )}
        </button>
        
        {isLoading && (
          <p className="text-sm text-center text-gray-500 mt-2">
            Capturing screenshots and analyzing visual design patterns...
          </p>
        )}
      </div>
    </form>
  );
}
