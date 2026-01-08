import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Home from './src/pages/Home';
import JetLocalOptimizerPage from './components/JetLocalOptimizerPage';
import JetVizPage from './components/JetVizPage';
import JetSuitePage from './components/JetSuitePage';
import ServicesPage from './components/ServicesPage';
import ContactPage from './components/ContactPage';
import ProcessPage from './components/ProcessPage';
import SessionProvider from './src/context/SessionProvider';
import LoginPage from './src/pages/LoginPage';
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
import AdminSmtpSettings from './src/pages/AdminSmtpSettings';
import AdminTwilioSettings from './src/pages/AdminTwilioSettings';
import NotFoundPage from './src/pages/NotFoundPage';
import ErrorBoundary from './src/components/ErrorBoundary';
import GlobalLoading from './src/components/GlobalLoading';
import { useAuth } from './src/hooks/useAuth';
import PublicLayout from './src/components/PublicLayout'; // New Import
import AuthLayout from './src/components/AuthLayout'; // New Import

// Component that uses useLocation to conditionally render global elements
const AppContent: React.FC = () => {
  const { isLoading } = useAuth();

  // Show global loading screen if session is still initializing
  if (isLoading) {
    return <GlobalLoading />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Routes>
        {/* Public Routes (Wrapped in PublicLayout) */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/process" element={<ProcessPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/jetsuite" element={<JetSuitePage />} />
          <Route path="/jetviz" element={<JetVizPage />} />
          <Route path="/jet-local-optimizer" element={<JetLocalOptimizerPage />} />
        </Route>
        
        {/* Auth Routes (Wrapped in AuthLayout) */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        
        {/* Protected Redirect Route (Uses AuthLayout for initial check/redirect) */}
        <Route path="/back-office" element={<ProtectedRoute allowedRoles={['admin', 'client']} />}>
          <Route index element={<BackOfficeRedirect />} />
        </Route>

        {/* Admin Routes (Use AdminLayout internally) */}
        <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="clients" element={<AdminClientList />} />
          <Route path="clients/:id" element={<AdminClientDetail />} />
          <Route path="projects" element={<AdminProjectList />} />
          <Route path="projects/:id" element={<AdminProjectDetail />} />
          <Route path="billing/products" element={<AdminBillingProducts />} />
          <Route path="billing/revenue" element={<AdminRevenueDashboard />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="settings/smtp" element={<AdminSmtpSettings />} />
          <Route path="settings/twilio" element={<AdminTwilioSettings />} />
          <Route path="ai-docs" element={<AdminDocumentGenerator />} />
          <Route path="ai-email" element={<AdminEmailGenerator />} />
        </Route>

        {/* Client Routes (Use ClientLayout internally) */}
        <Route path="/client/*" element={<ProtectedRoute allowedRoles={['client']} />}>
          <Route path="dashboard" element={<ClientDashboard />} />
          <Route path="projects/:id" element={<ClientProjectDetail />} />
          <Route path="billing" element={<ClientBilling />} />
        </Route>
        
        {/* Global 404 Fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SessionProvider>
          <AppContent />
        </SessionProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;