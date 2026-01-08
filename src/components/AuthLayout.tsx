"use client";

import React from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ErrorBoundary from './ErrorBoundary';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const { isLoading } = useAuth();

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        {/* Logo/Branding */}
        <div className="mb-8 text-center">
            <img 
                src="/CWPlogolight.png" 
                alt="Custom Websites Plus" 
                className="h-16 w-auto mx-auto object-contain"
            />
        </div>
        
        {/* Content Area */}
        <div className="w-full max-w-md">
            {isLoading ? (
                <div className="min-h-[400px] flex flex-col items-center justify-center bg-white rounded-2xl shadow-xl border border-slate-200">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                    <p className="text-sm text-slate-600">Checking Session...</p>
                </div>
            ) : (
                children
            )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AuthLayout;