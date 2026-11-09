import type { User } from "@supabase/supabase-js";

export type UserRole = "admin";

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (data: LoginData) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}