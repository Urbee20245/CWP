# JetViz - Visual Website Modernization Analyzer

## Overview

JetViz is a visual website analysis tool that helps business owners understand if their website looks outdated. Unlike technical performance tools (like Jet Local Optimizer), JetViz focuses on visual design patterns, trust signals, and modern design standards.

## Features

### 1. Screenshot Capture
- Captures website screenshots in multiple viewports (desktop, mobile, tablet)
- Uses free screenshot APIs (thum.io) for client-side operation
- Graceful fallback with SVG placeholders if screenshot fails

### 2. Design Era Detection
Analyzes HTML/CSS patterns to determine if the website design is from:
- **2000s Era**: Table layouts, Flash remnants, cluttered design
- **2010s Era**: jQuery-heavy, gradients, heavy shadows
- **Modern Era**: Flat design, Flexbox/Grid, minimalism

### 3. Visual Trust Signals
Checks for professional design elements:
- Professional hero image
- Clear contact information
- SSL certificate (HTTPS)
- Modern color palette
- Good whitespace usage
- Modern font choices

### 4. Mobile Visual Preview
- Shows website appearance on mobile devices
- Detects responsive breakpoints
- Calculates mobile usability score
- Identifies mobile-specific issues

### 5. Visual Comparison
- Highlights outdated design elements
- Provides specific modernization suggestions
- Compares against modern design standards

## Architecture

```
jetviz/
├── components/
│   ├── AnalyzerForm.tsx       # Input form for website URL
│   ├── ResultsDashboard.tsx   # Visual results display with screenshots
│   └── CTASection.tsx         # Call-to-action with brand messaging
├── services/
│   ├── screenshot.ts          # Screenshot capture using free APIs
│   └── visualAnalyzer.ts      # Design pattern analysis
├── types/
│   └── index.ts              # TypeScript type definitions
├── config/
│   └── brands.ts             # Multi-brand configuration
├── JetViz.tsx                # Main orchestrator component
└── index.ts                  # Public exports
```

## Usage

### Basic Integration

```tsx
import { JetViz } from '@/src/tools/jetviz';

function MyPage() {
  return <JetViz />;
}
```

### With Custom Brand Configuration

```tsx
import { JetViz, getCurrentBrand } from '@/src/tools/jetviz';

function MyPage() {
  const brand = getCurrentBrand();
  // Brand automatically detected from hostname
  return <JetViz />;
}
```

## Configuration

### Environment Variables

```bash
# Enable mock data for testing
VITE_USE_MOCK_ANALYZER=true
```

### Brand Configuration

The tool supports multi-brand configuration:

- **Custom Websites Plus (CWP)**: Focus on design problems
- **Jet Automations**: Focus on maintenance needs

Brand is automatically detected based on hostname:
- `customwebsitesplus.com` → CWP brand
- `jetautomations.ai` → Jet Automations brand
- Default → CWP brand

## Screenshot Service

### Primary API: thum.io
Free screenshot service that doesn't require API keys:

```
https://image.thum.io/get/width/{width}/crop/{height}/noanimate/{url}
```

### Features:
- No rate limits on free tier
- Multiple viewport sizes
- Real browser rendering
- Fast response times

### Fallback Behavior:
If screenshot capture fails, the service generates an SVG placeholder with:
- Website URL
- Viewport type (Desktop/Mobile/Tablet)
- Error message

## Visual Analysis Algorithm

### Design Era Detection

The analyzer examines HTML/CSS for specific patterns:

**2000s Indicators:**
- Table-based layouts
- Flash/SWF references
- `<marquee>`, `<center>`, `<font>` tags
- Spacer GIFs
- Frame-based designs

**2010s Indicators:**
- jQuery usage
- Heavy gradients and shadows
- Skeuomorphic design patterns
- Old-style carousels/sliders

**Modern Indicators:**
- Flexbox/Grid layouts
- CSS variables
- Modern frameworks (React, Vue, Tailwind)
- WebP images
- Lazy loading

### Trust Signal Analysis

Checks for:
1. **Hero Image**: Presence of professional hero/banner sections
2. **Contact Info**: Phone numbers, email addresses, contact forms
3. **SSL**: HTTPS protocol
4. **Color Palette**: Modern color formats (HSL, CSS variables)
5. **Whitespace**: Adequate margin/padding usage
6. **Typography**: Modern web fonts, font-display optimization

### Mobile Analysis

Evaluates:
- Viewport meta tag presence
- Media query usage
- Responsive design patterns (Flexbox, Grid)
- Mobile-friendly breakpoints
- Touch target sizes
- Fixed-width elements

## Scoring System

### Overall Score (0-100)
Weighted average of:
- Design Era Score: 40%
- Trust Signals Score: 35%
- Mobile Usability Score: 25%

### Component Scores

**Design Era:**
- Modern: 95/100
- 2010s: 60/100
- 2000s: 30/100

**Trust Signals:**
- Each signal: ~16.67 points (6 total signals)
- All passed: 100/100

**Mobile Usability:**
- Base: 50 points
- Responsive design: +30 points
- Breakpoints detected: +10 points
- Modern layout (Flex/Grid): +10 points
- No issues: 100/100

## Client-Side Operation

### CORS Proxy
To fetch website content client-side, we use a CORS proxy:

```typescript
const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
```

### Why Client-Side?
- No backend infrastructure required
- Instant analysis
- Free to operate
- Scales automatically

### Limitations
- Some websites block proxy fetching
- Screenshot quality depends on external service
- Analysis is based on initial HTML/CSS (no JavaScript execution)

## Mock Data

For testing without fetching real websites:

```bash
VITE_USE_MOCK_ANALYZER=true
```

Mock data includes:
- Sample screenshot URLs
- Typical 2010s design patterns
- Mixed trust signals
- Responsive design with issues
- Realistic modernization opportunities

## Future Enhancements

### Planned Features:
1. **AI-Powered Design Critique**: Use GPT-4 Vision to analyze screenshots
2. **Before/After Mockups**: Generate redesign previews
3. **Competitor Comparison**: Analyze competitors' designs
4. **Historical Timeline**: Show design evolution over time
5. **Custom Brand Guidelines**: Check against specific brand requirements

### Technical Improvements:
1. **Better Screenshot Service**: Investigate paid services for higher quality
2. **JavaScript Execution**: Capture fully-rendered pages
3. **Video Capture**: Show animations and interactions
4. **Accessibility Analysis**: WCAG compliance checking
5. **Performance Integration**: Combine with Core Web Vitals

## Testing

### Manual Testing
1. Visit `/jetviz` route
2. Enter a website URL
3. Click "Visualize Now"
4. Review analysis results

### Test URLs
- **Modern**: `https://stripe.com`, `https://vercel.com`
- **2010s**: Many small business websites
- **2000s**: Government websites, legacy platforms

## Contributing

When adding new features:
1. Update type definitions in `types/index.ts`
2. Add service logic in appropriate service file
3. Update UI components to display new data
4. Update this README with new features
5. Add mock data for testing

## License

Proprietary - Custom Websites Plus © 2025
