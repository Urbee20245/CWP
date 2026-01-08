"use client";

import React from 'react';
import { Loader2, Bot } from 'lucide-react';

const GlobalLoading: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 transition-opacity duration-300">
      <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-xl animate-pulse">
        <Bot className="w-8 h-8 text-white" />
      </div>
      <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
      <p className="text-sm font-medium text-slate-600">Loading Application...</p>
    </div>
  );
};

export default GlobalLoading;