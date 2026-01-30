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
import { useSEO } from '../hooks/useSEO';

const Home: React.FC = () => {
  useSEO({
    title: 'Custom Websites Plus | Atlanta Web Design & AI Solutions',
    description: 'Custom Websites Plus offers professional web design, AI integration, SEO optimization, and digital solutions for businesses in Atlanta and beyond.',
    canonical: 'https://customwebsitesplus.com/',
  });

  return (
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
};

export default Home;