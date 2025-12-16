import type { AnalysisRequest, AnalysisResult, CoreWebVitals, MobileScore, SEOStructure, LocalRelevance, KeywordGap } from '../types';

// CORS proxy for fetching HTML content
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Google PageSpeed Insights API (free, no key required for basic use)
const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export class AnalyzerService {
  
  static async analyzeWebsite(request: AnalysisRequest): Promise<AnalysisResult> {
    try {
      console.log('Starting analysis for:', request.websiteUrl);
      
      // Normalize URL
      const url = this.normalizeUrl(request.websiteUrl);
      
      // Run all analyses in parallel for better performance
      const [pageSpeedData, htmlContent] = await Promise.all([
        this.fetchPageSpeedData(url),
        this.fetchHtmlContent(url)
      ]);
      
      // Process all analysis components
      const coreWebVitals = this.extractCoreWebVitals(pageSpeedData);
      const mobileScore = this.analyzeMobileResponsiveness(pageSpeedData, htmlContent);
      const seoStructure = this.analyzeSEO(htmlContent, url);
      const localRelevance = this.analyzeLocalRelevance(htmlContent, request);
      const keywordGap = this.analyzeKeywordGap(htmlContent, request);
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore({
        coreWebVitals,
        mobileScore,
        seoStructure,
        localRelevance,
        keywordGap
      });
      
      return {
        websiteUrl: url,
        overallScore,
        coreWebVitals,
        mobileScore,
        seoStructure,
        localRelevance,
        keywordGap,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Analysis failed:', error);
      throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static normalizeUrl(url: string): string {
    // Add https:// if no protocol specified
    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }
    // Remove trailing slash
    return url.replace(/\/$/, '');
  }

  private static async fetchPageSpeedData(url: string): Promise<any> {
    try {
      // Fetch both mobile and desktop data
      const mobileUrl = `${PAGESPEED_API}?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`;
      
      const response = await fetch(mobileUrl);
      
      if (!response.ok) {
        console.warn('PageSpeed API error:', response.status);
        // Return null to allow graceful degradation
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.warn('PageSpeed fetch failed:', error);
      return null;
    }
  }

  private static async fetchHtmlContent(url: string): Promise<string> {
    try {
      const response = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
      
      if (!response.ok) {
        console.warn('HTML fetch failed:', response.status);
        return '';
      }
      
      return await response.text();
    } catch (error) {
      console.warn('HTML fetch error:', error);
      return '';
    }
  }

  private static extractCoreWebVitals(pageSpeedData: any): CoreWebVitals {
    if (!pageSpeedData || !pageSpeedData.lighthouseResult) {
      // Return default values if PageSpeed data unavailable
      return {
        lcp: 0,
        fid: 0,
        cls: 0,
        score: 0
      };
    }

    const metrics = pageSpeedData.lighthouseResult.audits;
    
    // Extract Core Web Vitals
    const lcp = metrics['largest-contentful-paint']?.numericValue 
      ? Math.round(metrics['largest-contentful-paint'].numericValue / 1000 * 10) / 10 
      : 0;
    
    const fid = metrics['total-blocking-time']?.numericValue 
      ? Math.round(metrics['total-blocking-time'].numericValue) 
      : 0;
    
    const cls = metrics['cumulative-layout-shift']?.numericValue 
      ? Math.round(metrics['cumulative-layout-shift'].numericValue * 100) / 100 
      : 0;

    // Calculate score based on thresholds
    let score = 0;
    let checks = 0;
    
    if (lcp > 0) {
      checks++;
      if (lcp <= 2.5) score += 100;
      else if (lcp <= 4.0) score += 50;
    }
    
    if (fid >= 0) {
      checks++;
      if (fid <= 100) score += 100;
      else if (fid <= 300) score += 50;
    }
    
    if (cls >= 0) {
      checks++;
      if (cls <= 0.1) score += 100;
      else if (cls <= 0.25) score += 50;
    }

    const finalScore = checks > 0 ? Math.round(score / checks) : 0;

    return { lcp, fid, cls, score: finalScore };
  }

  private static analyzeMobileResponsiveness(pageSpeedData: any, html: string): MobileScore {
    let touchTargets = false;
    let viewportScaling = false;
    let textReadability = false;

    // Check PageSpeed data for mobile usability
    if (pageSpeedData?.lighthouseResult?.audits) {
      const audits = pageSpeedData.lighthouseResult.audits;
      
      touchTargets = audits['tap-targets']?.score === 1 || audits['tap-targets']?.score > 0.8;
      textReadability = audits['font-size']?.score === 1 || audits['font-size']?.score > 0.8;
    }

    // Check HTML for viewport meta tag
    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const viewportMeta = doc.querySelector('meta[name="viewport"]');
      viewportScaling = viewportMeta !== null && 
        viewportMeta.getAttribute('content')?.includes('width=device-width') === true;
    }

    // Calculate score
    let score = 0;
    if (touchTargets) score += 33;
    if (viewportScaling) score += 34;
    if (textReadability) score += 33;

    return {
      touchTargets,
      viewportScaling,
      textReadability,
      score
    };
  }

  private static analyzeSEO(html: string, url: string): SEOStructure {
    if (!html) {
      return {
        hasH1: false,
        metaDescription: false,
        titleTag: false,
        schemaMarkup: false,
        altTags: 0,
        score: 0
      };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Check for H1 tag
    const hasH1 = doc.querySelector('h1') !== null;

    // Check for meta description
    const metaDesc = doc.querySelector('meta[name="description"]');
    const metaDescription = metaDesc !== null && 
      (metaDesc.getAttribute('content')?.length || 0) > 50;

    // Check for title tag
    const titleEl = doc.querySelector('title');
    const titleTag = titleEl !== null && 
      (titleEl.textContent?.length || 0) > 10;

    // Check for schema markup
    const schemaMarkup = doc.querySelector('script[type="application/ld+json"]') !== null ||
      doc.querySelector('[itemtype]') !== null;

    // Count images with alt tags
    const images = doc.querySelectorAll('img');
    const imagesWithAlt = Array.from(images).filter(img => 
      img.hasAttribute('alt') && (img.getAttribute('alt')?.length || 0) > 0
    );
    const altTags = imagesWithAlt.length;

    // Calculate score
    let score = 0;
    if (hasH1) score += 20;
    if (metaDescription) score += 25;
    if (titleTag) score += 25;
    if (schemaMarkup) score += 20;
    if (images.length > 0) {
      const altPercentage = (altTags / images.length) * 10;
      score += Math.min(altPercentage, 10);
    }

    return {
      hasH1,
      metaDescription,
      titleTag,
      schemaMarkup,
      altTags,
      score: Math.round(score)
    };
  }

  private static analyzeLocalRelevance(html: string, request: AnalysisRequest): LocalRelevance {
    if (!html) {
      return {
        napConsistency: false,
        googleMyBusiness: false,
        localKeywords: 0,
        score: 0
      };
    }

    const lowerHtml = html.toLowerCase();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const bodyText = doc.body?.textContent?.toLowerCase() || '';

    // Check for NAP (Name, Address, Phone) elements
    const hasPhone = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(bodyText);
    const hasAddress = /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl)/i.test(bodyText);
    const napConsistency = hasPhone && hasAddress;

    // Check for Google My Business/Maps integration
    const googleMyBusiness = lowerHtml.includes('google.com/maps') || 
      lowerHtml.includes('gstatic.com/mapfiles') ||
      lowerHtml.includes('maps.googleapis.com');

    // Count local keywords
    const localKeywordPatterns = [
      /near me/g,
      /local/g,
      /in (my )?area/g,
      /\w+ (city|town|county)/g,
      /(my|your|our) (city|town|area|neighborhood)/g
    ];

    let localKeywords = 0;
    for (const pattern of localKeywordPatterns) {
      const matches = bodyText.match(pattern);
      if (matches) localKeywords += matches.length;
    }

    // Limit to reasonable number
    localKeywords = Math.min(localKeywords, 20);

    // Calculate score
    let score = 0;
    if (napConsistency) score += 40;
    if (googleMyBusiness) score += 35;
    score += Math.min(localKeywords * 1.25, 25);

    return {
      napConsistency,
      googleMyBusiness,
      localKeywords,
      score: Math.round(score)
    };
  }

  private static analyzeKeywordGap(html: string, request: AnalysisRequest): KeywordGap {
    if (!html) {
      return {
        competitorKeywords: [],
        missingKeywords: [],
        opportunityScore: 0
      };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const bodyText = doc.body?.textContent?.toLowerCase() || '';

    // Industry-specific keywords to check
    const industryKeywordMap: Record<string, string[]> = {
      plumbing: ['emergency', '24/7', 'licensed', 'insured', 'repair', 'installation', 'drain cleaning', 'water heater'],
      restaurant: ['menu', 'reservations', 'delivery', 'takeout', 'hours', 'catering', 'reviews', 'specials'],
      'real estate': ['listings', 'buy', 'sell', 'rent', 'agent', 'broker', 'mortgage', 'property'],
      dental: ['appointment', 'emergency', 'insurance', 'cleaning', 'whitening', 'family', 'cosmetic'],
      hvac: ['air conditioning', 'heating', 'repair', 'installation', 'maintenance', 'emergency', '24/7', 'certified'],
      legal: ['consultation', 'attorney', 'lawyer', 'free', 'experienced', 'case', 'defense', 'settlement'],
      automotive: ['repair', 'service', 'oil change', 'brake', 'tire', 'diagnostic', 'certified', 'warranty']
    };

    // Determine industry
    const industry = request.industry?.toLowerCase() || 'general';
    let relevantKeywords: string[] = [];

    // Try to match industry
    for (const [key, keywords] of Object.entries(industryKeywordMap)) {
      if (industry.includes(key) || key.includes(industry)) {
        relevantKeywords = keywords;
        break;
      }
    }

    // If no match, use general business keywords
    if (relevantKeywords.length === 0) {
      relevantKeywords = [
        'contact', 'about', 'services', 'testimonials', 'reviews',
        'experience', 'professional', 'certified', 'guaranteed'
      ];
    }

    // Check which keywords are missing
    const missingKeywords = relevantKeywords.filter(keyword => 
      !bodyText.includes(keyword)
    );

    const foundKeywords = relevantKeywords.filter(keyword => 
      bodyText.includes(keyword)
    );

    // Calculate opportunity score (inverse of coverage)
    const coverage = relevantKeywords.length > 0 
      ? (foundKeywords.length / relevantKeywords.length) * 100 
      : 100;
    
    const opportunityScore = Math.round(coverage);

    return {
      competitorKeywords: relevantKeywords,
      missingKeywords: missingKeywords.slice(0, 8), // Limit to top 8
      opportunityScore
    };
  }

  private static calculateOverallScore(components: {
    coreWebVitals: CoreWebVitals;
    mobileScore: MobileScore;
    seoStructure: SEOStructure;
    localRelevance: LocalRelevance;
    keywordGap: KeywordGap;
  }): number {
    // Weighted average of all components
    const weights = {
      coreWebVitals: 0.25,
      mobileScore: 0.20,
      seoStructure: 0.25,
      localRelevance: 0.15,
      keywordGap: 0.15
    };

    const score = 
      components.coreWebVitals.score * weights.coreWebVitals +
      components.mobileScore.score * weights.mobileScore +
      components.seoStructure.score * weights.seoStructure +
      components.localRelevance.score * weights.localRelevance +
      components.keywordGap.opportunityScore * weights.keywordGap;

    return Math.round(score);
  }
}
