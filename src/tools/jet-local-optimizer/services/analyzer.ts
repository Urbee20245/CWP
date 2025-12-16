import type { AnalysisRequest, AnalysisResult } from '../types';
import { AbacusService } from './abacus';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_ANALYZER === 'true';

export class AnalyzerService {
  
  static async analyzeWebsite(request: AnalysisRequest): Promise<AnalysisResult> {
    if (USE_MOCK_DATA) {
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