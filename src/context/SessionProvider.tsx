"use client";

import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { AuthContextType, Profile } from '../types/auth';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface SessionProviderProps {
  children: React.ReactNode;
}

const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } else if (data) {
      setProfile(data as Profile);
    }
  }, []);

  useEffect(() => {
    // 1. Handle real-time auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          // Ensure profile is fetched on sign in/initial session
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        // Set loading to false after processing the event
        setIsLoading(false);
      }
    );

    // 2. Initial check (in case listener is slow or missed)
    // We use this to ensure the initial state is set correctly on mount.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        // Await profile fetch here too, to ensure initial render has profile data
        await fetchProfile(session.user.id);
      }
      // Set loading to false after initial check and profile fetch attempt
      setIsLoading(false);
    });

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