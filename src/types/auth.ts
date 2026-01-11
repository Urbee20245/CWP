import { User } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'client';
  admin_role: 'super_admin' | 'project_manager' | 'billing_manager' | 'support_agent' | string; // Added admin_role
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