export type RadiusMeters = 1609 | 3219 | 4828 | 8047;

export interface JetBizLiteInputs {
  businessName: string;
  location: string;
  industry?: string;
  gbpUrl?: string;
  radiusMeters: RadiusMeters;
}

export type PhotoCountRange = '0-9' | '10-19' | '20-49' | '50+';
export type PostFrequency = 'none' | 'monthly' | 'weekly';
export type ReviewCountRange = '0-10' | '11-25' | '26-50' | '51-100' | '100+';
export type RatingRange = '<4.0' | '4.0-4.3' | '4.4-4.6' | '4.7-4.8' | '4.9-5.0';

export interface JetBizLiteChecklist {
  // Profile Completeness (30)
  hasHours: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  hasDescriptionOptimized: boolean;
  hasServicesListed: boolean;
  hasPrimaryCategorySet: boolean;
  hasSecondaryCategories: boolean;

  // Visual Assets (25)
  photoCountRange: PhotoCountRange;

  // Review Performance (25)
  reviewCountRange: ReviewCountRange;
  ratingRange: RatingRange;

  // Posting Activity (10)
  postFrequency: PostFrequency;
  postedLast30Days: boolean;

  // Citations Consistency (10)
  napConsistent: boolean;
  websiteConsistent: boolean;
  duplicatesCleaned: boolean;
  citationsUpdatedRecently: boolean;
}

export interface JetBizLiteCategoryScore {
  key: 'profileCompleteness' | 'visualAssets' | 'reviewPerformance' | 'postingActivity' | 'citationsConsistency';
  label: string;
  score: number;
  max: number;
}

export interface JetBizLiteResult {
  overallScore: number; // 0..100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  categories: JetBizLiteCategoryScore[];
  recommendations: string[];
  ownerOnlyChecklist: string[];
  radiusMeters: RadiusMeters;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round = (n: number) => Math.round(n);

export function gradeFromScore(score: number): JetBizLiteResult['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function progressBlocks(score: number, max: number, totalBlocks = 10) {
  const pct = max > 0 ? score / max : 0;
  const filled = clamp(Math.round(pct * totalBlocks), 0, totalBlocks);
  return '▰'.repeat(filled) + '▱'.repeat(totalBlocks - filled);
}

export function calculateJetBizLite(checklist: JetBizLiteChecklist, inputs: JetBizLiteInputs): JetBizLiteResult {
  // Profile Completeness (30)
  const profile =
    (checklist.hasHours ? 6 : 0) +
    (checklist.hasPhone ? 4 : 0) +
    (checklist.hasWebsite ? 4 : 0) +
    (checklist.hasDescriptionOptimized ? 6 : 0) +
    (checklist.hasServicesListed ? 4 : 0) +
    (checklist.hasPrimaryCategorySet ? 3 : 0) +
    (checklist.hasSecondaryCategories ? 3 : 0);

  // Visual Assets (25) — photo range only
  const visualMap: Record<PhotoCountRange, number> = {
    '0-9': 5,
    '10-19': 12,
    '20-49': 20,
    '50+': 25,
  };
  const visual = visualMap[checklist.photoCountRange] ?? 0;

  // Review Performance (25) — review count + rating
  const reviewCountMap: Record<ReviewCountRange, number> = {
    '0-10': 4,
    '11-25': 8,
    '26-50': 12,
    '51-100': 15,
    '100+': 15,
  };
  const ratingMap: Record<RatingRange, number> = {
    '<4.0': 0,
    '4.0-4.3': 4,
    '4.4-4.6': 7,
    '4.7-4.8': 9,
    '4.9-5.0': 10,
  };
  const reviewPerformance = (reviewCountMap[checklist.reviewCountRange] ?? 0) + (ratingMap[checklist.ratingRange] ?? 0);

  // Posting Activity (10)
  const freqMap: Record<PostFrequency, number> = { none: 0, monthly: 6, weekly: 10 };
  const postingActivity = clamp((freqMap[checklist.postFrequency] ?? 0) + (checklist.postedLast30Days ? 2 : 0), 0, 10);

  // Citations Consistency (10)
  const citations =
    (checklist.napConsistent ? 4 : 0) +
    (checklist.websiteConsistent ? 3 : 0) +
    (checklist.duplicatesCleaned ? 2 : 0) +
    (checklist.citationsUpdatedRecently ? 1 : 0);

  const categories: JetBizLiteCategoryScore[] = [
    { key: 'profileCompleteness', label: 'Profile Completeness', score: profile, max: 30 },
    { key: 'visualAssets', label: 'Visual Assets', score: visual, max: 25 },
    { key: 'reviewPerformance', label: 'Review Performance', score: reviewPerformance, max: 25 },
    { key: 'postingActivity', label: 'Posting Activity', score: postingActivity, max: 10 },
    { key: 'citationsConsistency', label: 'Citations Consistency', score: citations, max: 10 },
  ];

  const overallScore = round(categories.reduce((sum, c) => sum + c.score, 0));
  const grade = gradeFromScore(overallScore);

  const recommendations: string[] = [];
  if (!checklist.hasPrimaryCategorySet || !checklist.hasSecondaryCategories) {
    recommendations.push('Tighten your categories: keep one primary category and add 2–4 strong secondary categories.');
  }
  if (!checklist.hasHours) recommendations.push('Add complete hours (including weekends if you operate) to win “open now” searches.');
  if (!checklist.hasPhone) recommendations.push('Add a primary phone number and keep it consistent everywhere (NAP).');
  if (!checklist.hasWebsite) recommendations.push('Add your website link and make sure the landing page matches your GBP services.');
  if (checklist.photoCountRange === '0-9' || checklist.photoCountRange === '10-19') {
    recommendations.push('Upload more real photos (aim for 20+), then add 3–5 fresh photos monthly.');
  }
  if (checklist.reviewCountRange === '0-10' || checklist.reviewCountRange === '11-25') {
    recommendations.push('Build a steady review pipeline (ask every happy customer within 24–48 hours).');
  }
  if (checklist.ratingRange === '<4.0' || checklist.ratingRange === '4.0-4.3') {
    recommendations.push('Improve rating by fixing the #1 complaint theme and responding to negatives professionally.');
  }
  if (checklist.postFrequency === 'none' || !checklist.postedLast30Days) {
    recommendations.push('Post weekly or at least monthly. Fresh posts can increase clicks and calls.');
  }
  if (!checklist.napConsistent || !checklist.websiteConsistent) {
    recommendations.push('Fix citation inconsistencies (Name/Address/Phone/Website) across major directories.');
  }

  // Owner-only checklist (manual items)
  const ownerOnlyChecklist = [
    'Posts & Updates: publish weekly promos, projects, and seasonal offers.',
    'Review Responses: respond to every review (especially negatives) within 48 hours.',
    'Q&A: seed common questions and answer them clearly.',
    'Phone verification: confirm GBP phone verification status inside your profile.',
    'Description optimization: 200–400 chars with your core service + city/area served.',
  ];

  return {
    overallScore: clamp(overallScore, 0, 100),
    grade,
    categories,
    recommendations: recommendations.slice(0, 8),
    ownerOnlyChecklist,
    radiusMeters: inputs.radiusMeters,
  };
}

