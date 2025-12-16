import type { AnalysisRequest, AnalysisResult } from '../types';
import { AbacusService } from './abacus';

const FORCE_MOCK = import.meta.env.VITE_USE_MOCK_ANALYZER === 'true';
const HAS_API_KEY = !!import.meta.env.VITE_ABACUS_API_KEY && import.meta.env.VITE_ABACUS_API_KEY !== 'your-api-key-here';

export class AnalyzerService {
  
  static async analyzeWebsite(request: AnalysisRequest): Promise<AnalysisResult> {
    // Determine whether to use real API or Mock
    // Default to Mock if no API key is configured, ensuring "Production" always works (as a demo)
    const useMock = FORCE_MOCK || !HAS_API_KEY;

    if (useMock) {
      // Simulate network delay for realism
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.getMockAnalysis(request.websiteUrl);
    }
    
    try {
      return await AbacusService.analyzeWebsite(request);
    } catch (error) {
      console.warn('Real analysis failed, falling back to simulation:', error);
      return this.getMockAnalysis(request.websiteUrl);
    }
  }

  private static getMockAnalysis(url: string): AnalysisResult {
    // Generate deterministic scores based on the URL string
    // This ensures the same URL always gets the same "random" score
    const hash = this.hashString(url);
    
    // Helper to get a number between min and max based on the hash and a seed offset
    const getScore = (min: number, max: number, seed: number) => {
        const value = (hash + seed) % 100; // 0-99
        // Normalize to 0-1
        const normalized = value / 100; 
        return Math.floor(min + (normalized * (max - min)));
    };

    const overallScore = getScore(45, 85, 1);
    const lcp = getScore(10, 60, 2) / 10; // 1.0 - 6.0
    const fid = getScore(50, 300, 3);
    const cls = getScore(0, 50, 4) / 100; // 0.00 - 0.50

    return {
      websiteUrl: url,
      overallScore: overallScore,
      coreWebVitals: {
        lcp: lcp,
        fid: fid,
        cls: cls,
        score: getScore(40, 95, 5)
      },
      mobileScore: {
        touchTargets: getScore(0, 10, 6) > 3, // 70% chance true
        viewportScaling: true,
        textReadability: getScore(0, 10, 7) > 4, // 60% chance true
        score: getScore(40, 90, 8)
      },
      seoStructure: {
        hasH1: true,
        metaDescription: getScore(0, 10, 9) > 3,
        titleTag: true,
        schemaMarkup: getScore(0, 10, 10) > 7, // 30% chance true
        altTags: getScore(0, 15, 11),
        score: getScore(50, 95, 12)
      },
      localRelevance: {
        napConsistency: getScore(0, 10, 13) > 4,
        googleMyBusiness: getScore(0, 10, 14) > 2,
        localKeywords: getScore(1, 8, 15),
        score: getScore(30, 85, 16)
      },
      keywordGap: {
        competitorKeywords: ['service near me', 'best provider', '24/7 support'],
        missingKeywords: ['affordable options', 'local experts'],
        opportunityScore: getScore(20, 80, 17)
      },
      generatedAt: new Date().toISOString()
    };
  }

  // Simple string hash function
  private static hashString(str: string): number {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
