/**
 * CoreStaffPage — Staff Access Management Console
 * Ported from AdminUsersAccess with full features:
 * - Staff list with profile enrichment
 * - Create admin / employee via edge function
 * - Role management (admin, employee)
 * - Status management (active, disabled, hold)
 * - Enable/disable actions
 * - Permission management
 * - PIN/Password management
 * - Send reset / invitation
 * - Details drawer
 * - Advanced filters (role, status, search)
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Shield, Search, UserCog, Plus, XCircle, Eye, RefreshCcw, Mail, Phone, KeyRound, Ban, CheckCircle, Clock, Hash, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const ROLES: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrateur", color: "bg-red-500/15 text-red-400" },
  employee: { label: "Employé", color: "bg-blue-500/15 text-blue-400" },
  supervisor: { label: "Superviseur", color: "bg-purple-500/15 text-purple-400" },
  sales: { label: "Ventes", color: "bg-emerald-500/15 text-emerald-400" },
  support: { label: "Support", color: "bg-amber-500/15 text-amber-400" },
  billing_admin: { label: "Facturation", color: "bg-cyan-500/15 text-cyan-400" },
  techops: { label: "TechOps", color: "bg-indigo-500/15 text-indigo-400" },
  kyc_agent: { label: "Agent KYC", color: "bg-orange-500/15 text-orange-400" },
  technician: { label: "Technicien", color: "bg-teal-500/15 text-teal-400" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "bg-emerald-500/15 text-emerald-400" },
  disabled: { label: "Désactivé", color: "bg-red-500/15 text-red-400" },
  hold: { label: "En attente", color: "bg-amber-500/15 text-amber-400" },
};

export default function CoreStaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    email: "", full_name: "", role: "employee", phone: "", badge_number: "", job_title: "",
    send_invitation: true, is_active: true,
    can_access_core: false, can_access_employee: true, can_access_field: false, can_access_technician: false,
  });

  // ═══ QUERIES ═══
  const { data: staffList = [], isLoading, refetch } = useQuery({
    queryKey: ["core-staff-list"],
    queryFn: async () => {
      // Get all staff roles
      const { data: rolesData, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, status, created_at, updated_at, is_active, can_access_core, can_access_employee, can_access_field, can_access_technician")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!rolesData || rolesData.length === 0) return [];

      // Enrich with profiles
      const userIds = [...new Set(rolesData.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, full_name, phone, last_sign_in_at")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      // Enrich with employee details
      const { data: employees } = await supabase
        .from("employees")
        .select("user_id, phone, badge_number, job_title, pin_set_at")
        .in("user_id", userIds);
      const empMap = new Map((employees || []).map((e: any) => [e.user_id, e]));

      return rolesData.map((r: any) => {
        const profile = profileMap.get(r.user_id) || {};
        const emp = empMap.get(r.user_id) || {};
        return {
          ...r,
          profile,
          employee: emp,
          displayName: profile.full_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "—",
        };
      });
    },
  });

  // ═══ MUTATIONS ═══
  const createStaffMutation = useMutation({
    mutationFn: async (data: typeof newStaff) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: {
          action: "create", email: data.email, full_name: data.full_name,
          role: data.role, phone: data.phone || undefined,
          badge_number: data.badge_number || undefined, job_title: data.job_title || undefined,
          send_invitation: data.send_invitation, is_active: data.is_active,
          can_access_core: data.can_access_core,
          can_access_employee: data.can_access_employee,
          can_access_field: data.can_access_field,
          can_access_technician: data.can_access_technician,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if ((response.data as any)?.ok === false) throw new Error((response.data as any)?.message || "Erreur");
      return response.data;
    },
    onSuccess: () => {
      toast.success("Membre du personnel créé");
      queryClient.invalidateQueries({ queryKey: ["core-staff-list"] });
      setCreateOpen(false);
      setNewStaff({ email: "", full_name: "", role: "employee", phone: "", badge_number: "", job_title: "", send_invitation: true, is_active: true, can_access_core: false, can_access_employee: true, can_access_field: false, can_access_technician: false });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la création"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: "enable" | "disable" }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action, user_id: userId },
      });
      if (response.error) throw new Error(response.error.message);
      if ((response.data as any)?.ok === false) throw new Error((response.data as any)?.message || "Erreur");
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      queryClient.invalidateQueries({ queryKey: ["core-staff-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "send_password_reset", email },
      });
      if (response.error) throw new Error(response.error.message);
    },
    onSuccess: () => toast.success("Email de réinitialisation envoyé"),
    onError: (e: any) => toast.error(e.message),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "change_role", user_id: userId, new_role: newRole },
      });
      if (response.error) throw new Error(response.error.message);
      if ((response.data as any)?.ok === false) throw new Error((response.data as any)?.message || "Erreur");
    },
    onSuccess: () => {
      toast.success("Rôle modifié");
      queryClient.invalidateQueries({ queryKey: ["core-staff-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ═══ FILTERING ═══
  const filtered = useMemo(() => {
    return staffList.filter((s: any) => {
      if (roleFilter !== "all" && s.role !== roleFilter) return false;
      if (statusFilter !== "all") {
        const st = s.status || (s.is_active !== false ? "active" : "disabled");
        if (st !== statusFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return s.displayName?.toLowerCase().includes(q) || s.profile?.email?.toLowerCase().includes(q) || s.role?.includes(q);
      }
      return true;
    });
  }, [staffList, search, roleFilter, statusFilter]);

  const activeCount = staffList.filter((s: any) => s.status === "active" || s.is_active !== false).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Gestion du personnel</h1>
          <p className="text-xs text-[#94A3B8]">{activeCount} membres actifs • {staffList.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreateOpen(true)} className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Ajouter un membre
          </button>
          <Users className="h-5 w-5 text-emerald-400" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: staffList.length },
          { label: "Actifs", value: activeCount, color: "text-emerald-400" },
          { label: "Admins", value: staffList.filter((s: any) => s.role === "admin").length, color: "text-red-400" },
          { label: "Employés", value: staffList.filter((s: any) => s.role === "employee").length, color: "text-blue-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider">{kpi.label}</span>
            <p className={`text-xl font-bold mt-0.5 ${kpi.color || "text-[#F8FAFC]"}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, email, rôle…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#CBD5E1] focus:outline-none">
          <option value="all">Tous les rôles</option>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#CBD5E1] focus:outline-none">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Nom", "Email", "Rôle", "Statut", "Poste", "Badge", "Dernière connexion", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#64748B]">Aucun membre trouvé</td></tr>
              ) : (
                filtered.map((s: any) => {
                  const role = ROLES[s.role] || { label: s.role, color: "bg-[#64748B]/20 text-[#94A3B8]" };
                  const st = STATUS_MAP[s.status || "active"] || STATUS_MAP.active;
                  return (
                    <tr key={s.id} className="hover:bg-[hsl(220,15%,13%)] transition-colors">
                      <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{s.displayName}</td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{s.profile?.email || "—"}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${role.color}`}>{role.label}</span></td>
                      <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{s.employee?.job_title || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-[#94A3B8]">{s.employee?.badge_number || "—"}</td>
                      <td className="px-3 py-2.5 text-[#94A3B8]">{s.profile?.last_sign_in_at ? format(new Date(s.profile.last_sign_in_at), "dd MMM HH:mm", { locale: fr }) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => setSelected(s)} className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors" title="Détails"><Eye className="h-3 w-3" /></button>
                          {(s.status === "active" || s.is_active !== false) ? (
                            <button onClick={() => toggleStatusMutation.mutate({ userId: s.user_id, action: "disable" })}
                              className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-red-400 transition-colors" title="Désactiver"><Ban className="h-3 w-3" /></button>
                          ) : (
                            <button onClick={() => toggleStatusMutation.mutate({ userId: s.user_id, action: "enable" })}
                              className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-emerald-400 transition-colors" title="Activer"><CheckCircle className="h-3 w-3" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ DETAILS DRAWER ═══ */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-[#F8FAFC] overflow-y-auto">
          <SheetHeader><SheetTitle className="text-[#F8FAFC]">Dossier personnel</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                {[
                  ["Nom", selected.displayName],
                  ["Email", selected.profile?.email],
                  ["Téléphone", selected.employee?.phone || selected.profile?.phone],
                  ["Rôle", ROLES[selected.role]?.label || selected.role],
                  ["Statut", STATUS_MAP[selected.status || "active"]?.label],
                  ["Poste", selected.employee?.job_title],
                  ["Badge", selected.employee?.badge_number],
                  ["PIN configuré", selected.employee?.pin_set_at ? "Oui" : "Non"],
                  ["Créé le", selected.created_at ? format(new Date(selected.created_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"],
                  ["Dernière connexion", selected.profile?.last_sign_in_at ? format(new Date(selected.profile.last_sign_in_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]"><span className="text-[#94A3B8]">{l}</span><span className="text-[#F8FAFC] font-medium">{v || "—"}</span></div>
                ))}
              </div>

              {/* Actions */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Actions</h3>
                <div>
                  <label className="text-[10px] text-[#64748B] uppercase">Changer le rôle</label>
                  <select value={selected.role} onChange={(e) => changeRoleMutation.mutate({ userId: selected.user_id, newRole: e.target.value })}
                    className="w-full h-8 mt-1 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  {selected.profile?.email && (
                    <button onClick={() => sendResetMutation.mutate(selected.profile.email)}
                      className="flex-1 h-8 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] border border-[hsl(220,15%,20%)] text-[11px] font-medium hover:text-[#F8FAFC] transition-colors flex items-center justify-center gap-1.5">
                      <KeyRound className="h-3 w-3" /> Réinitialiser MDP
                    </button>
                  )}
                  {(selected.status === "active" || selected.is_active !== false) ? (
                    <button onClick={() => { toggleStatusMutation.mutate({ userId: selected.user_id, action: "disable" }); setSelected(null); }}
                      className="flex-1 h-8 rounded-md bg-red-600/20 text-red-400 border border-red-500/30 text-[11px] font-medium hover:bg-red-600/30 transition-colors flex items-center justify-center gap-1.5">
                      <Ban className="h-3 w-3" /> Désactiver
                    </button>
                  ) : (
                    <button onClick={() => { toggleStatusMutation.mutate({ userId: selected.user_id, action: "enable" }); setSelected(null); }}
                      className="flex-1 h-8 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium hover:bg-emerald-600/30 transition-colors flex items-center justify-center gap-1.5">
                      <CheckCircle className="h-3 w-3" /> Activer
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ CREATE DIALOG ═══ */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#F8FAFC]">Ajouter un membre</h2>
              <button onClick={() => setCreateOpen(false)} className="text-[#64748B] hover:text-[#F8FAFC]"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Email *</label>
                  <input value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} placeholder="email@nivra.ca"
                    className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Nom complet *</label>
                  <input value={newStaff.full_name} onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })} placeholder="Jean Dupont"
                    className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Rôle *</label>
                  <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Téléphone</label>
                  <input value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} placeholder="+1..."
                    className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">N° Badge</label>
                  <input value={newStaff.badge_number} onChange={(e) => setNewStaff({ ...newStaff, badge_number: e.target.value })} placeholder="EMP-001"
                    className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] font-mono placeholder:text-[#64748B] focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Poste</label>
                  <input value={newStaff.job_title} onChange={(e) => setNewStaff({ ...newStaff, job_title: e.target.value })} placeholder="Agent support"
                    className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-[#CBD5E1] cursor-pointer">
                <input type="checkbox" checked={newStaff.send_invitation} onChange={(e) => setNewStaff({ ...newStaff, send_invitation: e.target.checked })} className="rounded" />
                Envoyer une invitation par email
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCreateOpen(false)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] text-[12px] font-medium">Annuler</button>
              <button onClick={() => createStaffMutation.mutate(newStaff)} disabled={!newStaff.email || !newStaff.full_name || createStaffMutation.isPending}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50">
                Créer le membre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
