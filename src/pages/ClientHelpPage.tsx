import React, { useState } from 'react';
import ClientLayout from '../components/ClientLayout';
import ClientHelpGuide from '../components/ClientHelpGuide';
import { HelpCircle, Search } from 'lucide-react';

const ClientHelpPage: React.FC = () => {
  const [filter, setFilter] = useState('');

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
          <HelpCircle className="w-7 h-7 text-indigo-600" /> Help & Guides
        </h1>
        
        {/* Search Bar */}
        <div className="mb-8 relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
                type="text"
                placeholder="Search guides (e.g., files, appointments, twilio)"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-4 py-3 pl-12 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none transition-all"
            />
        </div>

        <ClientHelpGuide filter={filter} />
      </div>
    </ClientLayout>
  );
};

export default ClientHelpPage;