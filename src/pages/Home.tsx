import React from 'react';
import Hero from '@/components/Hero';
import ProblemSolution from '@/components/ProblemSolution';
import JetOptimizer from '@/components/JetOptimizer';
import JetViz from '@/components/JetViz';
import Services from '@/components/Services';
import TrustAuthority from '@/components/TrustAuthority';
import Stats from '@/components/Stats';
import Process from '@/components/ProcessPage';
import Contact from '@/components/Contact';

const Home: React.FC = () => (
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

export default Home;