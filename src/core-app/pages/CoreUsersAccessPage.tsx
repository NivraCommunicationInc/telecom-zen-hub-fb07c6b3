/**
 * CoreUsersAccessPage — User roles & access management.
 * Mirrors old admin AdminUsersAccess.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Search, Shield, UserPlus, Edit2, Ban, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  employee: "Employé",
  technician: "Technicien",
  client: "Client",
  sales: "Ventes",
  kyc_agent: "Agent KYC",
  billing_admin: "Admin Facturation",
  techops: "Opérations Tech",
  support: "Support",
  supervisor: "Superviseur",
  influencer: "Influenceur",
  field_sales: "Ventes Terrain",
  system: "Système",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400",
  employee: "bg-blue-500/20 text-blue-400",
  technician: "bg-purple-500/20 text-purple-400",
  supervisor: "bg-amber-500/20 text-amber-400",
  sales: "bg-emerald-500/20 text-emerald-400",
  support: "bg-cyan-500/20 text-cyan-400",
};

export default function CoreUsersAccessPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editUser, setEditUser] = useState<any>(null);
  const [newRole, setNewRole] = useState("");
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["core-user-roles", roleFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("user_roles")
        .select("*, profiles!user_roles_user_id_fkey(full_name, email, phone)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (roleFilter !== "all") q = q.eq("role", roleFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: adminUsers = [] } = useQuery({
    queryKey: ["core-admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("*, profiles!admin_users_user_id_fkey(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: accessLimits } = useQuery({
    queryKey: ["core-access-limits"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_access_limits").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("user_roles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      queryClient.invalidateQueries({ queryKey: ["core-user-roles"] });
      setEditUser(null);
    },
    onError: () => toast.error("Erreur"),
  });

  const filtered = roles.filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const p = r.profiles;
    return (
      p?.full_name?.toLowerCase().includes(q) ||
      p?.email?.toLowerCase().includes(q) ||
      r.role?.toLowerCase().includes(q)
    );
  });

  const activeAdmins = adminUsers.filter((a: any) => a.is_active).length;
  const activeStaff = roles.filter((r: any) => r.status === "active" && r.role !== "client").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">Utilisateurs & Accès</h1>
        </div>
        <div className="flex items-center gap-2">
          {accessLimits && (
            <div className="text-[10px] text-[hsl(220,10%,50%)]">
              Admins: {activeAdmins}/{accessLimits.max_admins} • Staff: {activeStaff}/{accessLimits.max_staff}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total rôles", value: roles.length, color: "text-white" },
          { label: "Actifs", value: roles.filter((r: any) => r.status === "active").length, color: "text-emerald-400" },
          { label: "Inactifs", value: roles.filter((r: any) => r.status === "inactive").length, color: "text-red-400" },
          { label: "Admin users", value: adminUsers.length, color: "text-amber-400" },
        ].map((s, i) => (
          <div key={i} className="bg-[hsl(220,15%,12%)] rounded-lg border border-[hsl(220,15%,16%)] p-3">
            <p className="text-[10px] text-[hsl(220,10%,50%)] uppercase">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />
          <Input
            placeholder="Rechercher par nom, email, rôle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px] bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs">
            <SelectValue placeholder="Rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="inactive">Inactif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[hsl(220,15%,12%)]">
            <tr className="text-[hsl(220,10%,50%)]">
              <th className="text-left p-2.5 font-medium">Utilisateur</th>
              <th className="text-left p-2.5 font-medium">Email</th>
              <th className="text-left p-2.5 font-medium">Rôle</th>
              <th className="text-left p-2.5 font-medium">Statut</th>
              <th className="text-left p-2.5 font-medium">Créé</th>
              <th className="text-right p-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(220,15%,14%)]">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-[hsl(220,10%,40%)]">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-[hsl(220,10%,40%)]">Aucun utilisateur</td></tr>
            ) : (
              filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-[hsl(220,15%,12%)]">
                  <td className="p-2.5 text-white">{r.profiles?.full_name || "—"}</td>
                  <td className="p-2.5 text-[hsl(220,10%,70%)] font-mono">{r.profiles?.email || "—"}</td>
                  <td className="p-2.5">
                    <Badge className={`text-[10px] ${ROLE_COLORS[r.role] || "bg-gray-500/20 text-gray-400"}`}>
                      {ROLE_LABELS[r.role] || r.role}
                    </Badge>
                  </td>
                  <td className="p-2.5">
                    <Badge className={`text-[10px] ${r.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-2.5 text-[hsl(220,10%,50%)]">
                    {r.created_at ? format(new Date(r.created_at), "dd MMM yyyy", { locale: fr }) : "—"}
                  </td>
                  <td className="p-2.5 text-right">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => { setEditUser(r); setNewRole(r.role); }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Modifier l'accès</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 text-xs">
              <div>
                <p className="text-[hsl(220,10%,50%)]">Utilisateur</p>
                <p className="text-white">{editUser.profiles?.full_name || "—"} ({editUser.profiles?.email})</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[hsl(220,10%,50%)]">Rôle</p>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                  onClick={() => updateRoleMutation.mutate({ id: editUser.id, updates: { role: newRole, status: "active" } })}
                >
                  <CheckCircle className="h-3 w-3 mr-1" /> Sauvegarder
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => updateRoleMutation.mutate({ id: editUser.id, updates: { status: "inactive" } })}
                >
                  <Ban className="h-3 w-3 mr-1" /> Désactiver
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
