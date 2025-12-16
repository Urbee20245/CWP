import type { BrandConfig } from '../config/brands';
import type { AnalysisResult } from '../types';

interface CTASectionProps {
  brandConfig: BrandConfig;
  result: AnalysisResult;
}

export function CTASection({ brandConfig, result }: CTASectionProps) {
  const getUrgencyMessage = () => {
    if (result.overallScore < 60) {
      return 'Your website design is actively turning away potential customers.';
    }
    if (result.overallScore < 80) {
      return 'Your website could be converting more visitors with a modern design.';
    }
    return 'Your website looks good, but there are still opportunities to stand out.';
  };

  const getDesignIssues = () => {
    const issues: string[] = [];
    
    if (result.designEra.era === '2000s') {
      issues.push('• Website looks over 15 years old - instant credibility loss');
    } else if (result.designEra.era === '2010s') {
      issues.push('• Design feels dated compared to modern competitors');
    }
    
    if (!result.trustSignals.hasHeroImage) {
      issues.push('• Missing professional hero section - weak first impression');
    }
    
    if (!result.trustSignals.modernFonts) {
      issues.push('• Typography looks unprofessional and outdated');
    }
    
    if (!result.trustSignals.goodWhitespace) {
      issues.push('• Cluttered layout making content hard to read');
    }
    
    if (result.mobilePreview.mobileUsabilityScore < 70) {
      issues.push('• Poor mobile experience losing mobile traffic');
    }
    
    if (!result.trustSignals.modernColorPalette) {
      issues.push('• Color scheme looks unprofessional');
    }

    return issues;
  };

  const designIssues = getDesignIssues();

  return (
    <div className="max-w-4xl mx-auto p-8 bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-lg shadow-2xl mt-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">{brandConfig.ctaMessage}</h2>
        <p className="text-xl mb-6 opacity-90">{getUrgencyMessage()}</p>
        
        {brandConfig.resultsFocus === 'design-problems' && designIssues.length > 0 && (
          <div className="mb-6 text-left bg-white/10 rounded-lg p-6 backdrop-blur-sm">
            <p className="text-sm opacity-90 mb-3 font-semibold">Visual Issues Detected:</p>
            <ul className="space-y-2 text-sm">
              {designIssues.map((issue, i) => (
                <li key={i} className="opacity-90">{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {brandConfig.resultsFocus === 'maintenance-needs' && (
          <div className="mb-6 text-left bg-white/10 rounded-lg p-6 backdrop-blur-sm">
            <p className="text-sm opacity-90 mb-3 font-semibold">Design maintenance requires:</p>
            <ul className="space-y-2 text-sm opacity-90">
              <li>• Regular design trend monitoring and updates</li>
              <li>• Consistent brand guidelines across all pages</li>
              <li>• Ongoing optimization of visual elements</li>
              <li>• Fresh content and imagery updates</li>
              <li>• Keeping up with accessibility standards</li>
            </ul>
          </div>
        )}

        <div className="my-8 py-6 border-y border-white/20">
          <p className="text-lg mb-3 font-semibold">The Cost of Outdated Design:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold mb-1">73%</div>
              <div className="text-xs opacity-80">of users judge credibility by design</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold mb-1">38%</div>
              <div className="text-xs opacity-80">leave if layout is unattractive</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="text-3xl font-bold mb-1">94%</div>
              <div className="text-xs opacity-80">of first impressions are design-related</div>
            </div>
          </div>
        </div>

        <button 
          className="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition shadow-lg hover:shadow-xl transform hover:scale-105"
          onClick={() => {
            // Navigate to contact or open contact form
            const contactSection = document.getElementById('contact');
            if (contactSection) {
              contactSection.scrollIntoView({ behavior: 'smooth' });
            } else {
              window.location.href = '/contact';
            }
          }}
        >
          {brandConfig.ctaButton}
        </button>

        <p className="text-sm mt-4 opacity-75">
          Free consultation • Portfolio examples • {brandConfig.name}
        </p>
      </div>
    </div>
  );
}
