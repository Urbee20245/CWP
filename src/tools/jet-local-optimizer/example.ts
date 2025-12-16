/**
 * Example: Direct Usage of AnalyzerService
 * 
 * This file demonstrates how to use the AnalyzerService directly
 * without the UI components. Useful for testing, debugging, or
 * integrating the analyzer into other tools.
 */

import { AnalyzerService } from './services/analyzer';
import type { AnalysisRequest, AnalysisResult } from './types';

/**
 * Basic Example: Analyze a website
 */
export async function basicExample() {
  console.log('🚀 Starting basic website analysis...\n');
  
  try {
    const request: AnalysisRequest = {
      websiteUrl: 'https://example.com'
    };
    
    const result: AnalysisResult = await AnalyzerService.analyzeWebsite(request);
    
    console.log('✅ Analysis Complete!\n');
    console.log('📊 Results:');
    console.log('─'.repeat(50));
    console.log(`Overall Score: ${result.overallScore}/100`);
    console.log(`Website: ${result.websiteUrl}`);
    console.log(`Analyzed: ${new Date(result.generatedAt).toLocaleString()}`);
    console.log('\n');
    
    console.log('⚡ Core Web Vitals:');
    console.log(`  Score: ${result.coreWebVitals.score}/100`);
    console.log(`  LCP: ${result.coreWebVitals.lcp}s ${result.coreWebVitals.lcp <= 2.5 ? '✅' : '❌'}`);
    console.log(`  FID: ${result.coreWebVitals.fid}ms ${result.coreWebVitals.fid <= 100 ? '✅' : '❌'}`);
    console.log(`  CLS: ${result.coreWebVitals.cls} ${result.coreWebVitals.cls <= 0.1 ? '✅' : '❌'}`);
    console.log('\n');
    
    console.log('📱 Mobile Responsiveness:');
    console.log(`  Score: ${result.mobileScore.score}/100`);
    console.log(`  Touch Targets: ${result.mobileScore.touchTargets ? '✅ Pass' : '❌ Fail'}`);
    console.log(`  Viewport Scaling: ${result.mobileScore.viewportScaling ? '✅ Pass' : '❌ Fail'}`);
    console.log(`  Text Readability: ${result.mobileScore.textReadability ? '✅ Pass' : '❌ Fail'}`);
    console.log('\n');
    
    console.log('🔍 SEO Structure:');
    console.log(`  Score: ${result.seoStructure.score}/100`);
    console.log(`  H1 Tag: ${result.seoStructure.hasH1 ? '✅ Found' : '❌ Missing'}`);
    console.log(`  Meta Description: ${result.seoStructure.metaDescription ? '✅ Found' : '❌ Missing'}`);
    console.log(`  Title Tag: ${result.seoStructure.titleTag ? '✅ Found' : '❌ Missing'}`);
    console.log(`  Schema Markup: ${result.seoStructure.schemaMarkup ? '✅ Found' : '❌ Missing'}`);
    console.log(`  Alt Tags: ${result.seoStructure.altTags} images`);
    console.log('\n');
    
    console.log('📍 Local Relevance:');
    console.log(`  Score: ${result.localRelevance.score}/100`);
    console.log(`  NAP Consistency: ${result.localRelevance.napConsistency ? '✅' : '❌'}`);
    console.log(`  Google My Business: ${result.localRelevance.googleMyBusiness ? '✅' : '❌'}`);
    console.log(`  Local Keywords: ${result.localRelevance.localKeywords}`);
    console.log('\n');
    
    console.log('💡 Keyword Gap:');
    console.log(`  Opportunity Score: ${result.keywordGap.opportunityScore}/100`);
    console.log(`  Missing Keywords: ${result.keywordGap.missingKeywords.join(', ')}`);
    console.log('\n');
    
    return result;
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  }
}

/**
 * Advanced Example: Analyze with business context
 */
export async function advancedExample() {
  console.log('🚀 Starting advanced website analysis with business context...\n');
  
  try {
    const request: AnalysisRequest = {
      websiteUrl: 'https://example-plumbing.com',
      businessName: 'Example Plumbing Services',
      industry: 'plumbing'
    };
    
    const result = await AnalyzerService.analyzeWebsite(request);
    
    console.log('✅ Analysis Complete!\n');
    console.log(`Business: ${request.businessName}`);
    console.log(`Industry: ${request.industry}`);
    console.log(`Overall Score: ${result.overallScore}/100\n`);
    
    // Check for critical issues
    const issues = [];
    
    if (result.coreWebVitals.score < 60) {
      issues.push('⚠️  CRITICAL: Poor website speed affecting user experience');
    }
    
    if (result.mobileScore.score < 60) {
      issues.push('⚠️  CRITICAL: Mobile responsiveness issues');
    }
    
    if (!result.seoStructure.hasH1) {
      issues.push('⚠️  Missing H1 tag - important for SEO');
    }
    
    if (!result.seoStructure.metaDescription) {
      issues.push('⚠️  Missing meta description - hurting search rankings');
    }
    
    if (result.keywordGap.missingKeywords.length > 5) {
      issues.push(`⚠️  Missing ${result.keywordGap.missingKeywords.length} important keywords`);
    }
    
    if (issues.length > 0) {
      console.log('🔴 Critical Issues Found:');
      issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('🟢 No critical issues found!');
    }
    
    console.log('\n');
    return result;
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
  }
}

/**
 * Batch Example: Analyze multiple websites
 */
export async function batchExample() {
  console.log('🚀 Starting batch website analysis...\n');
  
  const websites = [
    'https://example.com',
    'https://google.com',
    'https://github.com'
  ];
  
  const results = [];
  
  for (const url of websites) {
    try {
      console.log(`Analyzing: ${url}...`);
      const result = await AnalyzerService.analyzeWebsite({ websiteUrl: url });
      results.push(result);
      console.log(`✅ ${url} - Score: ${result.overallScore}/100\n`);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Failed to analyze ${url}:`, error);
    }
  }
  
  // Summary
  console.log('\n📊 Batch Analysis Summary:');
  console.log('─'.repeat(50));
  console.log(`Total Sites Analyzed: ${results.length}`);
  console.log(`Average Score: ${Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length)}/100`);
  
  const bestSite = results.reduce((best, current) => 
    current.overallScore > best.overallScore ? current : best
  );
  console.log(`Best Performer: ${bestSite.websiteUrl} (${bestSite.overallScore}/100)`);
  
  console.log('\n');
  return results;
}

/**
 * Testing Helper: Mock analysis for development
 */
export async function testMode() {
  console.log('🧪 Running in test mode with fast mock data...\n');
  
  // This would use a mocked version for fast testing
  // For now, it just runs the basic example
  return basicExample();
}

/**
 * Usage Examples:
 * 
 * // In browser console:
 * import { basicExample } from './example';
 * await basicExample();
 * 
 * // Or with business context:
 * import { advancedExample } from './example';
 * await advancedExample();
 * 
 * // Batch processing:
 * import { batchExample } from './example';
 * await batchExample();
 */

// Export all examples
export default {
  basicExample,
  advancedExample,
  batchExample,
  testMode
};
