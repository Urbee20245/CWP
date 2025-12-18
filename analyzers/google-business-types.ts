export type JetBizScoreCategory =
  | 'profileCompleteness'
  | 'visualAssets'
  | 'reviewPerformance'
  | 'localSeo'
  | 'competitorGap';

export interface JetBizAnalysisRequest {
  /** Business name as typed by the user (used for autocomplete / text search). */
  businessName?: string;
  /** City, state, or general location (used for autocomplete / text search). */
  location?: string;
  /** Optional Google Maps URL. If it includes a Place ID, we use it directly. */
  googleMapsUrl?: string;
  /** Optional industry/category (used as a keyword hint for benchmarking and recommendations). */
  industry?: string;
}

export interface JetBizPlacePrediction {
  description: string;
  placeId: string;
}

export interface JetBizPlacePhotoSummary {
  /** Places Photo API reference is not exposed directly; photo objects provide getUrl(). */
  width: number;
  height: number;
  /** A preview URL for display. */
  url: string;
}

export interface JetBizReviewSummary {
  authorName?: string;
  rating?: number;
  text?: string;
  /** Seconds since epoch (Places JS provides `time` for reviews when available). */
  time?: number;
  relativeTimeDescription?: string;
}

export interface JetBizPlaceDetailsSummary {
  placeId: string;
  name?: string;
  formattedAddress?: string;
  businessStatus?: string;
  types?: string[];
  rating?: number;
  userRatingsTotal?: number;
  formattedPhoneNumber?: string;
  website?: string;
  openingHours?: {
    weekdayText?: string[];
    openNow?: boolean;
  };
  editorialSummary?: string;
  photos: JetBizPlacePhotoSummary[];
  reviews: JetBizReviewSummary[];
  /** Lat/lng for competitor search (when available). */
  location?: { lat: number; lng: number };
}

export interface JetBizCompetitorSummary {
  placeId: string;
  name?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoCount: number;
  hasWebsite: boolean;
  hasPhone: boolean;
  hasHours: boolean;
}

export interface JetBizCategoryScore {
  category: JetBizScoreCategory;
  score: number; // 0-100
  label: string;
}

export type JetBizRecommendationPriority = 'critical' | 'important' | 'suggested';

export interface JetBizRecommendation {
  id: string;
  priority: JetBizRecommendationPriority;
  title: string;
  whyItMatters: string;
  expectedImpact: string;
  steps: string[];
}

export interface JetBizCompetitorBenchmarks {
  competitorCount: number;
  medians: {
    rating: number;
    userRatingsTotal: number;
    photoCount: number;
  };
  rank: {
    rating: number; // 1 = best
    userRatingsTotal: number;
    photoCount: number;
  };
  gaps: {
    rating: number; // +/- vs median
    userRatingsTotal: number;
    photoCount: number;
  };
}

export interface JetBizAnalysisResult {
  place: JetBizPlaceDetailsSummary;
  competitors: JetBizCompetitorSummary[];
  benchmarks: JetBizCompetitorBenchmarks;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  categories: JetBizCategoryScore[];
  recommendations: JetBizRecommendation[];
  generatedAt: string;
  /** Non-fatal notes about API limitations (client-side Places cannot fetch Posts/Q&A/etc.). */
  notes: string[];
  apiUsage: {
    usedToday: number;
    dailyLimit: number;
  };
}

