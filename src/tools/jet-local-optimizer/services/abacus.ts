import type { AnalysisRequest, AnalysisResult } from '../types';

const ABACUS_API_ENDPOINT = import.meta.env.VITE_ABACUS_ENDPOINT || 'https://your-abacus-endpoint.com/analyze';

export class AbacusService {
  
  static async analyzeWebsite(request: AnalysisRequest): Promise<AnalysisResult> {
    try {
      const response = await fetch(ABACUS_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_ABACUS_API_KEY}`
        },
        body: JSON.stringify({
          url: request.websiteUrl,
          businessName: request.businessName,
          industry: request.industry,
          checks: [
            'core-web-vitals',
            'mobile-responsiveness',
            'seo-structure',
            'local-relevance',
            'keyword-gap'
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Abacus API error: ${response.status}`);
      }

      const data = await response.json();
      return this.transformAbacusResponse(data);
      
    } catch (error) {
      console.error('Abacus analysis failed:', error);
      throw new Error('Failed to analyze website. Please try again.');
    }
  }

  private static transformAbacusResponse(data: any): AnalysisResult {
    return {
      websiteUrl: data.url,
      overallScore: data.overallScore || 0,
      coreWebVitals: data.coreWebVitals,
      mobileScore: data.mobileScore,
      seoStructure: data.seoStructure,
      localRelevance: data.localRelevance,
      keywordGap: data.keywordGap,
      generatedAt: new Date().toISOString()
    };
  }
}