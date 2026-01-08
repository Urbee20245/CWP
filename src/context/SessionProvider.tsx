"use client";

import React, { createContext, useState, useEffect, useCallback } from 'react';
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

// Helper function to check and generate synthetic admin profile
const checkDevAdminBypass = (user: User | null): Profile | null => {
    if (DEV_ADMIN_MODE && user && user.email === DEV_ADMIN_EMAIL) {
        console.log("Dev Admin Bypass Active: Granting Admin Profile.");
        return {
            id: user.id,
            email: user.email,
            full_name: 'Dev Admin',
            role: 'admin',
            created_at: new Date().toISOString(),
        } as Profile;
    }
    return null;
};


const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    // Use maybeSingle() to handle cases where a user exists but no profile record has been created yet.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(); // Changed from .single()

    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } else if (data) {
      setProfile(data as Profile);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // Function to handle session and profile loading logic
    const loadSession = async (session: Session | null) => {
        if (session?.user) {
            setUser(session.user);
            
            // 2. Apply dev-admin bypass BEFORE profile fetching
            const syntheticProfile = checkDevAdminBypass(session.user);
            
            if (syntheticProfile) {
                setProfile(syntheticProfile);
            } else {
                // 4. Only fetch profile from Supabase if bypass is NOT active
                await fetchProfile(session.user.id);
            }
        } else {
            setUser(null);
            setProfile(null);
        }
        // 6. Ensure isLoading is always set to false
        setIsLoading(false);
    };

    // 1. Resolve Supabase session first (Initial check)
    supabase.auth.getSession().then(({ data: { session } }) => {
        loadSession(session);
    });

    // 1. Handle real-time auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Only handle explicit sign in/out events to avoid double-handling INITIAL_SESSION
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            // Set isLoading=true briefly to show the spinner during the transition
            setIsLoading(true); 
            loadSession(session);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
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