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
      <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/process" element={<Process />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/jetsuite" element={<JetSuitePage />} />
          <Route path="/jetviz" element={<JetVizPage />} />
          <Route path="/jet-local-optimizer" element={<JetLocalOptimizerPage />} />
        </Routes>
        <Footer />
        <VoiceAgent />
      </div>
    </BrowserRouter>
  );
};

export default App;