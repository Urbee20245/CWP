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
                admin_role: 'super_admin', // Defaulting to super_admin for dev bypass
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

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Use maybeSingle() to handle cases where a user exists but no profile record has been created yet.
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, admin_role, created_at') // Select new admin_role field
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
            
            // 1. Fetch profile from Supabase
            const fetchedProfile = await fetchProfile(session.user.id);
            
            // 2. Apply dev-admin bypass logic
            const finalProfile = checkDevAdminBypass(session.user, fetchedProfile);
            
            setProfile(finalProfile);
        } else {
            setUser(null);
            setProfile(null);
        }
    } catch (e) {
        console.error("Error during session loading:", e);
    } finally {
        setIsLoading(false);
    }
  }, [fetchProfile]);


  useEffect(() => {
    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
        loadSession(session);
    });

    // Handle real-time auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Set loading true temporarily during state transition
        setIsLoading(true); 
        
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            // For SIGNED_IN, we rely on the new session object being passed
            loadSession(session);
        } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
            setIsLoading(false);
        } else {
            // For other events, ensure we still resolve loading state
            setIsLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [loadSession]);

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