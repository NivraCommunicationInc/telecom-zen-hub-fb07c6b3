/**
 * CoreStaffPage — Staff Access Management Console
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Shield, Search, UserPlus, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { USER_ROLE_LABELS } from "@/lib/constants/roles";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STAFF_ROLES = ["admin", "supervisor", "sales", "support", "billing_admin", "techops", "kyc_agent", "technician"] as const;

export default function CoreStaffPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ["core-staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, status, created_at, updated_at")
        .in("role", STAFF_ROLES as unknown as string[])
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Enrich with profile data
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, last_sign_in_at")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((r: any) => ({ ...r, profile: profileMap.get(r.user_id) || {} }));
    },
  });

  const filtered = staffList.filter((s: any) => {
    if (roleFilter !== "all" && s.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${s.profile?.first_name || ""} ${s.profile?.last_name || ""}`.toLowerCase();
      return name.includes(q) || s.profile?.email?.toLowerCase().includes(q) || s.role?.includes(q);
    }
    return true;
  });

  const activeCount = staffList.filter((s: any) => s.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Gestion du personnel</h1>
          <p className="text-xs text-[#94A3B8]">{activeCount} membres actifs • {staffList.length} total</p>
        </div>
        <Users className="h-5 w-5 text-emerald-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, email, rôle…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#CBD5E1] focus:outline-none"
        >
          <option value="all">Tous les rôles</option>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>{USER_ROLE_LABELS[r] || r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Nom", "Email", "Rôle", "Statut", "Dernière connexion", "Créé le"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-[#64748B]">Aucun membre trouvé</td></tr>
              ) : (
                filtered.map((s: any) => (
                  <tr key={s.id} onClick={() => setSelected(s)} className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors">
                    <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">
                      {s.profile?.first_name || ""} {s.profile?.last_name || ""}
                    </td>
                    <td className="px-3 py-2.5 text-[#CBD5E1]">{s.profile?.email || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400">
                        {USER_ROLE_LABELS[s.role as keyof typeof USER_ROLE_LABELS] || s.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        s.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        {s.status === "active" ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#94A3B8]">
                      {s.profile?.last_sign_in_at ? format(new Date(s.profile.last_sign_in_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[#94A3B8]">
                      {s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-[#F8FAFC] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[#F8FAFC]">Dossier personnel</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <Field label="Nom" value={`${selected.profile?.first_name || ""} ${selected.profile?.last_name || ""}`} />
                <Field label="Email" value={selected.profile?.email} />
                <Field label="Rôle" value={USER_ROLE_LABELS[selected.role as keyof typeof USER_ROLE_LABELS] || selected.role} />
                <Field label="Statut" value={selected.status === "active" ? "Actif" : "Inactif"} />
                <Field label="Créé le" value={selected.created_at ? format(new Date(selected.created_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-[#94A3B8]">{label}</span>
      <span className="text-[#F8FAFC] font-medium">{value || "—"}</span>
    </div>
  );
}
