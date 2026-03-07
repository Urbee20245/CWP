import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import VoiceAgent from './components/VoiceAgent';
import SessionProvider from './src/context/SessionProvider';
import { ThemeProvider } from './src/context/ThemeContext';
import ProtectedRoute from './src/components/ProtectedRoute';
import ErrorBoundary from './src/components/ErrorBoundary';
import GlobalLoading from './src/components/GlobalLoading';
import { useAuth } from './src/hooks/useAuth';
import { Loader2 } from 'lucide-react';

// ─── Lazy-loaded page components ──────────────────────────────────────────────
// Splitting every route into its own chunk reduces the initial bundle size.
// Pages are loaded on first navigation and then cached by the browser.

// Public pages
const Home = React.lazy(() => import('@/src/pages/Home'));
const ServicesPage = React.lazy(() => import('./components/ServicesPage'));
const ProcessPage = React.lazy(() => import('./components/ProcessPage'));
const ContactPage = React.lazy(() => import('./components/ContactPage'));
const JetSuitePage = React.lazy(() => import('./components/JetSuitePage'));
const ProSitesPage = React.lazy(() => import('./src/pages/ProSitesPage'));
const JetVizPage = React.lazy(() => import('./components/JetVizPage'));
const JetLocalOptimizerPage = React.lazy(() => import('./components/JetLocalOptimizerPage'));
const PrivacyPolicy = React.lazy(() => import('./src/pages/PrivacyPolicy'));
const TermsAndConditions = React.lazy(() => import('./src/pages/TermsAndConditions'));
const LoginPage = React.lazy(() => import('./src/pages/Login'));
const GemOnboarding = React.lazy(() => import('./src/pages/GemOnboarding'));
const ProSitesCheckout = React.lazy(() => import('./src/pages/ProSitesCheckout'));
const ProSitesSuccess = React.lazy(() => import('./src/pages/ProSitesSuccess'));
const ProSitesGem = React.lazy(() => import('./src/pages/ProSitesGem'));

// Admin pages
const AdminDashboard = React.lazy(() => import('./src/pages/AdminDashboard'));
const AdminClientList = React.lazy(() => import('./src/pages/AdminClientList'));
const AdminProjectList = React.lazy(() => import('./src/pages/AdminProjectList'));
const AdminClientDetail = React.lazy(() => import('./src/pages/AdminClientDetail'));
const AdminProjectDetail = React.lazy(() => import('./src/pages/AdminProjectDetail'));
const AdminBillingProducts = React.lazy(() => import('./src/pages/AdminBillingProducts'));
const AdminRevenueDashboard = React.lazy(() => import('./src/pages/AdminRevenueDashboard'));
const AdminSettingsPage = React.lazy(() => import('./src/pages/AdminSettingsPage'));
const AdminDocumentGenerator = React.lazy(() => import('./src/pages/AdminDocumentGenerator'));
const AdminEmailGenerator = React.lazy(() => import('./src/pages/AdminEmailGenerator'));
const AdminTwilioSettings = React.lazy(() => import('./src/pages/AdminTwilioSettings'));
const AdminVoiceManagement = React.lazy(() => import('./src/pages/AdminVoiceManagement'));
const AdminAgentSettings = React.lazy(() => import('./src/pages/AdminAgentSettings'));
const AdminRetellCallScheduling = React.lazy(() => import('./src/pages/AdminRetellCallScheduling'));
const AdminAddonCatalog = React.lazy(() => import('./src/pages/AdminAddonCatalog'));
const AdminEmailDraft = React.lazy(() => import('./src/pages/AdminEmailDraft'));
const AdminAppointmentManagement = React.lazy(() => import('./src/pages/AdminAppointmentManagement'));
const AdminProfile = React.lazy(() => import('./src/pages/AdminProfile'));
const AdminUserManagement = React.lazy(() => import('./src/pages/AdminUserManagement'));
const AdminInbox = React.lazy(() => import('./src/pages/AdminInbox'));
const AdminA2PAutomation = React.lazy(() => import('./src/pages/AdminA2PAutomation'));
const AdminWebsiteBuilder = React.lazy(() => import('./src/pages/AdminWebsiteBuilder'));
const AdminWebsiteManager = React.lazy(() => import('./src/pages/AdminWebsiteManager'));
const AdminBlogManager = React.lazy(() => import('./src/pages/AdminBlogManager'));
const AdminSiteImport = React.lazy(() => import('./src/pages/AdminSiteImport'));
const AdminProposalList = React.lazy(() => import('./src/pages/AdminProposalList'));
const AdminProposalBuilder = React.lazy(() => import('./src/pages/AdminProposalBuilder'));
const AdminOnboardingManager = React.lazy(() => import('./src/pages/AdminOnboardingManager'));
const AdminClaudeAssistant = React.lazy(() => import('./src/pages/AdminClaudeAssistant'));
const AdminPaymentPlan = React.lazy(() => import('./src/pages/AdminPaymentPlan'));
const AdminCloneSite = React.lazy(() => import('./src/pages/AdminCloneSite'));

// Client pages
const ClientDashboard = React.lazy(() => import('./src/pages/ClientDashboard'));
const ClientProjectDetail = React.lazy(() => import('./src/pages/ClientProjectDetail'));
const ClientBilling = React.lazy(() => import('./src/pages/ClientBilling'));
const ClientProfile = React.lazy(() => import('./src/pages/ClientProfile'));
const ClientAddons = React.lazy(() => import('./src/pages/ClientAddons'));
const ClientAppointmentBooking = React.lazy(() => import('./src/pages/ClientAppointmentBooking'));
const ClientJetSuitePage = React.lazy(() => import('./src/pages/ClientJetSuitePage'));
const ClientHelpPage = React.lazy(() => import('./src/pages/ClientHelpPage'));
const ClientMessagingCompliance = React.lazy(() => import('./src/pages/ClientMessagingCompliance'));
const ClientSettings = React.lazy(() => import('./src/pages/ClientSettings'));
const ClientLeads = React.lazy(() => import('./src/pages/ClientLeads'));
const ClientWebsite = React.lazy(() => import('./src/pages/ClientWebsite'));
const ClientProposalReview = React.lazy(() => import('./src/pages/ClientProposalReview'));
const ClientNewRequest = React.lazy(() => import('./src/pages/ClientNewRequest'));
const TwilioConnectCallback = React.lazy(() => import('./src/pages/TwilioConnectCallback'));

// Shared / utility pages
const BackOfficeRedirect = React.lazy(() => import('./src/pages/BackOfficeRedirect'));
const NotFoundPage = React.lazy(() => import('./src/pages/NotFoundPage'));
const SiteRendererPage = React.lazy(() => import('./src/pages/SiteRenderer'));
const BlogListingPage = React.lazy(() => import('./src/pages/BlogListingPage'));
const BlogPostPage = React.lazy(() => import('./src/pages/BlogPostPage'));
const CustomDomainSite = React.lazy(() => import('./src/pages/CustomDomainSite'));
const CustomDomainAdmin = React.lazy(() => import('./src/pages/CustomDomainAdmin'));

// ─── Suspense fallback ─────────────────────────────────────────────────────────
const PageLoader: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
  </div>
);

// Returns true when the app is loaded from a client's custom domain
// (not the main CWP domain, localhost, or a Vercel preview URL)
function isCustomDomain(): boolean {
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return false;
  if (h.endsWith('.vercel.app')) return false;
  if (h === 'customwebsitesplus.com' || h.endsWith('.customwebsitesplus.com')) return false;
  if (h === 'jetautomations.ai' || h.endsWith('.jetautomations.ai')) return false;
  return true;
}

const AppContent: React.FC = () => {
  const location = useLocation();
  const { isLoading, user } = useAuth();
  const isBackOfficeRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/client') || location.pathname.startsWith('/back-office') || location.pathname === '/login' || location.pathname.startsWith('/site/') || location.pathname === '/onboarding' || location.pathname === '/pro-sites/onboard';
  const showGlobalComponents = !isBackOfficeRoute;

  if (isLoading && !user) return <GlobalLoading />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {showGlobalComponents && <Header />}

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/process" element={<ProcessPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/jetsuite" element={<JetSuitePage />} />
          <Route path="/pro-sites" element={<ProSitesPage />} />
          <Route path="/pro-sites/checkout" element={<ProSitesCheckout />} />
          <Route path="/pro-sites/success" element={<ProSitesSuccess />} />
          <Route path="/pro-sites/onboard" element={<ProSitesGem />} />
          <Route path="/jetviz" element={<JetVizPage />} />
          <Route path="/jet-local-optimizer" element={<JetLocalOptimizerPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<GemOnboarding />} />
          <Route path="/back-office" element={<ProtectedRoute allowedRoles={['admin', 'client']} />}>
            <Route index element={<BackOfficeRedirect />} />
          </Route>

          <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="users" element={<AdminUserManagement />} />
            <Route path="inbox" element={<AdminInbox />} />
            <Route path="clients" element={<AdminClientList />} />
            <Route path="clients/:id" element={<AdminClientDetail />} />
            <Route path="projects" element={<AdminProjectList />} />
            <Route path="projects/:id" element={<AdminProjectDetail />} />
            <Route path="voice" element={<AdminVoiceManagement />} />
            <Route path="agent-settings" element={<AdminAgentSettings />} />
            <Route path="call-scheduling" element={<AdminRetellCallScheduling />} />
            <Route path="appointments" element={<AdminAppointmentManagement />} />
            <Route path="billing/products" element={<AdminBillingProducts />} />
            <Route path="billing/revenue" element={<AdminRevenueDashboard />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="settings/twilio" element={<AdminTwilioSettings />} />
            <Route path="ai-docs" element={<AdminDocumentGenerator />} />
            <Route path="ai-email" element={<AdminEmailGenerator />} />
            <Route path="email-draft" element={<AdminEmailDraft />} />
            <Route path="addons/catalog" element={<AdminAddonCatalog />} />
            <Route path="a2p-automation" element={<AdminA2PAutomation />} />
            <Route path="website-builder" element={<AdminWebsiteBuilder />} />
            <Route path="websites" element={<AdminWebsiteManager />} />
            <Route path="site-import" element={<AdminSiteImport />} />
            <Route path="blog-manager" element={<AdminBlogManager />} />
            <Route path="proposals" element={<AdminProposalList />} />
            <Route path="proposals/new" element={<AdminProposalBuilder />} />
            <Route path="proposals/:id" element={<AdminProposalBuilder />} />
            <Route path="onboarding" element={<AdminOnboardingManager />} />
            <Route path="claude" element={<AdminClaudeAssistant />} />
            <Route path="billing/payment-plan" element={<AdminPaymentPlan />} />
            <Route path="clone-site" element={<AdminCloneSite />} />
          </Route>

          <Route path="/client/*" element={<ProtectedRoute allowedRoles={['client']} />}>
            <Route path="dashboard" element={<ClientDashboard />} />
            <Route path="leads" element={<ClientLeads />} />
            <Route path="settings" element={<ClientSettings />} />
            <Route path="twilio-callback" element={<TwilioConnectCallback />} />
            <Route path="messaging-compliance" element={<ClientMessagingCompliance />} />
            <Route path="projects/:id" element={<ClientProjectDetail />} />
            <Route path="appointments" element={<ClientAppointmentBooking />} />
            <Route path="billing" element={<ClientBilling />} />
            <Route path="profile" element={<ClientProfile />} />
            <Route path="addons" element={<ClientAddons />} />
            <Route path="jetsuite" element={<ClientJetSuitePage />} />
            <Route path="help" element={<ClientHelpPage />} />
            <Route path="website" element={<ClientWebsite />} />
            <Route path="proposals" element={<ClientProposalReview />} />
            <Route path="proposals/:id" element={<ClientProposalReview />} />
            <Route path="new-request" element={<ClientNewRequest />} />
          </Route>

          <Route path="/site/:slug" element={<SiteRendererPage />} />
          <Route path="/site/:slug/blog" element={<BlogListingPage />} />
          <Route path="/site/:slug/blog/:post" element={<BlogPostPage />} />
          <Route path="/site/:slug/:page" element={<SiteRendererPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      {showGlobalComponents && <Footer />}
      {showGlobalComponents && <VoiceAgent />}
    </div>
  );
};

const App: React.FC = () => {
  // When accessed from a client's custom domain, render only their site
  if (isCustomDomain()) {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/back-office/*" element={<CustomDomainAdmin />} />
              <Route path="/back-office" element={<CustomDomainAdmin />} />
              <Route path="/blog/:post" element={<CustomDomainSite />} />
              <Route path="/blog" element={<CustomDomainSite />} />
              <Route path="/:page" element={<CustomDomainSite />} />
              <Route path="/" element={<CustomDomainSite />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <SessionProvider>
            <AppContent />
          </SessionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
