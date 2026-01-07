import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { portalSupabase } from "@/integrations/backend/portalClient";

type AppRole = "admin" | "client";

interface ClientAuthContextType {
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

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export const ClientAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await portalSupabase
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

  // SECURITY GUARDRAIL: Verify profile matches session user
  const verifyProfileMatch = useCallback(async (sessionUserId: string) => {
    try {
      const { data: profile, error } = await portalSupabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", sessionUserId)
        .maybeSingle();

      // If profile exists and doesn't match session user, force logout
      if (profile && profile.user_id !== sessionUserId) {
        console.error("SECURITY: user/profile mismatch detected, forcing logout");
        await portalSupabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRole(null);
        window.location.href = "/portal/auth";
        return false;
      }

      return true;
    } catch (err) {
      console.warn("Profile verification error (non-critical):", err);
      return true; // Allow if profile doesn't exist yet
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await portalSupabase.auth.getSession();

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Verify profile match before proceeding
          const isValid = await verifyProfileMatch(session.user.id);
          if (isValid) {
            await fetchUserRole(session.user.id);
          }
        }
      } catch (error) {
        console.error("Error initializing client auth:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = portalSupabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Avoid Supabase deadlock by deferring DB calls
        setTimeout(() => {
          if (mounted) {
            verifyProfileMatch(session.user.id).then((isValid) => {
              if (isValid) {
                fetchUserRole(session.user.id);
              }
            });
          }
        }, 0);
      } else {
        setRole(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [verifyProfileMatch]);

  const signIn = async (email: string, password: string) => {
    const { error } = await portalSupabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await portalSupabase.auth.signUp({
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
    await portalSupabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/portal/auth?reset=true`;
    const { error } = await portalSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await portalSupabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  return (
    <ClientAuthContext.Provider
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
    </ClientAuthContext.Provider>
  );
};

export const useClientAuth = () => {
  const context = useContext(ClientAuthContext);
  if (context === undefined) {
    throw new Error("useClientAuth must be used within a ClientAuthProvider");
  }
  return context;
};
