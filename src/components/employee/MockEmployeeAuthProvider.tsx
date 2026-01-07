/**
 * DEV-ONLY: Mock Employee Auth Provider
 * Provides a mocked authentication context for QA smoke testing
 * ONLY used in /qa/* routes when import.meta.env.DEV is true
 */
import { createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "employee" | "client";

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

const MockAuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user data for QA testing
const mockUser: User = {
  id: "mock-employee-id-for-qa-testing",
  email: "e***@nivra.ca",
  app_metadata: {},
  user_metadata: { full_name: "QA Test Employee" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as User;

const mockSession: Session = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: "bearer",
  user: mockUser,
} as Session;

export const MockEmployeeAuthProvider = ({ children }: { children: ReactNode }) => {
  // Only allow in DEV mode
  if (!import.meta.env.DEV) {
    return null;
  }

  const mockValue: AuthContextType = {
    user: mockUser,
    session: mockSession,
    role: "employee",
    isLoading: false,
    isAdmin: false,
    signIn: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signOut: async () => {},
    resetPassword: async () => ({ error: null }),
    updatePassword: async () => ({ error: null }),
  };

  return (
    <MockAuthContext.Provider value={mockValue}>
      {children}
    </MockAuthContext.Provider>
  );
};

/**
 * Hook that returns mock auth context for QA pages
 * Falls back to empty values if not wrapped in MockEmployeeAuthProvider
 */
export const useMockAuth = (): AuthContextType => {
  const context = useContext(MockAuthContext);
  if (context === undefined) {
    // Return mock values even without provider
    return {
      user: mockUser,
      session: mockSession,
      role: "employee",
      isLoading: false,
      isAdmin: false,
      signIn: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
      signOut: async () => {},
      resetPassword: async () => ({ error: null }),
      updatePassword: async () => ({ error: null }),
    };
  }
  return context;
};
