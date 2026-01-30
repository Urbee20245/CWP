"use client";

import React from 'react';
import { Shield, Bot, Mail, Phone, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';

const PrivacyPolicy: React.FC = () => {
  useSEO({
    title: 'Privacy Policy | Custom Websites Plus',
    description: 'Learn how Custom Websites Plus collects, uses, and protects your personal data. Covers AI interaction data, contact information, and security measures.',
    canonical: 'https://customwebsitesplus.com/privacy-policy',
  });

  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 md:p-12">
          
          <Link to="/" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-6 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Homepage
          </Link>
          
          <h1 className="text-4xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600" /> Privacy Policy
          </h1>
          <p className="text-slate-500 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="space-y-8 text-slate-700 leading-relaxed">
            
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">1. Introduction</h2>
              <p>
                Custom Websites Plus ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our services, or interact with our AI tools.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">2. Information We Collect</h2>
              <p>We collect information that identifies, relates to, describes, or is capable of being associated with you ("Personal Data").</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mt-3">
                <li><strong>Contact Data:</strong> Name, email address, phone number, and business name provided via contact forms or consultation requests.</li>
                <li><strong>Usage Data:</strong> Information about how you access and use our website, including IP address, browser type, and pages viewed.</li>
                <li><strong>AI Interaction Data:</strong> Transcripts of chat conversations and voice recordings when interacting with our Luna AI agent or using JetSuite tools. This data is processed by Google Gemini for service delivery.</li>
                <li><strong>Technical Analysis Data:</strong> URLs and technical metrics (Core Web Vitals, SEO structure) submitted to our Jet Local Optimizer tool.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">3. Use of Your Information</h2>
              <p>We use the information collected for the following purposes:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mt-3">
                <li>To provide, operate, and maintain our services (website rebuilds, SEO, AI integration).</li>
                <li>To process transactions and send related information, including invoices and confirmations.</li>
                <li>To communicate with you, including responding to inquiries and sending service updates.</li>
                <li>To monitor and analyze usage and trends to improve our website and services.</li>
                <li>To enhance security and prevent fraudulent activity (including reCAPTCHA verification).</li>
              </ul>
            </section>
            
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Bot className="w-6 h-6 text-indigo-600" /> AI Data Handling
              </h2>
              <p>
                When you use our AI tools (Luna, JetSuite), your inputs (text, voice, URLs) are processed by Google's Gemini API. We do not use this data to train the underlying Gemini models. We retain interaction data only as necessary to fulfill your service requests and improve our internal tools.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">4. Security</h2>
              <p>
                We use administrative, technical, and physical security measures to help protect your Personal Data. While we have taken reasonable steps to secure the Personal Data you provide to us, please be aware that no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">5. Contact Us</h2>
              <p>If you have questions or comments about this Privacy Policy, please contact us at:</p>
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-600" /> Email: <a href="mailto:hello@customwebsitesplus.com" className="text-indigo-600 hover:underline">hello@customwebsitesplus.com</a></p>
                <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-indigo-600" /> Phone: (844) 213-0694</p>
              </div>
            </section>
            
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm mt-10">
                <strong>Legal Disclaimer:</strong> This policy is provided for informational purposes only and is AI-assisted. It does not constitute legal advice. Please consult with a legal professional to ensure compliance with all applicable laws.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;