export class PageSpeedService {
  private static API_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

  static async analyze(url: string, apiKey?: string) {
    try {
      // Clean URL
      let targetUrl = url;
      if (!targetUrl.startsWith('http')) {
        targetUrl = `https://${targetUrl}`;
      }

      const params = new URLSearchParams({
        url: targetUrl,
        strategy: 'mobile',
        category: ['performance', 'accessibility', 'seo'].join(','), // Request multiple categories
      });

      if (apiKey) {
        params.append('key', apiKey);
      }

      const response = await fetch(`${this.API_ENDPOINT}?${params.toString()}`);
      
      if (!response.ok) {
        // Fallback for when API fails (often due to rate limits or invalid URLs)
        console.warn('PageSpeed API request failed:', response.status);
        return null;
      }

      const data = await response.json();
      return this.transformData(data);
    } catch (error) {
      console.error('PageSpeed analysis error:', error);
      return null;
    }
  }

  private static transformData(data: any) {
    const lighthouse = data.lighthouseResult;
    const audits = lighthouse.audits;
    const categories = lighthouse.categories;

    return {
      performanceScore: (categories.performance?.score || 0) * 100,
      seoScore: (categories.seo?.score || 0) * 100,
      accessibilityScore: (categories.accessibility?.score || 0) * 100,
      
      metrics: {
        lcp: parseFloat(audits['largest-contentful-paint']?.displayValue || '0'),
        cls: parseFloat(audits['cumulative-layout-shift']?.displayValue || '0'),
        fid: parseFloat(audits['max-potential-fid']?.numericValue || '0'), // Using max potential as proxy for FID in lab data
      },
      
      mobileIssues: {
        viewport: audits['viewport']?.score === 1,
        fontSizes: audits['font-size']?.score === 1,
        touchTargets: audits['tap-targets']?.score === 1,
      }
    };
  }
}
