"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { Shield, Mail, Phone, Lock, FileText, Eye, Globe, Users } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  useSEO({
    title: 'Privacy Policy | Custom Websites Plus',
    description: 'Custom Websites Plus Privacy Policy describing how we collect, use, and protect your personal information.',
    canonical: 'https://customwebsitesplus.com/privacy-policy',
  });

  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-bold uppercase tracking-wide mb-6">
            <Shield className="w-4 h-4" />
            <span>Legal Document</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Privacy Policy</h1>
          <p className="text-slate-600">Last updated: January 2026</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Contact Us</h2>
          <p className="text-slate-600 mb-6">
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <div className="space-y-4">
            <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-600" /> Email: <a href="mailto:hello@customwebsitesplus.com" className="text-indigo-600 hover:underline">hello@customwebsitesplus.com</a></p>
            <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-indigo-600" /> Phone: (470) 264-6256</p>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link to="/" className="text-indigo-600 hover:text-indigo-800 font-semibold">
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;