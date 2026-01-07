/**
 * useEmployeeAuth - Dedicated auth hook for the Employee Portal
 * 
 * CRITICAL: Uses employeeSupabase client with isolated storage key.
 * This prevents admin sessions from being "replayed" on /employee routes.
 */

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { employeeSupabase } from "@/integrations/supabase/employeeClient";

interface EmployeeAuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isEmployee: boolean;
  isAdmin: boolean;
  role: "employee" | "admin" | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | undefined>(undefined);

export const EmployeeAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<"employee" | "admin" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEmployeeRole = async (userId: string): Promise<"employee" | "admin" | null> => {
    try {
      const { data, error } = await employeeSupabase
        .from("user_roles")
        .select("role, status, is_active")
        .eq("user_id", userId)
        .in("role", ["employee", "admin"])
        .maybeSingle();

      if (error || !data) {
        console.log("[EmployeeAuth] No employee/admin role found for user", userId);
        return null;
      }

      // Must be active
      if (data.status !== "active" || data.is_active === false) {
        console.log("[EmployeeAuth] User role is not active:", data.status, data.is_active);
        return null;
      }

      return data.role as "employee" | "admin";
    } catch (err) {
      console.error("[EmployeeAuth] Error fetching role:", err);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await employeeSupabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const userRole = await fetchEmployeeRole(session.user.id);
          if (mounted) {
            setRole(userRole);
          }
        }
      } catch (error) {
        console.error("[EmployeeAuth] Error initializing:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Auth state listener
    const { data: { subscription } } = employeeSupabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log(`[EmployeeAuth] Auth state change: ${event}`);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer to avoid Supabase deadlock
          setTimeout(async () => {
            if (mounted) {
              const userRole = await fetchEmployeeRole(session.user.id);
              setRole(userRole);
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
    const { error } = await employeeSupabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    console.log("[EmployeeAuth] Signing out employee session");
    await employeeSupabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <EmployeeAuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isEmployee: role === "employee",
        isAdmin: role === "admin",
        role,
        signIn,
        signOut,
      }}
    >
      {children}
    </EmployeeAuthContext.Provider>
  );
};

/**
 * useEmployeeAuth - REQUIRES EmployeeAuthProvider wrapper
 * 
 * ⚠️ ONLY USE ON /employee/* ROUTES ⚠️
 */
export const useEmployeeAuth = () => {
  const context = useContext(EmployeeAuthContext);
  if (context === undefined) {
    throw new Error("useEmployeeAuth must be used within an EmployeeAuthProvider");
  }
  return context;
};
