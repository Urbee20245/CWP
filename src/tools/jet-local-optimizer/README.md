# Jet Local Optimizer

A fully client-side website analyzer that provides real-time performance, SEO, and local optimization insights using free public APIs.

## Features

### 🚀 Core Web Vitals Analysis
- **Real Google PageSpeed Insights data**
- Measures LCP (Largest Contentful Paint)
- Measures FID/TBT (First Input Delay / Total Blocking Time)
- Measures CLS (Cumulative Layout Shift)
- Scores based on Google's recommended thresholds

### 📱 Mobile Responsiveness
- Viewport configuration detection
- Touch target size validation
- Text readability analysis
- Mobile usability scoring

### 🔍 SEO Structure Analysis
- H1 tag detection
- Meta description validation
- Title tag checking
- Schema markup detection (JSON-LD and microdata)
- Image alt tag counting

### 📍 Local Relevance
- NAP (Name, Address, Phone) consistency checking
- Google Maps integration detection
- Local keyword analysis
- Business-specific optimization recommendations

### 💡 Keyword Gap Analysis
- Industry-specific keyword suggestions
- Content gap identification
- Opportunity scoring
- Competitor keyword insights

## How It Works

### 1. Google PageSpeed Insights API
```typescript
const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
```
- **Free to use** - No API key required for basic functionality
- Provides real Core Web Vitals data
- Mobile and desktop performance metrics
- Based on Chrome User Experience Report (CrUX)

### 2. HTML Content Analysis
```typescript
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
```
- Uses a CORS proxy to fetch website HTML
- Parses HTML using browser's native DOMParser
- Extracts SEO elements, meta tags, and content
- Fully client-side processing

### 3. Scoring Algorithm
Weighted average of all components:
- Core Web Vitals: 25%
- Mobile Score: 20%
- SEO Structure: 25%
- Local Relevance: 15%
- Keyword Gap: 15%

## Architecture

```
src/tools/jet-local-optimizer/
├── JetLocalOptimizer.tsx          # Main component with UI
├── components/
│   ├── AnalyzerForm.tsx           # Input form
│   ├── ResultsDashboard.tsx       # Results display
│   └── CTASection.tsx             # Brand-specific CTA
├── services/
│   ├── analyzer.ts                # Core analysis logic (✨ NEW)
│   └── abacus.ts                  # Deprecated backend service
├── types/
│   └── index.ts                   # TypeScript interfaces
└── config/
    └── brands.ts                  # Multi-brand configuration
```

## Usage

### Basic Usage
```tsx
import { JetLocalOptimizer } from './src/tools/jet-local-optimizer/JetLocalOptimizer';

function App() {
  return <JetLocalOptimizer />;
}
```

### Using the Analyzer Service Directly
```typescript
import { AnalyzerService } from './services/analyzer';

const result = await AnalyzerService.analyzeWebsite({
  websiteUrl: 'https://example.com',
  businessName: 'Example Business',
  industry: 'plumbing'
});

console.log('Overall Score:', result.overallScore);
console.log('Core Web Vitals:', result.coreWebVitals);
```

## API Details

### Google PageSpeed Insights API

**Endpoint:**
```
GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed
```

**Parameters:**
- `url` - Website URL to analyze
- `strategy` - "mobile" or "desktop"
- `category` - "performance", "accessibility", "best-practices", "seo"

**Rate Limits:**
- Free tier: 25,000 requests per day
- No authentication required for basic use
- Recommended: Implement client-side caching

### CORS Proxy

**Endpoint:**
```
GET https://api.allorigins.win/raw?url={encoded_url}
```

**Why needed:**
- Browsers block direct cross-origin HTML fetching
- This proxy adds proper CORS headers
- Alternative proxies: cors-anywhere.herokuapp.com, corsproxy.io

**Limitations:**
- Some websites may block proxy user agents
- SSL/HTTPS-only sites required
- Rate limiting may apply

## Scoring Thresholds

### Core Web Vitals
- **LCP (Largest Contentful Paint)**
  - Good: ≤ 2.5s (100 points)
  - Needs Improvement: 2.5s - 4.0s (50 points)
  - Poor: > 4.0s (0 points)

- **FID/TBT (First Input Delay / Total Blocking Time)**
  - Good: ≤ 100ms (100 points)
  - Needs Improvement: 100ms - 300ms (50 points)
  - Poor: > 300ms (0 points)

- **CLS (Cumulative Layout Shift)**
  - Good: ≤ 0.1 (100 points)
  - Needs Improvement: 0.1 - 0.25 (50 points)
  - Poor: > 0.25 (0 points)

### SEO Structure
- H1 Tag: 20 points
- Meta Description (>50 chars): 25 points
- Title Tag (>10 chars): 25 points
- Schema Markup: 20 points
- Alt Tags Coverage: up to 10 points

## Multi-Brand Support

The tool supports multiple brand configurations:

```typescript
// Custom Websites Plus (CWP)
- Focus: Design problems and rebuilds
- CTA: "Get a Modern Website Rebuild"

// Jet Automations
- Focus: Maintenance and automation needs
- CTA: "Automate Your Website"
```

Brand is automatically detected based on domain:
```typescript
const brand = getCurrentBrand(); // Returns CWP or JetAuto config
```

## Error Handling

The analyzer gracefully handles failures:

1. **PageSpeed API fails** - Returns zero scores but continues with other checks
2. **HTML fetch fails** - Returns empty SEO/local data but shows performance metrics
3. **Invalid URL** - Shows user-friendly error message with troubleshooting tips

## Limitations

### Known Limitations
1. **CORS Restrictions** - Some websites block proxy access
2. **Rate Limiting** - PageSpeed API has daily limits
3. **Dynamic Content** - JavaScript-rendered content may not be fully analyzed
4. **Private Sites** - Cannot analyze password-protected or localhost sites
5. **Competitor Keywords** - Based on industry templates, not actual competitor data

### Workarounds
- Results are best-effort based on available data
- Users should try again if initial fetch fails
- Consider implementing caching to reduce API calls
- For production: Add your own PageSpeed API key for higher limits

## Future Enhancements

Potential improvements:
- [ ] Add caching layer for repeated analyses
- [ ] Integrate actual competitor keyword APIs
- [ ] Add accessibility scoring (WCAG compliance)
- [ ] Implement historical tracking
- [ ] Add PDF report generation
- [ ] Support batch URL analysis
- [ ] Add custom crawl depth options

## Dependencies

```json
{
  "react": "^19.2.3",
  "react-dom": "^19.2.3",
  "typescript": "~5.8.2"
}
```

No additional dependencies required - uses native browser APIs and free public services!

## License

Part of Custom Websites Plus / Jet Automations toolkit.

## Support

For issues or questions:
- Check browser console for detailed error logs
- Verify the URL is publicly accessible
- Try again after a few moments (rate limiting)
- Ensure you have a stable internet connection
