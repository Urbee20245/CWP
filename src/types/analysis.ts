export interface AnalysisRequest {
  websiteUrl: string;
  businessName?: string;
  industry?: string;
}

export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  score: number; // 0-100
}

export interface MobileScore {
  touchTargets: boolean;
  viewportScaling: boolean;
  textReadability: boolean;
  score: number; // 0-100
}

export interface SEOStructure {
  hasH1: boolean;
  metaDescription: boolean;
  titleTag: boolean;
  schemaMarkup: boolean;
  altTags: number;
  score: number; // 0-100
}

export interface LocalRelevance {
  napConsistency: boolean;
  googleMyBusiness: boolean;
  localKeywords: number;
  score: number; // 0-100
}

export interface KeywordGap {
  competitorKeywords: string[];
  missingKeywords: string[];
  opportunityScore: number; // 0-100
}

export interface AnalysisResult {
  websiteUrl: string;
  overallScore: number; // 0-100
  coreWebVitals: CoreWebVitals;
  mobileScore: MobileScore;
  seoStructure: SEOStructure;
  localRelevance: LocalRelevance;
  keywordGap: KeywordGap;
  generatedAt: string;
}
