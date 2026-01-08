"use client";

import React from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import VoiceAgent from '../../components/VoiceAgent';

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