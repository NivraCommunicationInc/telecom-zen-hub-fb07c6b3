/**
 * FieldProfile — Full agent profile with editable fields, stats summary, and activity.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { User, Mail, Shield, Loader2, Phone, Briefcase, Edit2, Check, X, MapPin, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function FieldProfile() {
  const { user } = useStaffUser();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: "", phone: "" });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["field-profile-full", user?.id],
    queryFn: async () => {
      const [profileRes, roleRes, statsRes, commissionsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role, status").eq("user_id", user!.id).eq("status", "active").maybeSingle(),
        supabase.from("field_sales_orders").select("id, total_amount", { count: "exact" }).eq("salesperson_id", user!.id),
        supabase.from("field_commissions").select("amount, status").eq("agent_id", user!.id),
      ]);

      const totalSales = statsRes.count ?? 0;
      const totalRevenue = (statsRes.data || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
      const totalCommissions = (commissionsRes.data || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
      const paidCommissions = (commissionsRes.data || []).filter((c: any) => c.status === "paid").reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

      return {
        name: profileRes.data?.full_name ?? "Agent",
        email: user?.email ?? "",
        phone: profileRes.data?.phone ?? "",
        role: roleRes.data?.role ?? "field_sales",
        jobTitle: profileRes.data?.job_title ?? "Agent terrain",
        createdAt: profileRes.data?.created_at,
        totalSales,
        totalRevenue,
        totalCommissions,
        paidCommissions,
      };
    },
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { full_name: string; phone: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: data.full_name, phone: data.phone })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["field-profile-full"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const startEdit = () => {
    setFormData({ full_name: profile?.name ?? "", phone: profile?.phone ?? "" });
    setEditing(true);
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#000000]">Mon profil</h1>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#22C55E] hover:bg-[#F0FDF4] transition-colors">
            <Edit2 className="h-3.5 w-3.5" /> Modifier
          </button>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center shadow-md">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            {editing ? (
              <input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="text-lg font-bold text-[#000000] border-b-2 border-[#22C55E] bg-transparent outline-none pb-0.5 w-full"
              />
            ) : (
              <p className="text-lg font-bold text-[#000000]">{profile?.name}</p>
            )}
            <p className="text-xs text-[#6B7280] mt-0.5">{profile?.jobTitle}</p>
            {profile?.createdAt && (
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                Membre depuis {format(new Date(profile.createdAt), "MMMM yyyy", { locale: fr })}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-[#6B7280]" />
            <span className="text-sm text-[#374151]">{profile?.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-[#6B7280]" />
            {editing ? (
              <input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Numéro de téléphone"
                className="text-sm text-[#374151] border-b border-[#E5E7EB] bg-transparent outline-none focus:border-[#22C55E] pb-0.5 flex-1"
              />
            ) : (
              <span className="text-sm text-[#374151]">{profile?.phone || "—"}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-[#6B7280]" />
            <span className="text-sm text-[#374151]">Rôle : {profile?.role}</span>
          </div>
        </div>

        {editing && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => updateMutation.mutate(formData)}
              disabled={updateMutation.isPending || !formData.full_name.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] disabled:opacity-40 transition-colors"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Sauvegarder
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">Statistiques carrière</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Ventes totales", value: profile?.totalSales ?? 0, icon: TrendingUp, color: "text-[#22C55E]", bg: "bg-[#DCFCE7]" },
            { label: "Revenu généré", value: `${(profile?.totalRevenue ?? 0).toFixed(0)} $`, icon: DollarSign, color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]" },
            { label: "Commissions totales", value: `${(profile?.totalCommissions ?? 0).toFixed(0)} $`, icon: DollarSign, color: "text-[#F59E0B]", bg: "bg-[#FEF3C7]" },
            { label: "Commissions payées", value: `${(profile?.paidCommissions ?? 0).toFixed(0)} $`, icon: Check, color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#000000]">{s.value}</p>
                <p className="text-[10px] text-[#6B7280]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
