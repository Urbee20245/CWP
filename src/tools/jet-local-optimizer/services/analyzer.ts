import type { AnalysisRequest, AnalysisResult } from '../types';
import { AbacusService } from './abacus';

// Smart detection: Use mock data if no real API is configured
const shouldUseMockData = () => {
  const endpoint = import.meta.env.VITE_ABACUS_ENDPOINT;
  const apiKey = import.meta.env.VITE_ABACUS_API_KEY;
  const forceMock = import.meta.env.VITE_USE_MOCK_ANALYZER === 'true';
  
  // Use mock if explicitly requested
  if (forceMock) return true;
  
  // Use mock if no endpoint configured or using placeholder
  if (!endpoint || endpoint.includes('your-abacus-endpoint')) return true;
  
  // Use mock if no API key or using placeholder
  if (!apiKey || apiKey.includes('your-api-key')) return true;
  
  // Only use real API if everything is properly configured
  return false;
};

export class AnalyzerService {
  
  static async analyzeWebsite(request: AnalysisRequest): Promise<AnalysisResult> {
    if (shouldUseMockData()) {
      // Add small delay to simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      return this.getMockAnalysis(request.websiteUrl);
    }
    
    return AbacusService.analyzeWebsite(request);
  }

  private static getMockAnalysis(url: string): AnalysisResult {
    return {
      websiteUrl: url,
      overallScore: 62,
      coreWebVitals: {
        lcp: 3.2,
        fid: 150,
        cls: 0.15,
        score: 58
      },
      mobileScore: {
        touchTargets: false,
        viewportScaling: true,
        textReadability: false,
        score: 55
      },
      seoStructure: {
        hasH1: true,
        metaDescription: false,
        titleTag: true,
        schemaMarkup: false,
        altTags: 3,
        score: 65
      },
      localRelevance: {
        napConsistency: true,
        googleMyBusiness: false,
        localKeywords: 2,
        score: 60
      },
      keywordGap: {
        competitorKeywords: ['plumbing atlanta', 'emergency plumber', '24/7 plumbing service'],
        missingKeywords: ['emergency plumber', '24/7 plumbing service'],
        opportunityScore: 45
      },
      generatedAt: new Date().toISOString()
    };
  }
}
