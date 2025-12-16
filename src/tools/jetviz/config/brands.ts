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
    primaryColor: '#4F46E5',
    ctaMessage: 'Your website looks outdated and unprofessional',
    ctaButton: 'Get a Modern Website Redesign',
    resultsFocus: 'design-problems',
    logoUrl: '/cwp-logo.png'
  },
  
  jetauto: {
    name: 'Jet Automations',
    domain: 'jetautomations.ai',
    primaryColor: '#0EA5E9',
    ctaMessage: 'Your website design is costing you customers',
    ctaButton: 'Modernize Your Website',
    resultsFocus: 'maintenance-needs',
    logoUrl: '/jetauto-logo.png'
  }
};

export const getCurrentBrand = (): BrandConfig => {
  const hostname = window.location.hostname;
  
  if (hostname.includes('jetautomations')) {
    return BRAND_CONFIGS.jetauto;
  }
  
  return BRAND_CONFIGS.cwp;
};
