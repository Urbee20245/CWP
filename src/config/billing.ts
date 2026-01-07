// NOTE: These should be replaced with actual Stripe Price IDs from your Stripe account.
export const STRIPE_SUBSCRIPTION_PRICES = {
    WEB_MAINTENANCE: 'price_1Oa2x02eZvKYlo2C12345678', // Example Price ID
    SEO_PACKAGE: 'price_1Oa2x02eZvKYlo2C87654321', // Example Price ID
    HOSTING_FEE: 'price_1Oa2x02eZvKYlo2C11223344', // Example Price ID
};

export const SUBSCRIPTION_PLANS = [
    { id: 'WEB_MAINTENANCE', name: 'Standard Maintenance', priceId: STRIPE_SUBSCRIPTION_PRICES.WEB_MAINTENANCE, description: 'Monthly updates and security checks.' },
    { id: 'SEO_PACKAGE', name: 'Advanced SEO & Content', priceId: STRIPE_SUBSCRIPTION_PRICES.SEO_PACKAGE, description: 'Ongoing SEO optimization and content strategy.' },
    { id: 'HOSTING_FEE', name: 'Premium Hosting', priceId: STRIPE_SUBSCRIPTION_PRICES.HOSTING_FEE, description: 'High-performance hosting and CDN.' },
];