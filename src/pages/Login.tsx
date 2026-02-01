"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../integrations/supabase/client";
import { Loader2, Mail, Lock, CheckCircle2, AlertTriangle, X } from "lucide-react";

const RESET_REDIRECT = `${window.location.origin}/login?reset=1`;

const Login: React.FC = () => {
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Determine if we landed here from the reset link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "1") {
      setIsRecoveryMode(true);
    }
  }, []);

  // Ask Supabase to mark the session in recovery mode if there is a type=recovery event
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
    });
    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage(null);
    if (!resetEmail || !/\S+@\S+\.\S+/.test(resetEmail)) {
      setResetMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: RESET_REDIRECT });
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

  const authAppearance = useMemo(
    () => ({
      theme: ThemeSupa,
      variables: {
        default: {
          colors: {
            brand: "#4f46e5",
            brandAccent: "#4338ca",
          },
          radii: {
            borderRadiusButton: "8px",
            inputBorderRadius: "8px",
          },
        },
      },
    }),
    []
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome Back</h1>
        <p className="text-sm text-slate-600 mb-6">Sign in to your account</p>

        {!isRecoveryMode ? (
          <>
            <Auth supabaseClient={supabase} providers={[]} appearance={authAppearance} theme="light" onlyThirdPartyProviders={false} />

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