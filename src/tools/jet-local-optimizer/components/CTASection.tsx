import type { BrandConfig } from '../config/brands';
import type { AnalysisResult } from '../types';
import { Link } from 'react-router-dom';
import { Sparkles, Bot } from 'lucide-react';

interface CTASectionProps {
  brandConfig: BrandConfig;
  result: AnalysisResult;
}

export function CTASection({ brandConfig, result }: CTASectionProps) {
  const getUrgencyMessage = () => {
    if (result.overallScore < 60) {
      return 'Critical issues detected that are hurting your business right now.';
    }
    if (result.overallScore < 80) {
      return 'Your website has room for improvement to maximize performance.';
    }
    return 'Your website is performing well, but we can help you stay ahead.';
  };

  return (
    <div className="max-w-4xl mx-auto p-8 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-lg shadow-2xl mt-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">{brandConfig.ctaMessage}</h2>
        <p className="text-xl mb-6 opacity-90">{getUrgencyMessage()}</p>
        
        {brandConfig.resultsFocus === 'design-problems' && (
          <div className="mb-6 text-left bg-white/10 rounded-lg p-4">
            <p className="text-sm opacity-90 mb-2">Issues we found:</p>
            <ul className="space-y-1 text-sm">
              {result.overallScore < 70 && <li>• Outdated design costing you credibility</li>}
              {result.coreWebVitals.score < 70 && <li>• Slow load times driving visitors away</li>}
              {result.mobileScore.score < 70 && <li>• Poor mobile experience losing customers</li>}
              {result.seoStructure.score < 70 && <li>• Missing SEO elements hurting rankings</li>}
            </ul>
          </div>
        )}

        {brandConfig.resultsFocus === 'maintenance-needs' && (
          <div className="mb-6 text-left bg-white/10 rounded-lg p-4">
            <p className="text-sm opacity-90 mb-2">What needs constant monitoring:</p>
            <ul className="space-y-1 text-sm">
              {result.coreWebVitals.score < 80 && <li>• Performance metrics require regular optimization</li>}
              {result.seoStructure.score < 80 && <li>• SEO elements need ongoing updates</li>}
              {result.keywordGap.missingKeywords.length > 0 && <li>• Competitor keyword tracking and content updates</li>}
              {result.localRelevance.score < 80 && <li>• Local listing consistency across platforms</li>}
            </ul>
          </div>
        )}
        
        {/* AI Value Proposition */}
        <div className="mt-8 p-4 bg-blue-700 rounded-xl flex items-center gap-4 text-left">
            <Bot className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-white">
                **Let AI do it for you.** JetSuite is the complete platform that automates your marketing, content, and customer engagement.
            </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
            <button 
              className="bg-white text-blue-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition shadow-lg"
              onClick={() => window.location.href = '/contact'}
            >
              {brandConfig.ctaButton}
            </button>
            
            <a 
                href="https://getjetsuite.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-emerald-600 transition shadow-lg flex items-center justify-center gap-2"
            >
                <Sparkles className="w-5 h-5" />
                Visit JetSuite
            </a>
        </div>

        <p className="text-sm mt-4 opacity-75">
          Free consultation • No obligation • {brandConfig.name}
        </p>
      </div>
    </div>
  );
}