/**
 * useIsCoreAdmin — Returns true when the current authenticated user has the 'admin' role.
 * Server-validated via has_role() RPC. Use to gate admin-only UI in Core.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsCoreAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ["is-core-admin"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      if (error) return false;
      return Boolean(data);
    },
  });
  return { isAdmin: Boolean(data), isLoading };
}
