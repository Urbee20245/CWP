"use client";

import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Bot, Loader2, LogIn, UserPlus, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ReCAPTCHA from 'react-google-recaptcha';
import { AuthService } from '../services/authService';

// NOTE: This key must be set in .env.local or Vercel environment variables
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { user, isLoading } = useAuth(); 

  // If user is already logged in and session is loaded, redirect immediately
  if (!isLoading && user) {
    navigate('/back-office', { replace: true });
    return null; 
  }
  
  const handleRecaptchaChange = (token: string | null) => {
    setRecaptchaToken(token);
    if (error) setError(null); // Clear error when user interacts with reCAPTCHA
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!recaptchaToken) {
        setError("Please complete the security check.");
        setLoading(false);
        return;
    }

    try {
        // Use secure Edge Function for reCAPTCHA verification + login
        await AuthService.secureLogin(email, password, recaptchaToken);
        
        // Successful login. SessionProvider handles the final redirect.
        navigate('/back-office', { replace: true });
    } catch (e: any) {
        setError(e.message || "Login failed. Check credentials or try again.");
        setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSignupSuccess(false);
    
    if (!recaptchaToken) {
        setError("Please complete the security check.");
        setLoading(false);
        return;
    }

    try {
        // Use secure Edge Function for reCAPTCHA verification + signup
        const result = await AuthService.secureSignup(email, password, recaptchaToken);
        
        if (result.data.user && !result.data.session) {
            // Successful signup, but email confirmation required
            setSignupSuccess(true);
            setEmail('');
            setPassword('');
        } else {
            // Should not happen if email confirmation is enabled, but handle direct sign-in if it occurs
            navigate('/back-office', { replace: true });
        }
    } catch (e: any) {
        setError(e.message || "Signup failed. Please try again.");
    } finally {
        setLoading(false);
    }
  }

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center pt-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 pt-20">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            <Link to="/" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mb-4 flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to Homepage
            </Link>
            
            <div className="text-center mb-8">
                <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bot className="w-6 h-6 text-indigo-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{isSignupMode ? 'Create Account' : 'Client Portal Login'}</h1>
                <p className="text-sm text-slate-500">Access your project dashboard.</p>
            </div>

            {signupSuccess ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <h3 className="font-bold text-emerald-800 mb-2">Success! Check your email.</h3>
                    <p className="text-sm text-emerald-700">A confirmation link has been sent to your email address. Please click the link to complete registration.</p>
                    <button type="button" onClick={() => { setIsSignupMode(false); setSignupSuccess(false); }} className="mt-4 text-indigo-600 text-sm font-medium hover:text-indigo-800">
                        Return to Login
                    </button>
                </div>
            ) : (
                <form onSubmit={isSignupMode ? handleSignup : handleLogin} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                            required
                            disabled={loading}
                        />
                    </div>
                    
                    {/* ReCAPTCHA Component */}
                    <div className="flex justify-center">
                        {RECAPTCHA_SITE_KEY ? (
                            <ReCAPTCHA
                                sitekey={RECAPTCHA_SITE_KEY}
                                onChange={handleRecaptchaChange}
                                onExpired={() => setRecaptchaToken(null)}
                                theme="light"
                            />
                        ) : (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                ⚠️ ReCAPTCHA Key Missing. Set VITE_RECAPTCHA_SITE_KEY.
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !recaptchaToken}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {isSignupMode ? 'Signing Up...' : 'Logging In...'}
                            </>
                        ) : (
                            <>
                                {isSignupMode ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                                {isSignupMode ? 'Sign Up' : 'Log In'}
                            </>
                        )}
                    </button>
                    
                    <div className="text-center pt-4 border-t border-slate-100">
                        <button 
                            type="button"
                            onClick={() => setIsSignupMode(p => !p)}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            disabled={loading}
                        >
                            {isSignupMode ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    </div>
  );
}