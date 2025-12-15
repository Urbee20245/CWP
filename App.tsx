import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import ProblemSolution from './components/ProblemSolution';
import JetViz from './components/JetViz';
import JetOptimizer from './components/JetOptimizer';
import Services from './components/Services';
import TrustAuthority from './components/TrustAuthority';
import Stats from './components/Stats';
import Process from './components/Process';
import Contact from './components/Contact';
import Footer from './components/Footer';
import VoiceAgent from './components/VoiceAgent';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Header />
      <main>
        <Hero />
        <ProblemSolution />
        <JetViz />
        <JetOptimizer />
        <Services />
        <TrustAuthority />
        <Stats />
        <Process />
        <Contact />
      </main>
      <Footer />
      <VoiceAgent />
    </div>
  );
};

export default App;