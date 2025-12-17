import type {
  JetBizAnalysisRequest,
  JetBizAnalysisResult,
  JetBizCategoryScore,
  JetBizCompetitorBenchmarks,
  JetBizCompetitorSummary,
  JetBizPlaceDetailsSummary,
  JetBizPlacePrediction,
  JetBizRecommendation,
  JetBizRecommendationPriority,
} from './google-business-types';

// Note: this repo does not include Google Maps TS types. Keep runtime-only typing.
type Places = any;

const DAILY_LIMIT_DEFAULT = 250; // conservative client-side cap to prevent runaway usage
const USAGE_STORAGE_KEY = 'jetbiz_places_usage_v1';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round = (n: number) => Math.round(n);

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function readUsage(dailyLimit: number) {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const day = todayKey();
    if (!parsed || parsed.day !== day) return { day, count: 0, dailyLimit };
    return { day, count: Number(parsed.count) || 0, dailyLimit };
  } catch {
    return { day: todayKey(), count: 0, dailyLimit };
  }
}

function bumpUsage(dailyLimit: number) {
  const usage = readUsage(dailyLimit);
  const next = { ...usage, count: usage.count + 1 };
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify({ day: next.day, count: next.count }));
  } catch {
    // ignore
  }
  if (next.count > dailyLimit) {
    const err = new Error('API limit reached');
    (err as any).code = 'RATE_LIMIT';
    throw err;
  }
  return next;
}

function median(values: number[]) {
  const nums = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 0) return (nums[mid - 1] + nums[mid]) / 2;
  return nums[mid];
}

function gradeFromScore(score: number): JetBizAnalysisResult['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

let googlePlacesLoadPromise: Promise<void> | null = null;

async function loadGooglePlaces(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if ((window as any).google?.maps?.places) return;
  if (googlePlacesLoadPromise) return googlePlacesLoadPromise;

  googlePlacesLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-jetbiz-google-places="1"]');
    if (existing && (window as any).google?.maps?.places) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.dataset.jetbizGooglePlaces = '1';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Places library'));
    document.head.appendChild(script);
  });

  return googlePlacesLoadPromise;
}

function extractPlaceIdFromGoogleMapsUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const placeId = u.searchParams.get('query_place_id') || u.searchParams.get('place_id');
    if (placeId && placeId.startsWith('Ch')) return placeId;
    return null;
  } catch {
    return null;
  }
}

function ensureApiKey(): string {
  const key =
    (import.meta as any).env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
    (import.meta as any).env.VITE_GOOGLE_PLACES_API_KEY;
  if (!key) {
    const err = new Error('Google Places API key is missing');
    (err as any).code = 'MISSING_API_KEY';
    throw err;
  }
  return String(key);
}

function places(): Places {
  return (window as any).google?.maps?.places as Places;
}

function makeAutocompleteService(): any {
  return new (places().AutocompleteService as any)();
}

function makePlacesService(): any {
  const div = document.createElement('div');
  return new (places().PlacesService as any)(div);
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

function wrapAutocomplete(service: any, request: any) {
  return new Promise<any[]>((resolve, reject) => {
    service.getPlacePredictions(request, (predictions, status) => {
      if (status !== (places().PlacesServiceStatus as any).OK || !predictions) {
        reject(new Error('Business not found'));
        return;
      }
      resolve(predictions);
    });
  });
}

function wrapDetails(service: any, request: any) {
  return new Promise<any>((resolve, reject) => {
    service.getDetails(request, (details, status) => {
      if (status !== (places().PlacesServiceStatus as any).OK || !details) {
        reject(new Error('Unable to fetch business details'));
        return;
      }
      resolve(details);
    });
  });
}

function wrapNearby(service: any, request: any) {
  return new Promise<any[]>((resolve, reject) => {
    service.nearbySearch(request, (results, status) => {
      if (status !== (places().PlacesServiceStatus as any).OK || !results) {
        reject(new Error('Unable to fetch competitors'));
        return;
      }
      resolve(results);
    });
  });
}

function scoreProfileCompleteness(place: JetBizPlaceDetailsSummary, industry?: string) {
  let score = 0;
  const notes: string[] = [];

  // 10: Business hours complete (weekdays + weekends)
  const wd = place.openingHours?.weekdayText || [];
  if (wd.length >= 7) score += 10;
  else if (wd.length >= 5) score += 6;
  else if (wd.length > 0) score += 3;

  // 10: Phone present (verification not available client-side)
  if (place.formattedPhoneNumber) score += 10;

  // 10: Website link
  if (place.website) score += 10;

  // 15: Description (Places provides editorial_summary when available)
  const desc = place.editorialSummary || '';
  const keyword = (industry || '').trim().toLowerCase();
  if (desc.length >= 200) score += keyword && desc.toLowerCase().includes(keyword) ? 15 : 12;
  else if (desc.length >= 80) score += 6;
  else if (desc.length > 0) score += 2;
  else notes.push('GBP description is not available via Places for some businesses; verify description in your profile.');

  // 10: Attributes (limited fields exposed via Places; treat presence of categories as proxy)
  const typeCount = Array.isArray(place.types) ? place.types.length : 0;
  if (typeCount >= 5) score += 10;
  else if (typeCount >= 3) score += 6;
  else if (typeCount > 0) score += 3;

  // 20: Photos
  const photoCount = place.photos.length;
  score += clamp((photoCount / 20) * 20, 0, 20);

  // 15: Recent activity (Places cannot fetch Posts; use recent reviews as a proxy signal)
  const now = Date.now() / 1000;
  const recentReview = place.reviews.some((r) => (r.time || 0) > now - 30 * 24 * 3600);
  score += recentReview ? 15 : 0;
  if (!place.reviews.length) notes.push('Places only returns a subset of reviews; “recent activity” is estimated from available reviews.');

  // 10: Q&A activity is not available via Places API
  notes.push('GBP Q&A and GBP Posts are not available via the client-side Places API; JetBiz recommends best practices but cannot verify them automatically.');
  score += 0;

  return { score: round(clamp(score, 0, 100)), notes };
}

function scoreVisualAssets(place: JetBizPlaceDetailsSummary, benchmarks: JetBizCompetitorBenchmarks) {
  // Places API does not provide photo timestamps or categories (exterior/interior/video).
  const notes: string[] = [
    'Photo recency/variety/video presence are not exposed via Places; JetBiz scores these as “unknown” and focuses on photo volume vs competitors.',
  ];

  const myCount = place.photos.length;
  const medianCount = benchmarks.medians.photoCount || 0;
  const ratio = medianCount > 0 ? myCount / medianCount : myCount > 0 ? 1 : 0;
  // 0..100 based on how you compare to competitor median.
  const score = round(clamp(ratio * 85 + (myCount >= 20 ? 15 : 0), 0, 100));
  return { score, notes };
}

function scoreReviewPerformance(place: JetBizPlaceDetailsSummary, benchmarks: JetBizCompetitorBenchmarks) {
  const notes: string[] = [
    'Review response rate/speed are not exposed via Places; JetBiz recommends responding inside GBP, but cannot verify responses automatically.',
  ];

  const rating = place.rating || 0;
  const reviewCount = place.userRatingsTotal || 0;
  const medianReviews = benchmarks.medians.userRatingsTotal || 0;
  const reviewRatio = medianReviews > 0 ? reviewCount / medianReviews : reviewCount > 0 ? 1 : 0;

  const ratingScore = clamp((rating / 5) * 40, 0, 40);
  const volumeScore = clamp(reviewRatio * 40, 0, 40);

  const now = Date.now() / 1000;
  const recent = place.reviews.filter((r) => (r.time || 0) > now - 30 * 24 * 3600).length;
  const recentScore = clamp((recent / 2) * 20, 0, 20);

  const score = round(clamp(ratingScore + volumeScore + recentScore, 0, 100));
  return { score, notes };
}

function scoreLocalSeo(place: JetBizPlaceDetailsSummary, industry?: string) {
  const notes: string[] = [
    'Service/product listings and GBP Q&A usage are not exposed via Places; JetBiz recommends these but cannot verify automatically.',
  ];

  const types = place.types || [];
  const primary = types.length > 0 ? 25 : 0;
  const secondary = clamp(((types.length - 1) / 3) * 25, 0, 25);

  const desc = (place.editorialSummary || '').toLowerCase();
  const keyword = (industry || '').trim().toLowerCase();
  const keywordScore = keyword
    ? desc.includes(keyword)
      ? 25
      : desc.length >= 200
        ? 12
        : 0
    : desc.length >= 200
      ? 18
      : desc.length >= 80
        ? 10
        : 0;

  const basicsScore =
    (place.formattedPhoneNumber ? 10 : 0) +
    (place.website ? 10 : 0) +
    (place.formattedAddress ? 5 : 0);

  const score = round(clamp(primary + secondary + keywordScore + basicsScore, 0, 100));
  return { score, notes };
}

function scoreCompetitorGap(place: JetBizPlaceDetailsSummary, benchmarks: JetBizCompetitorBenchmarks) {
  // Convert relative gaps into a 0-100 score, where "above median" trends toward 100.
  const gapReviews = benchmarks.gaps.userRatingsTotal;
  const gapPhotos = benchmarks.gaps.photoCount;
  const gapRating = benchmarks.gaps.rating;

  const score =
    50 +
    clamp(gapRating * 25, -25, 25) +
    clamp((gapReviews / Math.max(1, benchmarks.medians.userRatingsTotal)) * 25, -25, 25) +
    clamp((gapPhotos / Math.max(1, benchmarks.medians.photoCount)) * 25, -25, 25);

  return { score: round(clamp(score, 0, 100)), notes: [] as string[] };
}

function buildRecommendations(
  place: JetBizPlaceDetailsSummary,
  benchmarks: JetBizCompetitorBenchmarks,
  industry?: string
): JetBizRecommendation[] {
  const recs: JetBizRecommendation[] = [];
  const add = (priority: JetBizRecommendationPriority, title: string, why: string, impact: string, steps: string[]) => {
    recs.push({
      id: `${priority}:${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      priority,
      title,
      whyItMatters: why,
      expectedImpact: impact,
      steps,
    });
  };

  if (!place.openingHours?.weekdayText?.length) {
    add(
      'critical',
      'Add complete business hours',
      'Missing hours reduces trust and can prevent Google from showing you for “open now” searches.',
      'Higher map pack visibility and more calls from ready-to-buy customers.',
      [
        'Open your Google Business Profile.',
        'Go to “Edit profile” → “Hours”.',
        'Set hours for every day you operate (including weekends if applicable).',
        'Double-check holiday hours.',
      ]
    );
  }

  if (!place.formattedPhoneNumber) {
    add(
      'critical',
      'Add a primary phone number',
      'A missing phone number reduces conversions and can signal an incomplete profile.',
      'More calls and stronger local trust signals.',
      [
        'Open your Google Business Profile.',
        'Go to “Edit profile” → “Contact”.',
        'Add your main tracking-safe phone number.',
        'Confirm it matches the number on your website (NAP consistency).',
      ]
    );
  }

  if (!place.website) {
    add(
      'critical',
      'Add your website link',
      'Without a website link, you lose high-intent traffic and Google has fewer signals to understand your services.',
      'More website visits + stronger relevance for service keywords.',
      [
        'Open your Google Business Profile.',
        'Go to “Edit profile” → “Website”.',
        'Add your primary website URL.',
        'Ensure the website page clearly matches your GBP category/services.',
      ]
    );
  }

  const photoGap = benchmarks.gaps.photoCount;
  if (place.photos.length < 10 || photoGap < 0) {
    add(
      place.photos.length < 5 ? 'critical' : 'important',
      'Increase your photo count (and refresh regularly)',
      'Profiles with strong photo coverage win more clicks and calls—especially compared to nearby competitors.',
      'More map pack clicks and better conversion from “compare” shoppers.',
      [
        'Upload at least 20 high-quality photos (exterior, interior, team, work, finished results).',
        'Add 3–5 new photos every month.',
        'Use consistent branding and real project photos (avoid stock).',
      ]
    );
  }

  const reviewCount = place.userRatingsTotal || 0;
  const medianReviews = benchmarks.medians.userRatingsTotal || 0;
  if (medianReviews > 0 && reviewCount < medianReviews) {
    add(
      reviewCount < Math.max(5, medianReviews / 2) ? 'critical' : 'important',
      'Close the review gap vs competitors',
      'Review volume is a major ranking and conversion factor in local search.',
      'Improved map rank + higher conversion rate from searchers comparing options.',
      [
        'Create a simple review request link and text/email template.',
        'Ask every satisfied customer within 24–48 hours of completing work.',
        'Aim for a steady cadence (e.g., 2–5 new reviews/month).',
      ]
    );
  }

  const rating = place.rating || 0;
  if (rating > 0 && rating < 4.3) {
    add(
      'important',
      'Improve your average rating',
      'A sub-4.3 rating can reduce clicks and calls—especially when competitors are stronger.',
      'Higher conversion rate from the map pack and better trust.',
      [
        'Identify the recurring complaint theme in recent reviews.',
        'Fix the operational issue first.',
        'Follow up with happy customers for fresh reviews to balance older negatives.',
      ]
    );
  }

  const types = place.types || [];
  if (types.length < 4) {
    add(
      'suggested',
      'Add secondary categories (3+ recommended)',
      'Secondary categories help you show up for more searches without diluting relevance.',
      'More impressions for service-specific keywords.',
      [
        'Open your Google Business Profile.',
        'Go to “Edit profile” → “Business information” → “Categories”.',
        'Keep the best primary category; add 2–4 relevant secondary categories.',
      ]
    );
  }

  const desc = place.editorialSummary || '';
  const keyword = (industry || '').trim();
  if (!desc || desc.length < 200) {
    add(
      'suggested',
      'Strengthen your business description',
      'A clear, keyword-aligned description improves relevance and conversion.',
      'More qualified clicks from searchers looking for specific services.',
      [
        'Write a 200–400 character description explaining who you serve and what you do best.',
        keyword ? `Naturally include “${keyword}” and related services you offer.` : 'Include your top services and local area you serve.',
        'Avoid salesy fluff—make it specific and credible.',
      ]
    );
  }

  // Competitive, direct CTA aligned to JetSuite tone
  add(
    'important',
    'Book a quick consult to close the local gap',
    'Your competitors are outranking you because Google favors stronger profiles with better signals and consistency.',
    'A prioritized action plan tailored to your exact profile + local competitors.',
    [
      'Share your GBP link and your top service area.',
      'We’ll review your categories, photos, reviews, and local positioning.',
      'You’ll get a focused plan to beat nearby competitors.',
      'Book here: /contact',
    ]
  );

  const priorityRank: Record<JetBizRecommendationPriority, number> = { critical: 0, important: 1, suggested: 2 };
  return recs.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}

export class GoogleBusinessAnalyzer {
  static getApiUsage(dailyLimit = DAILY_LIMIT_DEFAULT) {
    const usage = readUsage(dailyLimit);
    return { usedToday: usage.count, dailyLimit: usage.dailyLimit };
  }

  static async getPredictions(request: JetBizAnalysisRequest, dailyLimit = DAILY_LIMIT_DEFAULT): Promise<JetBizPlacePrediction[]> {
    const apiKey = ensureApiKey();
    await loadGooglePlaces(apiKey);
    bumpUsage(dailyLimit);

    const input = `${(request.businessName || '').trim()} ${(request.location || '').trim()}`.trim();
    if (!input) throw new Error('Enter a business name and location');

    const service = makeAutocompleteService();
    const preds = await wrapAutocomplete(service, { input });

    return preds.slice(0, 6).map((p) => ({
      description: p.description,
      placeId: (p as any).place_id || (p as any).placeId,
    }));
  }

  static async analyze(
    request: JetBizAnalysisRequest & { placeId?: string },
    dailyLimit = DAILY_LIMIT_DEFAULT
  ): Promise<JetBizAnalysisResult> {
    const apiKey = ensureApiKey();
    await loadGooglePlaces(apiKey);

    const placeIdFromUrl = request.googleMapsUrl ? extractPlaceIdFromGoogleMapsUrl(request.googleMapsUrl) : null;
    const placeId = request.placeId || placeIdFromUrl;
    if (!placeId) {
      const err = new Error('Business not found');
      (err as any).code = request.googleMapsUrl ? 'INVALID_URL' : 'NOT_FOUND';
      throw err;
    }

    // Details: target business
    bumpUsage(dailyLimit);
    const ps = makePlacesService();
    const details = await wrapDetails(ps, {
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
    const place = toSummary(details);

    if (!place.location) {
      const err = new Error('Unable to locate business');
      (err as any).code = 'MISSING_LOCATION';
      throw err;
    }

    // Nearby competitors
    bumpUsage(dailyLimit);
    const { lat, lng } = place.location;
    const location = new (window as any).google.maps.LatLng(lat, lng);

    // Use first meaningful type as a category hint
    const typeHint = (place.types || []).find((t) => !['point_of_interest', 'establishment'].includes(t));
    const nearby = await wrapNearby(ps, {
      location,
      radius: 5500,
      type: typeHint,
      keyword: request.industry || undefined,
    });

    const competitorBasics = nearby
      .filter((r) => (r as any).place_id && (r as any).place_id !== place.placeId)
      .slice(0, 5);

    const competitors: JetBizCompetitorSummary[] = [];
    for (const c of competitorBasics) {
      try {
        bumpUsage(dailyLimit);
        const cd = await wrapDetails(ps, {
          placeId: (c as any).place_id,
          fields: [
            'place_id',
            'name',
            'rating',
            'user_ratings_total',
            'photos',
            'opening_hours',
            'formatted_phone_number',
            'website',
          ],
        });
        const cs = toSummary(cd);
        competitors.push({
          placeId: cs.placeId,
          name: cs.name,
          rating: cs.rating,
          userRatingsTotal: cs.userRatingsTotal,
          photoCount: cs.photos.length,
          hasWebsite: !!cs.website,
          hasPhone: !!cs.formattedPhoneNumber,
          hasHours: !!cs.openingHours?.weekdayText?.length,
        });
      } catch {
        // Skip competitor if details fail
      }
    }

    const allForRank = [
      {
        placeId: place.placeId,
        rating: place.rating || 0,
        userRatingsTotal: place.userRatingsTotal || 0,
        photoCount: place.photos.length,
      },
      ...competitors.map((c) => ({
        placeId: c.placeId,
        rating: c.rating || 0,
        userRatingsTotal: c.userRatingsTotal || 0,
        photoCount: c.photoCount,
      })),
    ];

    const medRating = median(allForRank.map((x) => x.rating));
    const medReviews = median(allForRank.map((x) => x.userRatingsTotal));
    const medPhotos = median(allForRank.map((x) => x.photoCount));

    const rankOf = (metric: 'rating' | 'userRatingsTotal' | 'photoCount') => {
      const sorted = [...allForRank].sort((a, b) => (b as any)[metric] - (a as any)[metric]);
      const idx = sorted.findIndex((x) => x.placeId === place.placeId);
      return idx === -1 ? sorted.length : idx + 1;
    };

    const benchmarks: JetBizCompetitorBenchmarks = {
      competitorCount: competitors.length,
      medians: {
        rating: medRating,
        userRatingsTotal: medReviews,
        photoCount: medPhotos,
      },
      rank: {
        rating: rankOf('rating'),
        userRatingsTotal: rankOf('userRatingsTotal'),
        photoCount: rankOf('photoCount'),
      },
      gaps: {
        rating: (place.rating || 0) - medRating,
        userRatingsTotal: (place.userRatingsTotal || 0) - medReviews,
        photoCount: place.photos.length - medPhotos,
      },
    };

    const notes: string[] = [];
    const pc = scoreProfileCompleteness(place, request.industry);
    const va = scoreVisualAssets(place, benchmarks);
    const rp = scoreReviewPerformance(place, benchmarks);
    const ls = scoreLocalSeo(place, request.industry);
    const cg = scoreCompetitorGap(place, benchmarks);
    notes.push(...pc.notes, ...va.notes, ...rp.notes, ...ls.notes, ...cg.notes);

    const categories: JetBizCategoryScore[] = [
      { category: 'profileCompleteness', score: pc.score, label: 'Profile Completeness' },
      { category: 'visualAssets', score: va.score, label: 'Visual Assets' },
      { category: 'reviewPerformance', score: rp.score, label: 'Review Performance' },
      { category: 'localSeo', score: ls.score, label: 'Local SEO' },
      { category: 'competitorGap', score: cg.score, label: 'Competitor Gap' },
    ];

    const overallScore = round(median(categories.map((c) => c.score))); // stable against outliers
    const grade = gradeFromScore(overallScore);

    const recommendations = buildRecommendations(place, benchmarks, request.industry);
    const usage = readUsage(dailyLimit);

    return {
      place,
      competitors,
      benchmarks,
      overallScore,
      grade,
      categories,
      recommendations,
      generatedAt: new Date().toISOString(),
      notes: Array.from(new Set(notes)).slice(0, 8),
      apiUsage: { usedToday: usage.count, dailyLimit: usage.dailyLimit },
    };
  }
}

