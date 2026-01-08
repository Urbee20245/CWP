"use client";

import React from 'react';
import Header from './Header';
import Footer from './Footer';
import VoiceAgent from './VoiceAgent';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <VoiceAgent />
    </>
  );
};

export default PublicLayout;