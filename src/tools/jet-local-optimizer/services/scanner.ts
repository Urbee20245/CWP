export class ScannerService {
  // CORS Proxies to try in order
  private static PROXIES = [
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  static async scan(url: string) {
    let html = '';
    
    // Try to fetch HTML through proxies
    for (const proxyGen of this.PROXIES) {
      try {
        const proxyUrl = proxyGen(url);
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const data = await response.json();
          // allorigins returns JSON with contents, others might return raw text
          html = data.contents || data; 
          if (typeof html === 'string' && html.length > 100) break;
        }
      } catch (e) {
        console.warn('Proxy fetch failed, trying next...');
      }
    }

    if (!html) {
      throw new Error('Could not fetch website content');
    }

    return this.parseHtml(html, url);
  }

  private static parseHtml(html: string, url: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // SEO Checks
    const hasH1 = doc.getElementsByTagName('h1').length > 0;
    const titleTag = !!doc.querySelector('title')?.textContent;
    const metaDescription = !!doc.querySelector('meta[name="description"]')?.getAttribute('content');
    const images = Array.from(doc.getElementsByTagName('img'));
    const imagesWithAlt = images.filter(img => img.hasAttribute('alt') && img.getAttribute('alt')?.trim()).length;
    
    // Schema
    const schemaMarkup = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).length > 0;

    // Content Analysis (Simple text extraction)
    const bodyText = doc.body.textContent || '';
    
    // NAP Detection (Simplified)
    // Looking for patterns that look like phone numbers
    const phoneRegex = /(\(\d{3}\)\s*\d{3}-\d{4})|(\d{3}-\d{3}-\d{4})/;
    const hasPhone = phoneRegex.test(bodyText);
    
    // Local keywords detection (very basic)
    const localKeywords = ['near me', 'local', 'serving', 'area', 'county', 'city'].filter(kw => 
      bodyText.toLowerCase().includes(kw)
    ).length;

    return {
      seo: {
        hasH1,
        titleTag,
        metaDescription,
        schemaMarkup,
        altTagsCount: imagesWithAlt,
        totalImages: images.length
      },
      local: {
        hasPhone,
        localKeywordsCount: localKeywords,
        hasMapEmbed: !!doc.querySelector('iframe[src*="google.com/maps"]'),
        hasAddress: bodyText.toLowerCase().includes('ga 3') || bodyText.toLowerCase().includes('street') // Very rough check
      },
      content: bodyText.toLowerCase()
    };
  }

  static analyzeKeywords(content: string, industry: string = 'general') {
    const commonKeywords: Record<string, string[]> = {
      plumbing: ['emergency', '24/7', 'repair', 'leak', 'drain', 'heater'],
      hvac: ['ac', 'heating', 'cooling', 'furnace', 'repair', 'installation'],
      lawyer: ['attorney', 'law', 'legal', 'consultation', 'case', 'court'],
      restaurant: ['menu', 'reservation', 'dining', 'food', 'order', 'delivery'],
      general: ['service', 'contact', 'about', 'quality', 'professional']
    };

    const targetKeywords = commonKeywords[industry.toLowerCase()] || commonKeywords.general;
    
    const missing = targetKeywords.filter(kw => !content.includes(kw));
    const present = targetKeywords.filter(kw => content.includes(kw));

    return {
      missing,
      present,
      score: (present.length / targetKeywords.length) * 100
    };
  }
}
