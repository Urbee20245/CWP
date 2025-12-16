export interface AnalysisRequest {
  websiteUrl: string;
  businessName?: string;
  industry?: string;
}

export interface DesignEra {
  era: '2000s' | '2010s' | 'modern';
  confidence: number; // 0-100
  indicators: string[];
  score: number; // 0-100
}

export interface TrustSignals {
  hasHeroImage: boolean;
  hasContactInfo: boolean;
  hasSSL: boolean;
  modernColorPalette: boolean;
  goodWhitespace: boolean;
  modernFonts: boolean;
  score: number; // 0-100
}

export interface MobilePreview {
  responsive: boolean;
  breakpointsDetected: string[];
  mobileUsabilityScore: number; // 0-100
  issues: string[];
}

export interface VisualElement {
  type: string;
  isOutdated: boolean;
  description: string;
  suggestion: string;
}

export interface VisualComparison {
  outdatedElements: VisualElement[];
  modernizationOpportunities: string[];
  competitorExample: string;
}

export interface ScreenshotData {
  desktop: string; // base64 or URL
  mobile: string; // base64 or URL
  tablet?: string; // base64 or URL
}

export interface AnalysisResult {
  websiteUrl: string;
  overallScore: number; // 0-100
  designEra: DesignEra;
  trustSignals: TrustSignals;
  mobilePreview: MobilePreview;
  visualComparison: VisualComparison;
  screenshots: ScreenshotData;
  generatedAt: string;
}
