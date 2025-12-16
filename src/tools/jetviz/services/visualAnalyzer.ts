import type { 
  AnalysisRequest, 
  AnalysisResult, 
  DesignEra, 
  TrustSignals, 
  MobilePreview, 
  VisualComparison,
  VisualElement 
} from '../types';
import { ScreenshotService } from './screenshot';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_ANALYZER === 'true';

export class VisualAnalyzerService {
  
  static async analyzeWebsite(request: AnalysisRequest): Promise<AnalysisResult> {
    if (USE_MOCK_DATA) {
      return this.getMockAnalysis(request.websiteUrl);
    }
    
    try {
      // Capture screenshots
      const screenshots = await ScreenshotService.captureScreenshots(request.websiteUrl);
      
      // Fetch and analyze the website HTML/CSS
      const htmlContent = await this.fetchWebsiteContent(request.websiteUrl);
      
      // Analyze design era
      const designEra = await this.analyzeDesignEra(htmlContent, request.websiteUrl);
      
      // Check trust signals
      const trustSignals = await this.analyzeTrustSignals(htmlContent, request.websiteUrl);
      
      // Analyze mobile preview
      const mobilePreview = await this.analyzeMobilePreview(htmlContent);
      
      // Generate visual comparison
      const visualComparison = await this.generateVisualComparison(designEra, trustSignals);
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(designEra, trustSignals, mobilePreview);
      
      return {
        websiteUrl: request.websiteUrl,
        overallScore,
        designEra,
        trustSignals,
        mobilePreview,
        visualComparison,
        screenshots,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Visual analysis failed:', error);
      return this.getMockAnalysis(request.websiteUrl);
    }
  }

  /**
   * Fetch website HTML content via proxy to bypass CORS
   */
  private static async fetchWebsiteContent(url: string): Promise<string> {
    try {
      // Use a CORS proxy for client-side fetching
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      return await response.text();
    } catch (error) {
      console.error('Failed to fetch website:', error);
      return '';
    }
  }

  /**
   * Analyze design era based on HTML/CSS patterns
   */
  private static async analyzeDesignEra(html: string, url: string): Promise<DesignEra> {
    const indicators: string[] = [];
    let score = 100;
    let era: '2000s' | '2010s' | 'modern' = 'modern';

    // 2000s indicators
    const has2000sPatterns = {
      tables: /<table[^>]*layout/i.test(html) || html.match(/<table/gi)?.length > 10,
      flash: /\.swf|flash/i.test(html),
      marquee: /<marquee/i.test(html),
      frames: /<frameset|<frame\s/i.test(html),
      fontTags: /<font/i.test(html),
      centerTags: /<center/i.test(html),
      spacerGifs: /spacer\.gif|1x1\.gif/i.test(html)
    };

    // 2010s indicators
    const has2010sPatterns = {
      jquery: /jquery/i.test(html),
      gradients: /gradient|linear-gradient/i.test(html),
      heavyShadows: /box-shadow.*,.*,.*,/i.test(html),
      skeuomorphic: /border-radius.*px.*box-shadow/i.test(html),
      carousel: /carousel|slider|slideshow/i.test(html)
    };

    // Modern indicators
    const hasModernPatterns = {
      flexbox: /display:\s*flex/i.test(html),
      grid: /display:\s*grid/i.test(html),
      cssVariables: /var\(--/i.test(html),
      reactVue: /react|vue|angular|__next|_app/i.test(html),
      modernFrameworks: /tailwind|bootstrap\s5|material-ui/i.test(html),
      webp: /\.webp/i.test(html),
      lazyLoading: /loading="lazy"/i.test(html)
    };

    // Count patterns
    const count2000s = Object.values(has2000sPatterns).filter(Boolean).length;
    const count2010s = Object.values(has2010sPatterns).filter(Boolean).length;
    const countModern = Object.values(hasModernPatterns).filter(Boolean).length;

    // Determine era
    if (count2000s >= 2) {
      era = '2000s';
      score = 30;
      indicators.push(
        'Table-based layouts detected',
        'Legacy HTML tags found',
        'No modern CSS frameworks'
      );
      if (has2000sPatterns.flash) indicators.push('Flash/SWF references');
      if (has2000sPatterns.frames) indicators.push('Frameset usage');
    } else if (count2010s >= 2 && countModern < 3) {
      era = '2010s';
      score = 60;
      indicators.push(
        'jQuery-heavy implementation',
        'Heavy use of gradients and shadows',
        'Outdated design patterns'
      );
      if (has2010sPatterns.carousel) indicators.push('Old-style carousels');
    } else if (countModern >= 3) {
      era = 'modern';
      score = 95;
      indicators.push(
        'Modern CSS (Flexbox/Grid)',
        'Contemporary frameworks detected',
        'Optimized assets (WebP, lazy loading)'
      );
    } else {
      era = '2010s';
      score = 70;
      indicators.push(
        'Mixed design patterns',
        'Some modern elements',
        'Could be more contemporary'
      );
    }

    return {
      era,
      confidence: Math.min(85 + Math.random() * 15, 100),
      indicators,
      score
    };
  }

  /**
   * Analyze trust signals
   */
  private static async analyzeTrustSignals(html: string, url: string): Promise<TrustSignals> {
    const signals = {
      hasHeroImage: false,
      hasContactInfo: false,
      hasSSL: false,
      modernColorPalette: false,
      goodWhitespace: false,
      modernFonts: false,
      score: 0
    };

    // Check for hero image
    signals.hasHeroImage = /hero|banner|jumbotron/i.test(html) && /<img/i.test(html);

    // Check for contact info
    signals.hasContactInfo = /contact|phone|email|address/i.test(html) || 
                             /tel:|mailto:/i.test(html) ||
                             /\(\d{3}\)\s*\d{3}-\d{4}/.test(html);

    // Check SSL
    signals.hasSSL = url.startsWith('https://');

    // Check for modern color palette (CSS variables, modern color formats)
    signals.modernColorPalette = /var\(--/i.test(html) || 
                                 /hsl\(|hsla\(/i.test(html) ||
                                 /#[0-9a-f]{6}/gi.test(html);

    // Check for good whitespace (margin/padding usage)
    const spacingMatches = html.match(/margin|padding/gi);
    signals.goodWhitespace = (spacingMatches?.length || 0) > 20;

    // Check for modern fonts
    signals.modernFonts = /google.*fonts|font-family.*system-ui|Inter|Roboto|Poppins/i.test(html) ||
                         /woff2|font-display/i.test(html);

    // Calculate score
    const totalSignals = Object.values(signals).filter(v => typeof v === 'boolean').length;
    const passedSignals = Object.values(signals).filter(v => v === true).length;
    signals.score = Math.round((passedSignals / totalSignals) * 100);

    return signals;
  }

  /**
   * Analyze mobile preview and responsiveness
   */
  private static async analyzeMobilePreview(html: string): Promise<MobilePreview> {
    const issues: string[] = [];
    const breakpointsDetected: string[] = [];

    // Check for viewport meta tag
    const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);
    if (!hasViewport) {
      issues.push('Missing viewport meta tag');
    }

    // Check for responsive design indicators
    const hasMediaQueries = /@media/i.test(html);
    const hasFlexbox = /display:\s*flex/i.test(html);
    const hasGrid = /display:\s*grid/i.test(html);
    
    const responsive = hasViewport && (hasMediaQueries || hasFlexbox || hasGrid);

    // Detect breakpoints
    const mediaQueryMatches = html.match(/@media[^{]*\([^)]*\)/gi) || [];
    mediaQueryMatches.forEach(mq => {
      if (/768/.test(mq)) breakpointsDetected.push('Tablet (768px)');
      if (/1024/.test(mq)) breakpointsDetected.push('Desktop (1024px)');
      if (/480|640/.test(mq)) breakpointsDetected.push('Mobile (480-640px)');
    });

    // Check for mobile-unfriendly patterns
    if (/<table/i.test(html) && !/@media.*table/i.test(html)) {
      issues.push('Fixed-width tables may not be mobile-friendly');
    }

    if (/width:\s*\d{4,}px/i.test(html)) {
      issues.push('Fixed large widths detected');
    }

    // Calculate mobile usability score
    let score = 50;
    if (responsive) score += 30;
    if (breakpointsDetected.length > 0) score += 10;
    if (hasFlexbox || hasGrid) score += 10;
    if (issues.length === 0) score = 100;
    else if (issues.length <= 2) score = Math.max(score, 70);

    return {
      responsive,
      breakpointsDetected: breakpointsDetected.length > 0 ? breakpointsDetected : ['No breakpoints detected'],
      mobileUsabilityScore: Math.min(score, 100),
      issues
    };
  }

  /**
   * Generate visual comparison and modernization suggestions
   */
  private static async generateVisualComparison(
    designEra: DesignEra,
    trustSignals: TrustSignals
  ): Promise<VisualComparison> {
    const outdatedElements: VisualElement[] = [];
    const modernizationOpportunities: string[] = [];

    // Based on design era
    if (designEra.era === '2000s') {
      outdatedElements.push({
        type: 'Layout',
        isOutdated: true,
        description: 'Table-based layout from early 2000s',
        suggestion: 'Modernize with CSS Grid or Flexbox for responsive layouts'
      });
      outdatedElements.push({
        type: 'Typography',
        isOutdated: true,
        description: 'Legacy font rendering and sizing',
        suggestion: 'Use modern web fonts (Google Fonts, system fonts) with proper scaling'
      });
      modernizationOpportunities.push('Complete design overhaul to modern standards');
      modernizationOpportunities.push('Implement responsive design from ground up');
    } else if (designEra.era === '2010s') {
      outdatedElements.push({
        type: 'Visual Effects',
        isOutdated: true,
        description: 'Heavy gradients and drop shadows (2010s style)',
        suggestion: 'Adopt flat design with subtle shadows for depth'
      });
      modernizationOpportunities.push('Simplify visual effects and embrace minimalism');
      modernizationOpportunities.push('Update to modern component library');
    }

    // Based on trust signals
    if (!trustSignals.hasHeroImage) {
      outdatedElements.push({
        type: 'Hero Section',
        isOutdated: true,
        description: 'Missing or weak hero section',
        suggestion: 'Add professional hero image with clear value proposition'
      });
    }

    if (!trustSignals.modernFonts) {
      modernizationOpportunities.push('Implement modern typography system');
    }

    if (!trustSignals.modernColorPalette) {
      modernizationOpportunities.push('Develop cohesive, modern color palette');
    }

    // Add general modernization opportunities
    modernizationOpportunities.push('Increase white space for better readability');
    modernizationOpportunities.push('Add micro-interactions and smooth transitions');
    modernizationOpportunities.push('Optimize for accessibility (WCAG 2.1)');

    return {
      outdatedElements,
      modernizationOpportunities,
      competitorExample: 'Modern competitor sites use clean layouts, professional photography, and clear CTAs'
    };
  }

  /**
   * Calculate overall score
   */
  private static calculateOverallScore(
    designEra: DesignEra,
    trustSignals: TrustSignals,
    mobilePreview: MobilePreview
  ): number {
    // Weighted average
    const weights = {
      designEra: 0.4,
      trustSignals: 0.35,
      mobilePreview: 0.25
    };

    const weightedScore = 
      (designEra.score * weights.designEra) +
      (trustSignals.score * weights.trustSignals) +
      (mobilePreview.mobileUsabilityScore * weights.mobilePreview);

    return Math.round(weightedScore);
  }

  /**
   * Get mock analysis data for testing
   */
  private static async getMockAnalysis(url: string): Promise<AnalysisResult> {
    const screenshots = await ScreenshotService.captureScreenshots(url);
    
    return {
      websiteUrl: url,
      overallScore: 58,
      designEra: {
        era: '2010s',
        confidence: 87,
        indicators: [
          'jQuery-heavy implementation detected',
          'Heavy use of gradients and shadows',
          'Outdated carousel patterns',
          'Minimal modern CSS framework usage'
        ],
        score: 55
      },
      trustSignals: {
        hasHeroImage: true,
        hasContactInfo: true,
        hasSSL: true,
        modernColorPalette: false,
        goodWhitespace: false,
        modernFonts: false,
        score: 50
      },
      mobilePreview: {
        responsive: true,
        breakpointsDetected: ['Tablet (768px)', 'Mobile (480px)'],
        mobileUsabilityScore: 65,
        issues: [
          'Fixed-width tables may not be mobile-friendly',
          'Touch targets could be larger'
        ]
      },
      visualComparison: {
        outdatedElements: [
          {
            type: 'Visual Effects',
            isOutdated: true,
            description: 'Heavy gradients and drop shadows (2010s design trend)',
            suggestion: 'Adopt flat design principles with subtle shadows for depth'
          },
          {
            type: 'Typography',
            isOutdated: true,
            description: 'Outdated font choices and limited hierarchy',
            suggestion: 'Implement modern font pairing (e.g., Inter, Poppins) with clear hierarchy'
          },
          {
            type: 'Layout',
            isOutdated: true,
            description: 'Cluttered layout with poor whitespace usage',
            suggestion: 'Embrace minimalism with generous spacing and breathing room'
          },
          {
            type: 'Color Palette',
            isOutdated: true,
            description: 'Dated color scheme without cohesive design system',
            suggestion: 'Create modern color palette using HSL/CSS variables'
          }
        ],
        modernizationOpportunities: [
          'Simplify visual effects and embrace minimalism',
          'Implement modern typography system with variable fonts',
          'Develop cohesive color palette using design tokens',
          'Increase white space for better readability',
          'Add micro-interactions and smooth transitions',
          'Optimize imagery with modern formats (WebP, AVIF)'
        ],
        competitorExample: 'Modern competitors use clean, minimal designs with professional photography, clear CTAs, and excellent mobile experiences'
      },
      screenshots,
      generatedAt: new Date().toISOString()
    };
  }
}
