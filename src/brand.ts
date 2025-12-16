export interface BrandConfig {
  name: string;
  domain: string;
  primaryColor: string;
  ctaMessage: string;
  ctaButton: string;
  resultsFocus: 'design-problems' | 'maintenance-needs';
  logoUrl?: string;
}

export const BRAND_CONFIGS: Record<string, BrandConfig> = {
  cwp: {
    name: 'Custom Websites Plus',
    domain: 'customwebsitesplus.com',
    primaryColor: '#4F46E5', // Adjust to your brand color
    ctaMessage: 'Your outdated website is costing you customers',
    ctaButton: 'Get a Modern Website Rebuild',
    resultsFocus: 'design-problems',
    logoUrl: '/cwp-logo.png',
  },

  jetauto: {
    name: 'Jet Automations',
    domain: 'jetautomations.ai',
    primaryColor: '#0EA5E9', // Adjust to your brand color
    ctaMessage: 'Stop manually managing your website',
    ctaButton: 'Automate Your Website',
    resultsFocus: 'maintenance-needs',
    logoUrl: '/jetauto-logo.png',
  },
};

// Helper to get current brand based on domain
export const getCurrentBrand = (): BrandConfig => {
  const hostname = window.location.hostname;

  if (hostname.includes('jetautomations')) {
    return BRAND_CONFIGS.jetauto;
  }

  return BRAND_CONFIGS.cwp; // Default
};
