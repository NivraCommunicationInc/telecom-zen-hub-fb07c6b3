import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Influencer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  status: string;
  payout_method?: string;
  payout_email?: string;
  commission_plan_id?: string;
}

interface InfluencerAuthContextType {
  user: User | null;
  session: Session | null;
  influencer: Influencer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshInfluencer: () => Promise<void>;
}

const InfluencerAuthContext = createContext<InfluencerAuthContextType | undefined>(undefined);

export const InfluencerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInfluencer = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("influencers")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching influencer:", error);
        setInfluencer(null);
        return null;
      }

      setInfluencer(data);
      return data;
    } catch (error) {
      console.error("Error fetching influencer:", error);
      setInfluencer(null);
      return null;
    }
  };

  const refreshInfluencer = async () => {
    if (user?.id) {
      await fetchInfluencer(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer the influencer fetch to avoid auth deadlock
          setTimeout(() => fetchInfluencer(session.user.id), 0);
        } else {
          setInfluencer(null);
        }

        setIsLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchInfluencer(session.user.id);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setInfluencer(null);
  };

  const value = {
    user,
    session,
    influencer,
    isLoading,
    isAuthenticated: !!user && !!influencer && influencer.status === "active",
    signOut,
    refreshInfluencer,
  };

  return (
    <InfluencerAuthContext.Provider value={value}>
      {children}
    </InfluencerAuthContext.Provider>
  );
};

export const useInfluencerAuth = () => {
  const context = useContext(InfluencerAuthContext);
  if (!context) {
    throw new Error("useInfluencerAuth must be used within an InfluencerAuthProvider");
  }
  return context;
};
