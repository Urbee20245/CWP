"use client";

import React, { useState, useRef } from 'react';
import { Bot, Loader2, LogIn, UserPlus, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ReCAPTCHA from 'react-google-recaptcha';
import { AuthService } from '../services/authService';
import { supabase } from '../integrations/supabase/client'; // Import supabase client

// NOTE: This key must be set in .env.local or Vercel environment variables
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false); 
  
  // Ref for reCAPTCHA component to manually trigger token generation
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  
  const navigate = useNavigate();
  const { user, isLoading } = useAuth(); 

  // If user is already logged in and session is loaded, redirect immediately
  if (!isLoading && user) {
    navigate('/back-office', { replace: true });
    return null; 
  }
  
  const executeRecaptcha = async (action: 'login' | 'signup') => {
    if (!recaptchaRef.current) {
        setError("reCAPTCHA is not initialized. Please ensure VITE_RECAPTCHA_SITE_KEY is set.");
        return null;
    }
    
    // Manually execute reCAPTCHA v3 to get a token
    const token = await recaptchaRef.current.execute(action);
    console.log("recaptcha_token_acquired");
    return token;
  };

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSignupSuccess(false);
    
    console.log("login_start");
    
    const actionType = isSignupMode ? 'signup' : 'login';
    const recaptchaToken = await executeRecaptcha(actionType);

    if (!recaptchaToken) {
        setLoading(false);
        return; 
    }

    try {
        console.log("edge_invoke_start");
        const result = actionType === 'login' 
            ? await AuthService.secureLogin(email, password, recaptchaToken)
            : await AuthService.secureSignup(email, password, recaptchaToken);
            
        console.log(`edge_invoke_result: ${actionType} success`, result);
        
        if (actionType === 'login' || (actionType === 'signup' && result.access_token)) {
            
            // STEP 2: Set the session explicitly on the client
            if (result.access_token && result.refresh_token) {
                await supabase.auth.setSession({
                    access_token: result.access_token,
                    refresh_token: result.refresh_token,
                });
                console.log("session_set_success");
            }
            
            // STEP 3: Redirect immediately after session is set
            console.log("redirecting_after_login");
            setIsRedirecting(true); 
            navigate('/back-office', { replace: true });
            
        } else if (actionType === 'signup' && result.user && !result.access_token) {
            // Standard signup flow requiring email confirmation
            setSignupSuccess(true);
            setEmail('');
            setPassword('');
        }
        
    } catch (e: any) {
        console.error("Authentication failed:", e);
        
        let userFriendlyError = e.message || `${actionType} failed. Check credentials or try again.`;
        
        // Check for the generic security error message from the Edge Function
        if (userFriendlyError.includes('Invalid login credentials')) {
            userFriendlyError = "The email or password you entered is incorrect. Please double-check your credentials.";
        }
        
        setError(userFriendlyError);
    } finally {
        setLoading(false);
        recaptchaRef.current?.reset();
    }
  }

  // STEP 4: Combine global loading and local redirect loading
  if (isLoading || isRedirecting) {
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
                <form onSubmit={handleAuth} className="space-y-6">
                    {error && (
                        <div className="p-3 mb-4 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm flex items-center gap-2">
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
                    
                    {/* Invisible ReCAPTCHA v3 Component */}
                    <div className="flex justify-center">
                        {RECAPTCHA_SITE_KEY ? (
                            <ReCAPTCHA
                                ref={recaptchaRef}
                                sitekey={RECAPTCHA_SITE_KEY}
                                size="invisible" // Use invisible size for v3
                            />
                        ) : (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                ⚠️ ReCAPTCHA Key Missing. Set VITE_RECAPTCHA_SITE_KEY.
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {isSignupMode ? 'Signing Up...' : 'Signing In...'}
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