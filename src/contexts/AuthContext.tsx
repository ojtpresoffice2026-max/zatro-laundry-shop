import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

import {
  loginUser,
  logoutUser,
  getUserProfile,
} from "../services/authService";

import type {
  AuthContextType,
  UserProfile,
  LoginData,
} from "../types/auth";

export const AuthContext = createContext<
  AuthContextType | undefined
>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !currentUser) {
      setUser(null);
      setProfile(null);
      return;
    }

    try {
      const userProfile = await getUserProfile(currentUser.id);

      setUser(currentUser);
      setProfile(userProfile);
    } catch {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);

      throw new Error(
        "Access denied. Only active administrators can use ZATRO."
      );
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!mounted) return;

        if (session?.user) {
          try {
            const userProfile = await getUserProfile(session.user.id);

            if (!mounted) return;

            setUser(session.user);
            setProfile(userProfile);
          } catch {
            await supabase.auth.signOut();

            if (!mounted) return;

            setUser(null);
            setProfile(null);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Session loading error:", error);

        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setProfile(null);
        return;
      }

      if (event === "INITIAL_SESSION") return;

      // Fetch the profile outside the Supabase auth callback.
      void Promise.resolve().then(async () => {
        try {
          const userProfile = await getUserProfile(session.user.id);

          if (!mounted) return;

          setUser(session.user);
          setProfile(userProfile);
        } catch {
          await supabase.auth.signOut();

          if (!mounted) return;

          setUser(null);
          setProfile(null);
        }
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (data: LoginData) => {
    await loginUser(data);
    await refreshProfile();
  };

  const signOut = async () => {
    await logoutUser();
    setUser(null);
    setProfile(null);
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}