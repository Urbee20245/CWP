import { User } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'client';
  created_at: string;
};

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isClient: boolean;
  signOut: () => Promise<void>;
}