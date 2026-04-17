import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import {
  readStoredImpersonation,
  type ImpersonationState,
} from "@/components/client/ImpersonationBanner";

type AppRole = "admin" | "client";

export interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  pin: string;
  serviceAddress?: string;
  serviceCity?: string;
  servicePostalCode?: string;
}

interface ClientAuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  /** True when the current effective identity comes from an admin impersonation token. */
  isImpersonating: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (data: SignupData) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

/**
 * Build a stand-in `User` object representing the impersonated client.
 * This is NOT a Supabase auth user — it's a presentation-layer identity used
 * by portal hooks/queries that read `user.id`. The admin remains authenticated
 * via portalSupabase under the hood, and admin RLS policies grant access to
 * the queried client data. All write actions are blocked by useWriteGuard.
 */
function buildImpersonatedUser(imp: ImpersonationState): User {
  return {
    id: imp.clientId,
    email: imp.clientEmail ?? undefined,
    user_metadata: {
      full_name: imp.clientName ?? undefined,
      impersonated: true,
    },
    app_metadata: { provider: "impersonation" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as unknown as User;
}

function buildImpersonatedSession(imp: ImpersonationState, user: User): Session {
  return {
    access_token: `impersonation:${imp.token}`,
    refresh_token: "",
    expires_at: Math.floor(new Date(imp.expiresAt).getTime() / 1000),
    expires_in: Math.max(0, Math.floor((new Date(imp.expiresAt).getTime() - Date.now()) / 1000)),
    token_type: "bearer",
    user,
  } as unknown as Session;
}


export const ClientAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(() =>
    readStoredImpersonation(),
  );

  // Keep impersonation state in sync with sessionStorage updates from the
  // ImpersonationProvider (which is the canonical writer once a token is
  // validated). We poll lightly because storage events don't fire in the same
  // tab; the cost is negligible (one read every 1.5s).
  useEffect(() => {
    const tick = () => {
      const next = readStoredImpersonation();
      setImpersonation((prev) => {
        if (!prev && !next) return prev;
        if (prev && next && prev.token === next.token) return prev;
        return next;
      });
    };
    const t = setInterval(tick, 1500);
    window.addEventListener("storage", tick);
    return () => {
      clearInterval(t);
      window.removeEventListener("storage", tick);
    };
  }, []);

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

  const signUp = async (data: SignupData) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data: authData, error } = await portalSupabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: `${data.firstName} ${data.lastName}`,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          client_pin: data.pin,
        },
      },
    });
    
    // If signup successful, update the profile with additional data
    if (!error && authData?.user) {
      try {
        await portalSupabase.from("profiles").upsert({
          user_id: authData.user.id,
          full_name: `${data.firstName} ${data.lastName}`,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          client_pin: data.pin,
          email: data.email,
          service_address: data.serviceAddress || null,
          service_city: data.serviceCity || null,
          service_postal_code: data.servicePostalCode?.replace(/\s/g, "").toUpperCase() || null,
          service_province: "QC",
        }, { onConflict: "user_id" });
      } catch (profileError) {
        console.error("Error updating profile:", profileError);
      }
    }
    
    return { error };
  };

  const signOut = async () => {
    await portalSupabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const resetPassword = async (email: string) => {
    // IMPORTANT: We do NOT use the default auth email template.
    // We send a branded email via backend so the client receives a professional message with a proper CTA.
    const { error } = await portalSupabase.functions.invoke("client-password-reset-send", {
      body: {
        email,
        redirect_origin: window.location.origin,
      },
    });
    return { error: (error as unknown as Error) ?? null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await portalSupabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  // ── EFFECTIVE IDENTITY ──────────────────────────────────────────────
  // When an admin impersonation token is active, override `user`/`session`
  // so portal pages (which all read `user.id`) automatically scope queries
  // to the impersonated client. Admin remains authenticated under the hood
  // via portalSupabase; admin RLS grants read access to client data.
  const effectiveUser: User | null = impersonation
    ? buildImpersonatedUser(impersonation)
    : user;
  const effectiveSession: Session | null = impersonation
    ? buildImpersonatedSession(impersonation, buildImpersonatedUser(impersonation))
    : session;
  const isImpersonating = !!impersonation;

  // While we're loading the real auth session AND a pending impersonation
  // token exists, we should not appear "loading" forever — the banner provider
  // resolves the token in parallel. Surface impersonation as ready immediately.
  const effectiveIsLoading = isImpersonating ? false : isLoading;

  return (
    <ClientAuthContext.Provider
      value={{
        user: effectiveUser,
        session: effectiveSession,
        role: isImpersonating ? "client" : role,
        isLoading: effectiveIsLoading,
        isAdmin: !isImpersonating && role === "admin",
        isImpersonating,
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
