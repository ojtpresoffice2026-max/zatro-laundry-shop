
import {
  createContext,
  useCallback,
  useEffect,
  useRef,
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

  // Prevent outdated profile requests from overwriting newer sessions.
  const requestId = useRef(0);

  const clearAuth = useCallback(() => {
    requestId.current += 1;
    setUser(null);
    setProfile(null);
    setLoading(false);
  }, []);

  const loadUserProfile = useCallback(
    async (currentUser: User) => {
      const currentRequest = ++requestId.current;

      setLoading(true);

      try {
        const userProfile = await getUserProfile(currentUser.id);

        if (
          userProfile.role !== "admin" ||
          userProfile.is_active !== true
        ) {
          throw new Error(
            "Access denied. Only active administrators can use ZATRO."
          );
        }

        if (currentRequest !== requestId.current) return;

        setUser(currentUser);
        setProfile(userProfile);
      } catch (error) {
        if (currentRequest !== requestId.current) return;

        console.error("Administrator verification failed:", error);

        setUser(null);
        setProfile(null);

        await supabase.auth.signOut();
      } finally {
        if (currentRequest === requestId.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    try {
      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();

      if (error || !currentUser) {
        clearAuth();
        return;
      }

      await loadUserProfile(currentUser);
    } catch (error) {
      console.error("Session verification failed:", error);
      clearAuth();
    }
  }, [clearAuth, loadUserProfile]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Validate the session with Supabase.
        const {
          data: { user: currentUser },
          error,
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error || !currentUser) {
          clearAuth();
          return;
        }

        await loadUserProfile(currentUser);
      } catch (error) {
        console.error("Initial authentication error:", error);

        if (mounted) {
          clearAuth();
        }
      }
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        clearAuth();
        return;
      }

      // Avoid duplicating the initial session check.
      if (event === "INITIAL_SESSION") return;

      // Run profile verification outside the auth callback.
      void Promise.resolve().then(async () => {
        if (!mounted) return;

        await loadUserProfile(session.user);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearAuth, loadUserProfile]);

  const signIn = async (data: LoginData) => {
    await loginUser(data);
    await refreshProfile();

    // Do not allow login to continue without a valid admin profile.
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      throw new Error("Login verification failed.");
    }

    const userProfile = await getUserProfile(currentUser.id);

    if (
      userProfile.role !== "admin" ||
      userProfile.is_active !== true
    ) {
      await supabase.auth.signOut();
      clearAuth();

      throw new Error(
        "Access denied. Only active administrators can use ZATRO."
      );
    }
  };

  const signOut = async () => {
    try {
      await logoutUser();
    } finally {
      clearAuth();
    }
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
