import { GoogleBusinessAnalyzer } from './google-business-analyzer';
import type { JetBizPlaceDetailsSummary } from './google-business-types';
import { calculateJetBizLite, gradeFromScore, type RadiusMeters } from './jetbiz-lite-analyzer';

export type JetBizProPriority = 'critical' | 'important' | 'recommended';

export interface JetBizProAction {
  id: string;
  priority: JetBizProPriority;
  title: string;
  whyItMatters: string;
  impactPercent: number;
  expectedImpact: string;
  timeRequired: string;
  steps: string[];
}

export interface JetBizProCompetitorCard {
  placeId: string;
  name: string;
  score: number;
  grade: ReturnType<typeof gradeFromScore>;
  distanceMiles: number;
  photoCount: number;
  photoDeltaVsYou: number;
  rating: number;
  reviewCount: number;
  betterAt: string[];
  mapsUrl: string;
}

export interface JetBizProComparisonRow {
  metric: string;
  you: string;
  top3Avg: string;
}

export interface JetBizProResult {
  radiusMeters: RadiusMeters;
  radiusMiles: number;
  competitorsFound: number;
  liteScore: number;
  proScore: number;
  proGrade: ReturnType<typeof gradeFromScore>;
  categories: { key: string; label: string; score: number; max: number }[];
  comparisonTable: JetBizProComparisonRow[];
  competitors: JetBizProCompetitorCard[];
  actionPlan: JetBizProAction[];
  ownerOnlyChecklist: string[];
  citationsUpsell: { price: number; headline: string; bullets: string[] };
  notes: string[];
  generatedAt: string;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const metersToMiles = (m: number) => m / 1609.34;

function makePlacesService(): any {
  const div = document.createElement('div');
  return new (window as any).google.maps.places.PlacesService(div);
}

function wrapDetails(service: any, request: any) {
  return new Promise<any>((resolve, reject) => {
    service.getDetails(request, (details: any, status: any) => {
      const ok = (window as any).google?.maps?.places?.PlacesServiceStatus?.OK;
      if (status !== ok || !details) return reject(new Error('Unable to fetch place details'));
      resolve(details);
    });
  });
}

function wrapNearby(service: any, request: any) {
  return new Promise<any[]>((resolve, reject) => {
    service.nearbySearch(request, (results: any[], status: any) => {
      const placesStatus = (window as any).google?.maps?.places?.PlacesServiceStatus;
      const ok = placesStatus?.OK;
      const zero = placesStatus?.ZERO_RESULTS;
      if (status === zero) return resolve([]);
      if (status !== ok || !results) return reject(new Error('Unable to fetch competitors'));
      resolve(results);
    });
  });
}

function toSummary(details: any): JetBizPlaceDetailsSummary {
  const loc = details?.geometry?.location;
  const location =
    loc && typeof loc.lat === 'function' && typeof loc.lng === 'function'
      ? { lat: loc.lat(), lng: loc.lng() }
      : undefined;

  const photos = Array.isArray(details?.photos)
    ? details.photos.slice(0, 25).map((p: any) => ({
        width: Number(p.width) || 0,
        height: Number(p.height) || 0,
        url: typeof p.getUrl === 'function' ? p.getUrl({ maxWidth: 1200, maxHeight: 1200 }) : '',
      }))
    : [];

  const reviews = Array.isArray(details?.reviews)
    ? details.reviews.slice(0, 10).map((r: any) => ({
        authorName: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.time,
        relativeTimeDescription: r.relative_time_description,
      }))
    : [];

  return {
    placeId: details?.place_id || '',
    name: details?.name,
    formattedAddress: details?.formatted_address,
    businessStatus: details?.business_status,
    types: details?.types,
    rating: details?.rating,
    userRatingsTotal: details?.user_ratings_total,
    formattedPhoneNumber: details?.formatted_phone_number,
    website: details?.website,
    openingHours: details?.opening_hours
      ? {
          weekdayText: details.opening_hours.weekday_text,
          openNow: details.opening_hours.open_now,
        }
      : undefined,
    editorialSummary: details?.editorial_summary?.overview,
    photos,
    reviews,
    location,
  };
}

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.7613; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function firstMeaningfulType(types?: string[]) {
  const t = (types || []).find((x) => !['point_of_interest', 'establishment'].includes(x));
  return t || undefined;
}

function normalizePhoneDigits(s?: string) {
  return (s || '').replace(/\D/g, '');
}

async function fetchHtmlViaProxies(url: string): Promise<string | null> {
  const proxies = [
    (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];
  for (const mk of proxies) {
    try {
      const resp = await fetch(mk(url));
      if (!resp.ok) continue;
      const data = await resp.json().catch(() => null);
      const html = (data?.contents || data) as any;
      if (typeof html === 'string' && html.length > 100) return html;
    } catch {
      // try next proxy
    }
  }
  return null;
}

function detectNapMismatch(place: JetBizPlaceDetailsSummary, websiteHtml: string | null) {
  if (!websiteHtml) return { phoneMatch: null as null | boolean, addressMatch: null as null | boolean };
  const text = websiteHtml.toLowerCase();
  const phoneDigits = normalizePhoneDigits(place.formattedPhoneNumber);
  const phoneMatch = phoneDigits ? text.replace(/\D/g, '').includes(phoneDigits) : null;

  const addr = (place.formattedAddress || '').toLowerCase();
  const addrToken = addr.split(',')[0]?.trim();
  const addressMatch = addrToken && addrToken.length > 6 ? text.includes(addrToken) : null;

  return { phoneMatch, addressMatch };
}

function placeToLiteChecklist(place: JetBizPlaceDetailsSummary) {
  const recentReview = place.reviews.some((r) => (r.time || 0) > Date.now() / 1000 - 30 * 24 * 3600);
  const photoCount = place.photos.length;
  const photoCountRange =
    photoCount >= 50 ? '50+' : photoCount >= 20 ? '20-49' : photoCount >= 10 ? '10-19' : '0-9';

  const reviewCount = place.userRatingsTotal || 0;
  const reviewCountRange =
    reviewCount >= 100 ? '100+' : reviewCount >= 51 ? '51-100' : reviewCount >= 26 ? '26-50' : reviewCount >= 11 ? '11-25' : '0-10';

  const rating = place.rating || 0;
  const ratingRange =
    rating >= 4.9 ? '4.9-5.0' : rating >= 4.7 ? '4.7-4.8' : rating >= 4.4 ? '4.4-4.6' : rating >= 4.0 ? '4.0-4.3' : '<4.0';

  const types = place.types || [];

  return {
    hasHours: !!place.openingHours?.weekdayText?.length,
    hasPhone: !!place.formattedPhoneNumber,
    hasWebsite: !!place.website,
    // editorialSummary is used as a proxy for description quality in the existing analyzer.
    hasDescriptionOptimized: (place.editorialSummary || '').length >= 200,
    hasServicesListed: types.length >= 3, // proxy
    hasPrimaryCategorySet: types.length >= 1,
    hasSecondaryCategories: types.length >= 4,
    photoCountRange,
    reviewCountRange,
    ratingRange,
    postFrequency: recentReview ? 'monthly' : 'none', // proxy for activity
    postedLast30Days: recentReview,
    // citation consistency is computed separately (website vs GBP best-effort)
    napConsistent: !!place.formattedPhoneNumber && !!place.formattedAddress,
    websiteConsistent: !!place.website,
    duplicatesCleaned: false,
    citationsUpdatedRecently: false,
  } as any;
}

function competitorBetterAt(you: any, them: any) {
  const gaps: { label: string; delta: number }[] = [
    { label: 'Profile Completeness', delta: them.profileCompleteness - you.profileCompleteness },
    { label: 'Visual Assets', delta: them.visualAssets - you.visualAssets },
    { label: 'Review Performance', delta: them.reviewPerformance - you.reviewPerformance },
    { label: 'Posting Activity', delta: them.postingActivity - you.postingActivity },
    { label: 'Citations', delta: them.citationsConsistency - you.citationsConsistency },
  ];
  return gaps
    .filter((g) => g.delta >= 8)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map((g) => g.label);
}

function buildActionPlan(youScores: any, top3Avg: any): JetBizProAction[] {
  const weights = {
    profileCompleteness: 0.30,
    visualAssets: 0.25,
    reviewPerformance: 0.25,
    postingActivity: 0.10,
    citationsConsistency: 0.10,
  };

  const actions: JetBizProAction[] = [];

  const push = (priority: JetBizProPriority, title: string, why: string, impact: number, time: string, steps: string[]) => {
    actions.push({
      id: `${priority}:${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      priority,
      title,
      whyItMatters: why,
      impactPercent: clamp(Math.round(impact), 1, 40),
      expectedImpact: 'Improved map-pack visibility and higher conversion from local searches.',
      timeRequired: time,
      steps,
    });
  };

  const gap = (k: keyof typeof weights) => (top3Avg[k] || 0) - (youScores[k] || 0);
  const impact = (k: keyof typeof weights) => clamp(gap(k) * weights[k], 0, 40);

  if (gap('profileCompleteness') >= 8) {
    push(
      'critical',
      'Fix profile completeness gaps',
      'Incomplete profiles lose trust and relevance signals compared to nearby competitors.',
      100 * impact('profileCompleteness'),
      '30–60 minutes',
      [
        'Verify hours (including weekends/holidays).',
        'Add/confirm phone + website.',
        'Improve description to 200–400 chars with service + city.',
        'Add 2–4 strong secondary categories.',
      ]
    );
  }

  if (gap('reviewPerformance') >= 8) {
    push(
      gap('reviewPerformance') >= 15 ? 'critical' : 'important',
      'Close the review gap vs top competitors',
      'Review volume and rating heavily influence both ranking and clicks.',
      100 * impact('reviewPerformance'),
      '1–2 hours to set up, then ongoing',
      [
        'Create a review link and a 2‑message request template.',
        'Ask every satisfied customer within 24–48 hours.',
        'Respond to every review (especially negatives) within 48 hours.',
      ]
    );
  }

  if (gap('visualAssets') >= 8) {
    push(
      'important',
      'Increase photo volume and freshness',
      'Competitors with stronger photo coverage win more clicks and calls.',
      100 * impact('visualAssets'),
      '45–90 minutes',
      [
        'Upload 20+ real photos (exterior, interior, team, work, results).',
        'Add 3–5 new photos monthly.',
        'Use consistent branding; avoid stock imagery.',
      ]
    );
  }

  if (gap('postingActivity') >= 6) {
    push(
      'recommended',
      'Post consistently',
      'Posting keeps your profile active and can increase engagement signals.',
      100 * impact('postingActivity'),
      '15 minutes/week',
      [
        'Post weekly: offers, recent jobs, seasonal tips.',
        'Reuse content from social posts; keep it simple.',
        'Include a clear CTA (call, book, quote).',
      ]
    );
  }

  if (gap('citationsConsistency') >= 6) {
    push(
      'important',
      'Fix citation consistency (NAP)',
      'Inconsistent NAP reduces trust and can suppress local rankings.',
      100 * impact('citationsConsistency'),
      '2–4 hours',
      [
        'Standardize business name, address, and phone everywhere.',
        'Fix website URL mismatches across listings.',
        'Remove duplicates and outdated listings.',
      ]
    );
  }

  const order: Record<JetBizProPriority, number> = { critical: 0, important: 1, recommended: 2 };
  return actions.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 10);
}

export class JetBizProAnalyzer {
  static async run(args: {
    businessName: string;
    location: string;
    industry?: string;
    radiusMeters: RadiusMeters;
    liteScore: number;
  }): Promise<JetBizProResult> {
    const { businessName, location, industry, radiusMeters, liteScore } = args;

    // 1) Autocomplete → placeId
    const preds = await GoogleBusinessAnalyzer.getPredictions({ businessName, location, industry } as any);
    const placeId = preds?.[0]?.placeId;
    if (!placeId) {
      const err = new Error('Business not found');
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // 2) Place Details
    const ps = makePlacesService();
    const youDetails = await wrapDetails(ps, {
      placeId,
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'business_status',
        'types',
        'rating',
        'user_ratings_total',
        'photos',
        'opening_hours',
        'formatted_phone_number',
        'website',
        'reviews',
        'geometry',
        'editorial_summary',
      ],
    });
    const you = toSummary(youDetails);
    const youLoc = you.location;
    if (!youLoc) {
      const err = new Error('Missing business location');
      (err as any).code = 'MISSING_LOCATION';
      throw err;
    }

    // 3) Top 10 competitors via Nearby Search within paid radius
    const typeHint = firstMeaningfulType(you.types);
    const g = (window as any).google;
    const nearbyRequest: any = {
      location: new g.maps.LatLng(youLoc.lat, youLoc.lng),
      radius: radiusMeters,
      rankBy: g.maps.places.RankBy.PROMINENCE,
    };
    if (typeHint) nearbyRequest.type = typeHint;
    const nearby = await wrapNearby(ps, nearbyRequest);

    const candidates = nearby
      .filter((r: any) => r?.place_id && r.place_id !== you.placeId)
      .map((r: any) => ({
        placeId: r.place_id,
        scoreKey: (r.rating || 0) * (r.user_ratings_total || 0),
      }))
      .sort((a: any, b: any) => b.scoreKey - a.scoreKey)
      .slice(0, 10);

    // 8) Best-effort NAP consistency vs website HTML (cannot verify “across platforms” client-side)
    const websiteHtml = you.website ? await fetchHtmlViaProxies(you.website) : null;
    const nap = detectNapMismatch(you, websiteHtml);

    // 4) Pro score (same 5 categories as Lite) using Places-derived checklist
    const youChecklist = placeToLiteChecklist(you);
    // Apply best-effort citation checks
    if (nap.phoneMatch === false) youChecklist.napConsistent = false;
    if (nap.addressMatch === false) youChecklist.websiteConsistent = false;

    const youLiteLike = calculateJetBizLite(youChecklist as any, {
      businessName,
      location,
      industry,
      gbpUrl: '',
      radiusMeters,
    });

    const youByKey: any = {
      profileCompleteness: youLiteLike.categories.find((c) => c.key === 'profileCompleteness')?.score || 0,
      visualAssets: youLiteLike.categories.find((c) => c.key === 'visualAssets')?.score || 0,
      reviewPerformance: youLiteLike.categories.find((c) => c.key === 'reviewPerformance')?.score || 0,
      postingActivity: youLiteLike.categories.find((c) => c.key === 'postingActivity')?.score || 0,
      citationsConsistency: youLiteLike.categories.find((c) => c.key === 'citationsConsistency')?.score || 0,
    };

    // 3) Rank competitors by rating × review_count and compute distance/cards
    const competitorCards: JetBizProCompetitorCard[] = [];
    const competitorScoresForTop3: any[] = [];

    for (const c of candidates) {
      const details = await wrapDetails(ps, {
        placeId: c.placeId,
        fields: [
          'place_id',
          'name',
          'formatted_address',
          'business_status',
          'types',
          'rating',
          'user_ratings_total',
          'photos',
          'opening_hours',
          'formatted_phone_number',
          'website',
          'reviews',
          'geometry',
          'editorial_summary',
        ],
      });
      const place = toSummary(details);
      const loc = place.location;
      const dist = loc ? haversineMiles(youLoc, loc) : metersToMiles(radiusMeters);

      const checklist = placeToLiteChecklist(place);
      const liteLike = calculateJetBizLite(checklist as any, {
        businessName: place.name || '',
        location: place.formattedAddress || '',
        industry,
        gbpUrl: '',
        radiusMeters,
      });
      const score = liteLike.overallScore;

      const byKey: any = {
        profileCompleteness: liteLike.categories.find((x) => x.key === 'profileCompleteness')?.score || 0,
        visualAssets: liteLike.categories.find((x) => x.key === 'visualAssets')?.score || 0,
        reviewPerformance: liteLike.categories.find((x) => x.key === 'reviewPerformance')?.score || 0,
        postingActivity: liteLike.categories.find((x) => x.key === 'postingActivity')?.score || 0,
        citationsConsistency: liteLike.categories.find((x) => x.key === 'citationsConsistency')?.score || 0,
      };

      competitorCards.push({
        placeId: c.placeId,
        name: place.name || 'Competitor',
        score,
        grade: gradeFromScore(score),
        distanceMiles: Math.round(dist * 10) / 10,
        photoCount: place.photos.length,
        photoDeltaVsYou: place.photos.length - you.photos.length,
        rating: place.rating || 0,
        reviewCount: place.userRatingsTotal || 0,
        betterAt: competitorBetterAt(youByKey, byKey),
        mapsUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(c.placeId)}`,
      });

      competitorScoresForTop3.push(byKey);
    }

    const sortedByScore = [...competitorCards].sort((a, b) => b.score - a.score);
    const top3 = sortedByScore.slice(0, 3);

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const top3Avg = {
      rating: avg(top3.map((c) => c.rating)),
      reviewCount: avg(top3.map((c) => c.reviewCount)),
      photoCount: avg(top3.map((c) => c.photoCount)),
      profileCompleteness: avg(competitorScoresForTop3.slice(0, 3).map((x) => x.profileCompleteness)),
      visualAssets: avg(competitorScoresForTop3.slice(0, 3).map((x) => x.visualAssets)),
      reviewPerformance: avg(competitorScoresForTop3.slice(0, 3).map((x) => x.reviewPerformance)),
      postingActivity: avg(competitorScoresForTop3.slice(0, 3).map((x) => x.postingActivity)),
      citationsConsistency: avg(competitorScoresForTop3.slice(0, 3).map((x) => x.citationsConsistency)),
    };

    // 5) Comparison table (You vs Top 3 avg)
    const comparisonTable: JetBizProComparisonRow[] = [
      { metric: 'Rating', you: String(you.rating ?? 0), top3Avg: top3Avg.rating.toFixed(2) },
      { metric: 'Review count', you: String(you.userRatingsTotal ?? 0), top3Avg: Math.round(top3Avg.reviewCount).toString() },
      { metric: 'Photo count', you: String(you.photos.length), top3Avg: Math.round(top3Avg.photoCount).toString() },
    ];

    // 7) Priority action plan
    const actionPlan = buildActionPlan(
      youByKey,
      {
        profileCompleteness: top3Avg.profileCompleteness,
        visualAssets: top3Avg.visualAssets,
        reviewPerformance: top3Avg.reviewPerformance,
        postingActivity: top3Avg.postingActivity,
        citationsConsistency: top3Avg.citationsConsistency,
      }
    );

    const notes: string[] = [];
    if (nap.phoneMatch === false) notes.push('Phone mismatch detected between GBP and website (best-effort).');
    if (nap.addressMatch === false) notes.push('Address mismatch detected between GBP and website (best-effort).');
    notes.push(`Competitors ranked by rating × review count within ${Math.round(metersToMiles(radiusMeters) * 10) / 10} miles.`);

    const citationsUpsell = {
      price: 499,
      headline: 'Citations Cleanup + NAP Consistency ($499)',
      bullets: [
        'Fix NAP inconsistencies across major directories',
        'Remove duplicates and outdated listings',
        'Lock in long-term local ranking stability',
      ],
    };

    return {
      radiusMeters,
      radiusMiles: Math.round(metersToMiles(radiusMeters) * 10) / 10,
      competitorsFound: competitorCards.length,
      liteScore,
      proScore: youLiteLike.overallScore,
      proGrade: gradeFromScore(youLiteLike.overallScore),
      categories: youLiteLike.categories.map((c) => ({ key: c.key, label: c.label, score: c.score, max: c.max })),
      comparisonTable,
      competitors: competitorCards.sort((a, b) => b.score - a.score),
      actionPlan,
      ownerOnlyChecklist: youLiteLike.ownerOnlyChecklist,
      citationsUpsell,
      notes,
      generatedAt: new Date().toISOString(),
    };
  }
}

