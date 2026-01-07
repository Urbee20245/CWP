"use client";

import React, { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';
import { Bot } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { user, profile, isLoading } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  // Redirect authenticated users based on role
  useEffect(() => {
    if (user && profile) {
      const targetPath = profile.role === 'admin' ? '/admin/dashboard' : '/client/dashboard';
      if (from !== '/back-office/login' && from.startsWith(`/${profile.role}`)) {
        // If user was trying to access a specific protected route, send them there
        window.location.replace(from);
      } else {
        // Otherwise, send them to their default dashboard
        window.location.replace(targetPath);
      }
    }
  }, [user, profile, from]);

  if (isLoading || (user && !profile)) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center pt-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user && profile) {
    // Already authenticated and profile loaded, waiting for redirect
    return (
      <div className="min-h-[80vh] flex items-center justify-center pt-20">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12 flex items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-3">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Back Office Login</h1>
          <p className="text-sm text-slate-500">Access your client portal or admin dashboard.</p>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#4F46E5', // Indigo-600
                  brandAccent: '#6366F1', // Indigo-500
                },
              },
            },
          }}
          providers={[]}
          view="sign_in"
          redirectTo={window.location.origin + '/back-office/login'}
        />
      </div>
    </div>
  );
};

export default LoginPage;