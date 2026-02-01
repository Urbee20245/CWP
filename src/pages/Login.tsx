"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { Loader2, Mail, Lock, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const getResetRedirect = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/login?reset=1`;
  }
  return "/login?reset=1";
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const redirectTo = location?.state?.from?.pathname || "/back-office";

  // Sign-in form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Forgot-password UI
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Recovery (update password) UI
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reset link redirect (computed safely on mount)
  const [resetRedirect, setResetRedirect] = useState<string>(getResetRedirect());
  useEffect(() => {
    setResetRedirect(getResetRedirect());
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "1") {
      setIsRecoveryMode(true);
    }
  }, []);

  // Listen for Supabase PASSWORD_RECOVERY events
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    if (!email || !password) {
      setSignInError("Please enter your email and password.");
      return;
    }
    setSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setSignInError(err?.message || "Failed to sign in.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    if (!resetEmail || !/\S+@\S+\.\S+/.test(resetEmail)) {
      setResetMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: resetRedirect });
      if (error) throw error;
      setResetMessage({ type: "success", text: "Password reset email sent. Please check your inbox." });
    } catch (err: any) {
      setResetMessage({ type: "error", text: err?.message || "Failed to send reset email." });
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateMessage(null);
    if (!newPassword || newPassword.length < 6) {
      setUpdateMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setUpdateMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setUpdateMessage({ type: "success", text: "Password updated successfully. You can now sign in." });
      setIsRecoveryMode(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setUpdateMessage({ type: "error", text: err?.message || "Failed to update password." });
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome Back</h1>
        <p className="text-sm text-slate-600 mb-6">Sign in to your account</p>

        {!isRecoveryMode ? (
          <>
            <form onSubmit={handleSignIn} className="space-y-3">
              {signInError && (
                <div className="p-2 text-sm rounded border bg-red-50 text-red-800 border-red-200">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {signInError}
                  </span>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {signingIn ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {/* Forgot password */}
            <div className="mt-4">
              {!showReset ? (
                <button
                  onClick={() => setShowReset(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Forgot your password?
                </button>
              ) : (
                <div className="mt-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-600" /> Reset your password
                    </p>
                    <button onClick={() => setShowReset(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {resetMessage && (
                    <div
                      className={`mb-2 p-2 text-sm rounded border ${
                        resetMessage.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-red-50 text-red-800 border-red-200"
                      }`}
                    >
                      {resetMessage.type === "success" ? (
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> {resetMessage.text}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> {resetMessage.text}
                        </span>
                      )}
                    </div>
                  )}
                  <form onSubmit={handleSendReset} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email address</label>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      {resetLoading ? "Sending..." : "Send reset link"}
                    </button>
                  </form>
                  <p className="text-[11px] text-slate-500 mt-2">
                    We’ll email you a secure link to reset your password.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          // Password recovery UI
          <div className="mt-2">
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 mb-3">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" /> Set a new password
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Enter a new password for your account. After updating, you can sign in as usual.
              </p>
            </div>
            {updateMessage && (
              <div
                className={`mb-3 p-2 text-sm rounded border ${
                  updateMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {updateMessage.type === "success" ? (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {updateMessage.text}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {updateMessage.text}
                  </span>
                )}
              </div>
            )}
            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter a new password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="Re-enter your new password"
                />
              </div>
              <button
                type="submit"
                disabled={updatingPassword}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {updatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {updatingPassword ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;