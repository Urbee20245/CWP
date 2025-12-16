export interface AnalysisRequest {
    websiteUrl: string;
    businessName?: string;
    industry?: string;
  }
  
  export interface CoreWebVitals {
    lcp: number;
    fid: number;
    cls: number;
    score: number;
  }
  
  export interface MobileScore {
    touchTargets: boolean;
    viewportScaling: boolean;
    textReadability: boolean;
    score: number;
  }
  
  export interface SEOStructure {
    hasH1: boolean;
    metaDescription: boolean;
    titleTag: boolean;
    schemaMarkup: boolean;
    altTags: number;
    score: number;
  }
  
  export interface LocalRelevance {
    napConsistency: boolean;
    googleMyBusiness: boolean;
    localKeywords: number;
    score: number;
  }
  
  export interface KeywordGap {
    competitorKeywords: string[];
    missingKeywords: string[];
    opportunityScore: number;
  }
  
  export interface AnalysisResult {
    websiteUrl: string;
    overallScore: number;
    coreWebVitals: CoreWebVitals;
    mobileScore: MobileScore;
    seoStructure: SEOStructure;
    localRelevance: LocalRelevance;
    keywordGap: KeywordGap;
    generatedAt: string;
  }