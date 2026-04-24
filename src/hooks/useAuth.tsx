import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";

type AppRole = "admin" | "client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await adminSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setRole(data.role as AppRole);
      } else {
        setRole("client");
      }
    } catch {
      setRole("client");
    }
  };

  useEffect(() => {
    let mounted = true;

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await adminSupabase.auth.getSession();
        
        console.log("[AdminAuth] initial getSession", { hasSession: !!session });
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserRole(session.user.id);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state listener
    const { data: { subscription } } = adminSupabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log("[AdminAuth] event", event, { hasSession: !!session });
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => {
            if (mounted) {
              fetchUserRole(session.user.id);
            }
          }, 0);
        } else {
          setRole(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await adminSupabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await adminSupabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await adminSupabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/hub/reset-password`;
    const { error } = await adminSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await adminSupabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isLoading,
        isAdmin: role === "admin",
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth - REQUIRES AuthProvider wrapper
 * 
 * ⚠️  DO NOT USE ON PUBLIC ROUTES ⚠️
 * Public pages (/internet, /tv, /mobile, etc.) are NOT wrapped in AuthProvider.
 * Using this hook on those pages will cause a blank page crash.
 * 
 * For public routes, use useOptionalAuth() instead.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/**
 * useOptionalAuth - SAFE for public routes
 * 
 * ✅ USE THIS ON PUBLIC PAGES (/internet, /tv, /mobile, etc.)
 * Returns null/default values when AuthProvider is not present.
 * Never throws, never causes blank pages.
 */
export const useOptionalAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      session: null,
      role: null,
      isLoading: false,
      isAdmin: false,
      signIn: async () => ({ error: new Error("No auth provider") }),
      signUp: async () => ({ error: new Error("No auth provider") }),
      signOut: async () => {},
      resetPassword: async () => ({ error: new Error("No auth provider") }),
      updatePassword: async () => ({ error: new Error("No auth provider") }),
    };
  }
  return context;
};
