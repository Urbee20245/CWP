# Jet Local Optimizer - Technical Implementation Guide

## Architecture Overview
The optimizer runs 100% client-side using a dual-analysis approach:

1. **Performance Analysis (Google PageSpeed Insights)**
   - Connects to Google's Lighthouse infrastructure
   - Fetches Core Web Vitals (LCP, FID, CLS)
   - Analyzes mobile viewport configuration
   
2. **Content Analysis (CORS Proxy)**
   - Fetches raw HTML via `api.allorigins.win` (Primary) or `corsproxy.io` (Backup)
   - Parses DOM for SEO tags (H1, Meta, Title)
   - Detects Schema Markup (`application/ld+json`)
   - Scans for NAP (Name, Address, Phone)
   - Performs industry keyword gap analysis

## Key Files

- `services/analyzer.ts`: Main orchestrator. Combines data from both sources.
- `services/pagespeed.ts`: Handles Google API communication.
- `services/scanner.ts`: Handles raw HTML fetching and parsing.

## API Usage

### Google PageSpeed
No API key is strictly required for low-volume usage, but you can add `VITE_PAGESPEED_API_KEY` to `.env` for higher limits.

### CORS Proxies
We use public proxies to bypass CORS restrictions on client-side fetching.
- Rate limits apply (usually generous for demo purposes)
- Fallback logic ensures reliability

## Scoring Algorithm

Overall Score is a weighted average:
- **Core Web Vitals**: 30%
- **Mobile Usability**: 20%
- **SEO Structure**: 25%
- **Local Relevance**: 15%
- **Keyword Gaps**: 10%
