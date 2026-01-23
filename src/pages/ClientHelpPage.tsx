import React from 'react';
import ClientLayout from '../components/ClientLayout';
import ClientHelpGuide from '../components/ClientHelpGuide';
import { HelpCircle } from 'lucide-react';

const ClientHelpPage: React.FC = () => {
  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <HelpCircle className="w-7 h-7 text-indigo-600" /> Help & Guides
        </h1>
        <ClientHelpGuide />
      </div>
    </ClientLayout>
  );
};

export default ClientHelpPage;