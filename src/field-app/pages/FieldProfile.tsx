/**
 * FieldProfile — Agent profile. Clean light UI.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { User, Mail, Shield, Loader2 } from "lucide-react";

export default function FieldProfile() {
  const { user } = useStaffUser();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["field-profile", user?.id],
    queryFn: async () => {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role, status").eq("user_id", user!.id).eq("status", "active").maybeSingle(),
      ]);
      return { name: profileRes.data?.full_name ?? "Agent", email: user?.email ?? "", role: roleRes.data?.role ?? "field_sales" };
    },
    enabled: !!user?.id,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold text-[#000000]">Mon profil</h1>
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[#DCFCE7] flex items-center justify-center">
            <User className="h-6 w-6 text-[#16A34A]" />
          </div>
          <div>
            <p className="text-base font-semibold text-[#000000]">{profile?.name}</p>
            <p className="text-xs text-[#6B7280]">Agent terrain</p>
          </div>
        </div>
        <div className="space-y-3 pt-2 border-t border-[#E5E7EB]">
          <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#6B7280]" /><span className="text-sm text-[#374151]">{profile?.email}</span></div>
          <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-[#6B7280]" /><span className="text-sm text-[#374151]">Rôle : {profile?.role}</span></div>
        </div>
      </div>
    </div>
  );
}
