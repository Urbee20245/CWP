"use client";

import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { AuthContextType, Profile } from '../types/auth';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface SessionProviderProps {
  children: React.ReactNode;
}

// Read environment variables for dev bypass
const DEV_ADMIN_MODE = import.meta.env.VITE_DEV_ADMIN_MODE === 'true';
const DEV_ADMIN_EMAIL = import.meta.env.VITE_DEV_ADMIN_EMAIL;
const DEV_FORCE_ROLE = import.meta.env.VITE_DEV_FORCE_ROLE as 'admin' | 'client' | undefined;

// Helper function to check and generate synthetic admin profile
const checkDevAdminBypass = (user: User | null, fetchedProfile: Profile | null): Profile | null => {
    if (DEV_ADMIN_MODE && user && user.email === DEV_ADMIN_EMAIL) {
        if (fetchedProfile) {
            // Profile exists, use it
            return fetchedProfile;
        }

        if (DEV_FORCE_ROLE) {
            console.warn(`Dev Admin Bypass Active: Profile missing. Forcing role to '${DEV_FORCE_ROLE}'.`);
            return {
                id: user.id,
                email: user.email,
                full_name: 'Dev Admin (Forced)',
                role: DEV_FORCE_ROLE,
                created_at: new Date().toISOString(),
            } as Profile;
        }
    }
    return fetchedProfile;
};



const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ref tracks the currently-authenticated user ID so auth event handlers
  // can check it without a stale closure on `user` state.
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Use maybeSingle() to handle cases where a user exists but no profile record has been created yet.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as Profile | null;
  }, []);

  const loadSession = useCallback(async (session: Session | null) => {
    try {
        if (session?.user) {
            setUser(session.user);
            currentUserIdRef.current = session.user.id;

            // 1. Fetch profile from Supabase
            const fetchedProfile = await fetchProfile(session.user.id);

            // 2. Apply dev-admin bypass logic
            const finalProfile = checkDevAdminBypass(session.user, fetchedProfile);

            setProfile(finalProfile);
        } else {
            setUser(null);
            setProfile(null);
            currentUserIdRef.current = null;
        }
    } catch (e) {
        console.error("Error during session loading:", e);
    } finally {
        setIsLoading(false);
    }
  }, [fetchProfile]);


  useEffect(() => {
    let initialized = false;

    // Set up auth state listener FIRST
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!initialized) return; // Skip until initial session is loaded

        if (event === 'SIGNED_IN') {
          // If the same user is already loaded (e.g. returning to a tab after the
          // browser auto-refreshed the token), skip the full profile re-fetch.
          // This prevents dashboards from unmounting and re-fetching all their data
          // just because the user switched away and came back.
          if (currentUserIdRef.current && currentUserIdRef.current === session?.user?.id) {
            setIsLoading(false);
            return;
          }
          // Genuinely new sign-in: show loading gate while we fetch the profile.
          setIsLoading(true);
          await loadSession(session);
        } else if (event === 'TOKEN_REFRESHED') {
          // Background JWT rotation — update user silently.
          // Do NOT touch isLoading: setting it true would cause ProtectedRoute to
          // unmount the current page and destroy all its state (e.g. selectedClientId
          // in AdminWebsiteBuilder) for the duration of the profile re-fetch.
          if (session?.user) {
            setUser(session.user);
            currentUserIdRef.current = session.user.id;
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          currentUserIdRef.current = null;
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      }
    );

    // Then get the initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialized = true;
      loadSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadSession]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    currentUserIdRef.current = null;
  };

  const isAdmin = profile?.role === 'admin';
  const isClient = profile?.role === 'client';

  const value: AuthContextType = {
    user,
    profile,
    isLoading,
    isAdmin,
    isClient,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default SessionProvider;
