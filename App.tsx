import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import ProblemSolution from './components/ProblemSolution';
import JetOptimizer from './components/JetOptimizer';
import JetViz from './components/JetViz';
import Services from './components/Services';
import TrustAuthority from './components/TrustAuthority';
import Stats from './components/Stats';
import Process from './components/ProcessPage';
import Contact from './components/Contact';
import Footer from './components/Footer';
import VoiceAgent from './components/VoiceAgent';
import JetLocalOptimizerPage from './components/JetLocalOptimizerPage';
import JetVizPage from './components/JetVizPage';
import JetSuitePage from './components/JetSuitePage';
import ServicesPage from './components/ServicesPage';
import ContactPage from './components/ContactPage';
import SessionProvider from './src/context/SessionProvider';
import LoginPage from './src/pages/LoginPage';
import ProtectedRoute from './src/components/ProtectedRoute';
import AdminDashboard from './src/pages/AdminDashboard';
import ClientDashboard from './src/pages/ClientDashboard';
import AdminClientDetail from './src/pages/AdminClientDetail';
import AdminProjectDetail from './src/pages/AdminProjectDetail';
import ClientProjectDetail from './src/pages/ClientProjectDetail';
import ClientBilling from './src/pages/ClientBilling';

const Home = () => (
  <main>
    <Hero />
    <ProblemSolution />
    {/* Tools Section */}
    <JetOptimizer />
    <JetViz />
    <Services />
    <TrustAuthority />
    <Stats />
    <Process />
    <Contact />
  </main>
);

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <SessionProvider>
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
          <Header />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/process" element={<Process />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/jetsuite" element={<JetSuitePage />} />
            <Route path="/jetviz" element={<JetVizPage />} />
            <Route path="/jet-local-optimizer" element={<JetLocalOptimizerPage />} />
            <Route path="/back-office/login" element={<LoginPage />} />

            {/* Admin Routes */}
            <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="clients/:id" element={<AdminClientDetail />} />
              <Route path="projects/:id" element={<AdminProjectDetail />} />
            </Route>

            {/* Client Routes */}
            <Route path="/client/*" element={<ProtectedRoute allowedRoles={['client']} />}>
              <Route path="dashboard" element={<ClientDashboard />} />
              <Route path="projects/:id" element={<ClientProjectDetail />} />
              <Route path="billing" element={<ClientBilling />} />
            </Route>
          </Routes>
          <Footer />
          <VoiceAgent />
        </div>
      </SessionProvider>
    </BrowserRouter>
  );
};

export default App;