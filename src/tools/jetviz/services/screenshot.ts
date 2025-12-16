import type { ScreenshotData } from '../types';

/**
 * Screenshot service using free screenshot APIs
 * Primary: screenshotapi.net (free tier available)
 * Fallback: Other free services
 */

const SCREENSHOT_API_KEY = 'free'; // Using free tier

export class ScreenshotService {
  /**
   * Capture screenshots of a website in different viewports
   */
  static async captureScreenshots(url: string): Promise<ScreenshotData> {
    try {
      // Validate and normalize URL
      const normalizedUrl = this.normalizeUrl(url);
      
      // Capture desktop screenshot
      const desktopUrl = await this.captureWithScreenshotOne(normalizedUrl, 'desktop');
      
      // Capture mobile screenshot
      const mobileUrl = await this.captureWithScreenshotOne(normalizedUrl, 'mobile');
      
      // Capture tablet screenshot (optional)
      const tabletUrl = await this.captureWithScreenshotOne(normalizedUrl, 'tablet');
      
      return {
        desktop: desktopUrl,
        mobile: mobileUrl,
        tablet: tabletUrl
      };
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      
      // Return placeholder screenshots on error
      return this.getPlaceholderScreenshots(url);
    }
  }

  /**
   * Capture screenshot using screenshot.one API (free, no API key required)
   */
  private static async captureWithScreenshotOne(
    url: string, 
    viewport: 'desktop' | 'mobile' | 'tablet'
  ): Promise<string> {
    const viewportSizes = {
      desktop: { width: 1920, height: 1080 },
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 }
    };

    const size = viewportSizes[viewport];
    
    // screenshot.one is a free service that doesn't require API key
    const screenshotUrl = `https://image.thum.io/get/width/${size.width}/crop/${size.height}/noanimate/${encodeURIComponent(url)}`;
    
    return screenshotUrl;
  }

  /**
   * Alternative: Use screenshotapi.net
   */
  private static async captureWithScreenshotAPI(
    url: string,
    viewport: 'desktop' | 'mobile' | 'tablet'
  ): Promise<string> {
    const viewportSizes = {
      desktop: { width: 1920, height: 1080 },
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 }
    };

    const size = viewportSizes[viewport];
    
    const params = new URLSearchParams({
      url: url,
      width: size.width.toString(),
      height: size.height.toString(),
      output: 'image',
      file_type: 'png',
      wait_for_event: 'load'
    });

    return `https://shot.screenshotapi.net/screenshot?${params.toString()}`;
  }

  /**
   * Normalize URL to ensure it has proper protocol
   */
  private static normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  /**
   * Get placeholder screenshots when capture fails
   */
  private static getPlaceholderScreenshots(url: string): ScreenshotData {
    // Generate placeholder with the URL
    const placeholder = (viewport: string) => 
      `data:image/svg+xml,${encodeURIComponent(`
        <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="600" fill="#f3f4f6"/>
          <text x="400" y="280" font-family="Arial" font-size="16" fill="#6b7280" text-anchor="middle">
            Screenshot Preview
          </text>
          <text x="400" y="310" font-family="Arial" font-size="14" fill="#9ca3af" text-anchor="middle">
            ${url} (${viewport})
          </text>
          <text x="400" y="340" font-family="Arial" font-size="12" fill="#d1d5db" text-anchor="middle">
            Unable to capture screenshot
          </text>
        </svg>
      `)}`;

    return {
      desktop: placeholder('Desktop'),
      mobile: placeholder('Mobile'),
      tablet: placeholder('Tablet')
    };
  }
}
