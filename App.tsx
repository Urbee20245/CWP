import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import VoiceAgent from './components/VoiceAgent';
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
import AdminSmtpSettings from './src/pages/AdminSmtpSettings'; // New Import

// Component that uses useLocation to conditionally render global elements
const AppContent: React.FC = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  
  // Check if we are on an admin/client route (which use their own layouts)
  const isBackOfficeRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/client') || location.pathname.startsWith('/back-office');
  
  // We only want the global components (Header, Footer, VoiceAgent) on public pages, excluding login.
  const showGlobalComponents = !isBackOfficeRoute;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {showGlobalComponents && !isLoginPage && <Header />}
      
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/process" element={<ProcessPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/jetsuite" element={<JetSuitePage />} />
        <Route path="/jetviz" element={<JetVizPage />} />
        <Route path="/jet-local-optimizer" element={<JetLocalOptimizerPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Redirect Route */}
        <Route path="/back-office" element={<ProtectedRoute allowedRoles={['admin', 'client']} />}>
          <Route index element={<BackOfficeRedirect />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="clients" element={<AdminClientList />} />
          <Route path="clients/:id" element={<AdminClientDetail />} />
          <Route path="projects" element={<AdminProjectList />} />
          <Route path="projects/:id" element={<AdminProjectDetail />} />
          <Route path="billing/products" element={<AdminBillingProducts />} />
          <Route path="billing/revenue" element={<AdminRevenueDashboard />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="settings/smtp" element={<AdminSmtpSettings />} /> {/* New SMTP Route */}
          <Route path="ai-docs" element={<AdminDocumentGenerator />} />
          <Route path="ai-email" element={<AdminEmailGenerator />} />
        </Route>

        {/* Client Routes */}
        <Route path="/client/*" element={<ProtectedRoute allowedRoles={['client']} />}>
          <Route path="dashboard" element={<ClientDashboard />} />
          <Route path="projects/:id" element={<ClientProjectDetail />} />
          <Route path="billing" element={<ClientBilling />} />
        </Route>
      </Routes>
      
      {showGlobalComponents && <Footer />}
      {showGlobalComponents && <VoiceAgent />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppContent />
      </SessionProvider>
    </BrowserRouter>
  );
};

export default App;