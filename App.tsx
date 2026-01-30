import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import VoiceAgent from './components/VoiceAgent';
import Home from '@/src/pages/Home';
import JetLocalOptimizerPage from './components/JetLocalOptimizerPage';
import JetVizPage from './components/JetVizPage';
import JetSuitePage from './components/JetSuitePage';
import ServicesPage from './components/ServicesPage';
import ContactPage from './components/ContactPage';
import ProcessPage from './components/ProcessPage';
import SessionProvider from './src/context/SessionProvider';
import ProtectedRoute from './src/components/ProtectedRoute';
import AdminDashboard from './src/pages/AdminDashboard';
import AdminClientList from './src/pages/AdminClientList';
import AdminProjectList from './src/pages/AdminProjectList';
import ClientDashboard from './src/pages/ClientDashboard';
import AdminClientDetail from './src/pages/AdminClientDetail';
import AdminProjectDetail from './src/pages/AdminProjectDetail';
import ClientProjectDetail from './src/pages/ClientProjectDetail';
import ClientBilling from './src/pages/ClientBilling';
import BackOfficeRedirect from './src/pages/BackOfficeRedirect';
import AdminBillingProducts from './src/pages/AdminBillingProducts';
import AdminRevenueDashboard from './src/pages/AdminRevenueDashboard';
import AdminSettingsPage from './src/pages/AdminSettingsPage';
import AdminDocumentGenerator from './src/pages/AdminDocumentGenerator';
import AdminEmailGenerator from './src/pages/AdminEmailGenerator';
import AdminTwilioSettings from './src/pages/AdminTwilioSettings';
import AdminVoiceManagement from './src/pages/AdminVoiceManagement';
import NotFoundPage from './src/pages/NotFoundPage';
import ErrorBoundary from './src/components/ErrorBoundary';
import GlobalLoading from './src/components/GlobalLoading';
import { useAuth } from './src/hooks/useAuth';
import LoginPage from './src/pages/Login';
import ClientProfile from './src/pages/ClientProfile';
import PrivacyPolicy from './src/pages/PrivacyPolicy';
import TermsAndConditions from './src/pages/TermsAndConditions';
import ClientAddons from './src/pages/ClientAddons';
import AdminAddonCatalog from './src/pages/AdminAddonCatalog';
import AdminEmailDraft from './src/pages/AdminEmailDraft';
import AdminAppointmentManagement from './src/pages/AdminAppointmentManagement';
import ClientAppointmentBooking from './src/pages/ClientAppointmentBooking';
import ClientJetSuitePage from './src/pages/ClientJetSuitePage';
import AdminProfile from './src/pages/AdminProfile';
import AdminUserManagement from './src/pages/AdminUserManagement';
import AdminInbox from './src/pages/AdminInbox';
import ClientHelpPage from './src/pages/ClientHelpPage';
import ClientMessagingCompliance from './src/pages/ClientMessagingCompliance';
import ClientSettings from './src/pages/ClientSettings'; // NEW IMPORT
import TwilioConnectCallback from './src/pages/TwilioConnectCallback';

const AppContent: React.FC = () => {
  const location = useLocation();
  const { isLoading } = useAuth();
  const isBackOfficeRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/client') || location.pathname.startsWith('/back-office') || location.pathname === '/login';
  const showGlobalComponents = !isBackOfficeRoute;

  if (isLoading) return <GlobalLoading />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {showGlobalComponents && <Header />}
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/process" element={<ProcessPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/jetsuite" element={<JetSuitePage />} />
        <Route path="/jetviz" element={<JetVizPage />} />
        <Route path="/jet-local-optimizer" element={<JetLocalOptimizerPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/login" element={<LoginPage />} />
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
          <Route path="appointments" element={<AdminAppointmentManagement />} />
          <Route path="billing/products" element={<AdminBillingProducts />} />
          <Route path="billing/revenue" element={<AdminRevenueDashboard />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="settings/twilio" element={<AdminTwilioSettings />} />
          <Route path="ai-docs" element={<AdminDocumentGenerator />} />
          <Route path="ai-email" element={<AdminEmailGenerator />} />
          <Route path="email-draft" element={<AdminEmailDraft />} />
          <Route path="addons/catalog" element={<AdminAddonCatalog />} />
        </Route>

        <Route path="/client/*" element={<ProtectedRoute allowedRoles={['client']} />}>
          <Route path="dashboard" element={<ClientDashboard />} />
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
        </Route>
        
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      
      {showGlobalComponents && <Footer />}
      {showGlobalComponents && <VoiceAgent />}
    </div>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;