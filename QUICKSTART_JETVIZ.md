# JetViz Quick Start Guide

## 🚀 Get Started in 3 Minutes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment (Optional)
```bash
# Copy example environment file
cp .env.example .env

# For testing with mock data (recommended first)
# Edit .env and ensure:
VITE_USE_MOCK_ANALYZER=true
```

### Step 3: Start Development Server
```bash
npm run dev
```

### Step 4: Access JetViz
Open your browser and navigate to:
```
http://localhost:3000/#/jetviz
```

## 📋 Using JetViz

### Method 1: From Landing Page
1. Scroll to the bottom of the JetViz page
2. Enter a website URL in the form
3. Click "Visualize Now"
4. View the comprehensive analysis

### Method 2: Direct Tool Access
1. Visit `http://localhost:3000/#/jetviz`
2. The form is already visible at the top
3. Enter URL and analyze

## 🎯 What You'll See

### Input Form
- Clean input field for website URL
- Optional business name and industry fields
- Animated loading state during analysis

### Analysis Results
1. **Overall Score** (0-100) with design era badge
2. **Screenshots** in 3 viewports (Desktop, Tablet, Mobile)
3. **Design Era Analysis** with confidence percentage
4. **Visual Trust Signals** (6 checks)
5. **Mobile Preview** with usability score
6. **Modernization Opportunities** with specific suggestions

### Call to Action
- Dynamic messaging based on score
- Statistical proof points
- Brand-specific CTAs

## 🧪 Test URLs

### Modern Websites (Expected Score: 85-95)
```
https://stripe.com
https://vercel.com
https://linear.app
https://airbnb.com
```

### 2010s Design (Expected Score: 55-75)
```
https://craigslist.org
Many small business websites
```

### Outdated Design (Expected Score: 30-50)
```
Many government websites
Legacy corporate sites
```

## 🎨 Customization

### Change Brand Configuration
Edit `/workspace/src/tools/jetviz/config/brands.ts`:

```typescript
export const BRAND_CONFIGS: Record<string, BrandConfig> = {
  cwp: {
    name: 'Your Company Name',
    primaryColor: '#YOUR_COLOR',
    ctaMessage: 'Your custom message',
    ctaButton: 'Your CTA text',
    resultsFocus: 'design-problems',
  }
};
```

### Modify Analysis Criteria
Edit `/workspace/src/tools/jetviz/services/visualAnalyzer.ts`:
- Add new design pattern checks
- Adjust scoring weights
- Customize era detection logic

## 🔄 Switch to Live Mode

### Using Real Websites (No Mock Data)
```bash
# Edit .env
VITE_USE_MOCK_ANALYZER=false
```

This will:
- Capture real screenshots from thum.io
- Fetch actual website HTML
- Analyze live content
- Show real-time results

### Screenshot API Limits
The free tier of thum.io has generous limits:
- No API key required
- Reasonable rate limits
- Good quality screenshots

## 🐛 Troubleshooting

### Issue: Screenshots not loading
**Solution**: Check browser console for CORS errors. The screenshot service should work, but some firewalls may block it.

### Issue: Mock data always shows
**Solution**: Ensure `VITE_USE_MOCK_ANALYZER=false` in your `.env` file and restart dev server.

### Issue: TypeScript errors
**Solution**: Run `npx tsc --noEmit` to check for errors. All types should be properly defined.

### Issue: Build fails
**Solution**: 
```bash
rm -rf node_modules
rm package-lock.json
npm install
npm run build
```

## 📊 Understanding Scores

### Design Era Score (40% of total)
- **Modern (95)**: Flexbox, Grid, modern frameworks
- **2010s (60)**: jQuery, gradients, old patterns
- **2000s (30)**: Tables, frames, ancient HTML

### Trust Signals Score (35% of total)
- Each signal worth ~16.67 points
- Checks: Hero, Contact, SSL, Colors, Spacing, Fonts

### Mobile Usability Score (25% of total)
- Base: 50 points
- Responsive: +30 points
- Modern layout: +10 points
- Breakpoints: +10 points

## 🎓 Learning Resources

### Understanding the Code
1. Start with `/workspace/src/tools/jetviz/JetViz.tsx` - Main component
2. Check `/workspace/src/tools/jetviz/services/visualAnalyzer.ts` - Analysis logic
3. Review `/workspace/src/tools/jetviz/types/index.ts` - Data structures

### Key Concepts
- **Design Pattern Detection**: Regex matching on HTML/CSS
- **Screenshot Capture**: Free API integration
- **Client-Side Analysis**: No backend needed
- **Multi-Brand**: Automatic brand detection

## 🚢 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Static Hosting
Upload the `dist/` folder to:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Any static host

### Environment Variables in Production
Set these in your hosting platform:
```
VITE_USE_MOCK_ANALYZER=false
VITE_BRAND=cwp
```

## 📞 Getting Help

### Check Documentation
1. `/workspace/src/tools/jetviz/README.md` - Full documentation
2. `/workspace/JETVIZ_IMPLEMENTATION.md` - Implementation details
3. This file - Quick start guide

### Common Issues
- All TypeScript errors should be resolved
- Build should complete successfully
- Dev server should start without errors
- Tool should work in modern browsers

## 🎉 You're Ready!

JetViz is now fully set up and ready to use. Start analyzing websites and providing visual feedback to your clients!

**Next Steps:**
1. ✅ Test with a few sample URLs
2. ✅ Customize brand configuration if needed
3. ✅ Review the analysis results
4. ✅ Deploy to production when ready

Happy analyzing! 🚀
