import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Ban, CheckCircle2, Eye, Mail, Plus, Search, ShieldCheck, ShieldAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";

type StaffFormData = {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  mfa_required: boolean;
  send_invitation: boolean;
  can_access_core: boolean;
  can_access_employee: boolean;
  can_access_field: boolean;
  can_access_technician: boolean;
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrateur" },
  { value: "employee", label: "Employé" },
  { value: "supervisor", label: "Superviseur" },
  { value: "sales", label: "Ventes" },
  { value: "support", label: "Support" },
  { value: "billing_admin", label: "Admin facturation" },
  { value: "techops", label: "TechOps" },
  { value: "kyc_agent", label: "Agent KYC" },
  { value: "technician", label: "Technicien" },
  { value: "field_sales", label: "Ventes terrain" },
] as const;

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((role) => [role.value, role.label]));

const INVITATION_LABELS: Record<string, string> = {
  generated: "Générée",
  sent: "Envoyée",
  accepted: "Acceptée",
  revoked: "Révoquée",
  expired: "Expirée",
};

const defaultForm: StaffFormData = {
  first_name: "",
  last_name: "",
  email: "",
  role: "employee",
  is_active: true,
  mfa_required: true,
  send_invitation: true,
  can_access_core: false,
  can_access_employee: true,
  can_access_field: false,
  can_access_technician: false,
};

function getInvitationBadgeVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "accepted") return "default";
  if (status === "sent" || status === "generated") return "secondary";
  if (status === "revoked" || status === "expired") return "destructive";
  return "outline";
}

export default function CoreStaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<StaffFormData>(defaultForm);

  const invalidateStaffData = () => {
    queryClient.invalidateQueries({ queryKey: ["core-staff-list"] });
    queryClient.invalidateQueries({ queryKey: ["core-staff-invitation-statuses"] });
  };

  const invokeAdminStaffAction = async (payload: Record<string, unknown>) => {
    const response = await supabase.functions.invoke("admin-manage-staff", { body: payload });
    if (response.error) {
      const msg = await getInvokeErrorMessage(response.error);
      throw new Error(msg || "Erreur edge function");
    }
    if ((response.data as any)?.ok === false) {
      throw new Error((response.data as any)?.message || (response.data as any)?.error?.message || "Erreur inattendue");
    }
    return response.data as any;
  };

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ["core-staff-list"],
    queryFn: async () => {
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, status, is_active, created_at, updated_at, can_access_core, can_access_employee, can_access_field, can_access_technician, mfa_required, mfa_enrolled_at, last_login_at")
        .order("created_at", { ascending: false });

      if (roleError) throw roleError;
      if (!roleRows?.length) return [];

      const userIds = [...new Set(roleRows.map((row: any) => row.user_id))];

      const [profilesResult, employeesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, first_name, last_name, full_name, email, phone, last_login_at, mfa_enabled, mfa_verified_at")
          .in("user_id", userIds),
        supabase
          .from("employees")
          .select("user_id, phone, badge_number, job_title, pin_set_at")
          .in("user_id", userIds),
      ]);

      const profileMap = new Map((profilesResult.data || []).map((profile: any) => [profile.user_id, profile]));
      const employeeMap = new Map((employeesResult.data || []).map((employee: any) => [employee.user_id, employee]));

      return roleRows.map((row: any) => {
        const profile = profileMap.get(row.user_id) || {};
        const employee = employeeMap.get(row.user_id) || {};
        const firstName = profile.first_name || "";
        const lastName = profile.last_name || "";
        const fallbackName = `${firstName} ${lastName}`.trim();

        return {
          ...row,
          profile,
          employee,
          displayName: profile.full_name || fallbackName || profile.email || "—",
          lastLoginAt: row.last_login_at || profile.last_login_at || null,
          mfaRequired: row.mfa_required !== false,
          mfaEnabled: Boolean(row.mfa_enrolled_at || profile.mfa_verified_at || profile.mfa_enabled),
        };
      });
    },
  });

  const staffUserIdsKey = useMemo(
    () => staffList.map((staff: any) => staff.user_id).sort().join(","),
    [staffList]
  );

  const { data: invitationStatuses = [] } = useQuery({
    queryKey: ["core-staff-invitation-statuses", staffUserIdsKey],
    enabled: staffList.length > 0,
    queryFn: async () => {
      const userIds = staffList.map((staff: any) => staff.user_id);
      const response = await invokeAdminStaffAction({
        action: "list_invitation_statuses",
        user_ids: userIds,
      });
      return response.invitations || [];
    },
  });

  const invitationByUser = useMemo(
    () => new Map((invitationStatuses as any[]).map((invitation) => [invitation.user_id, invitation])),
    [invitationStatuses]
  );

  const filteredStaff = useMemo(() => {
    return staffList.filter((staff: any) => {
      if (roleFilter !== "all" && staff.role !== roleFilter) return false;

      if (statusFilter !== "all") {
        const computedStatus = staff.status || (staff.is_active === false ? "disabled" : "active");
        if (computedStatus !== statusFilter) return false;
      }

      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        staff.displayName?.toLowerCase().includes(query) ||
        staff.profile?.email?.toLowerCase().includes(query) ||
        staff.role?.toLowerCase().includes(query)
      );
    });
  }, [staffList, roleFilter, statusFilter, search]);

  const createStaffMutation = useMutation({
    mutationFn: async (payload: StaffFormData) => {
      const full_name = `${payload.first_name} ${payload.last_name}`.trim();
      return invokeAdminStaffAction({
        action: "create",
        email: payload.email.trim().toLowerCase(),
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        full_name,
        role: payload.role,
        is_active: payload.is_active,
        mfa_required: payload.mfa_required,
        send_invitation: payload.send_invitation,
        can_access_core: payload.can_access_core,
        can_access_employee: payload.can_access_employee,
        can_access_field: payload.can_access_field,
        can_access_technician: payload.can_access_technician,
      });
    },
    onSuccess: (response: any) => {
      const invitationError = typeof response?.invitation_error === "string" ? response.invitation_error : null;
      const message = response?.message || "Employé créé avec succès";

      if (invitationError) {
        toast.warning(`${message} (${invitationError})`);
      } else {
        toast.success(message);
      }

      setCreateOpen(false);
      setForm(defaultForm);
      invalidateStaffData();
    },
    onError: (error: any) => toast.error(error.message || "Erreur lors de la création"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      return invokeAdminStaffAction({
        action: "update_status",
        user_id: userId,
        status: isActive ? "active" : "disabled",
      });
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      invalidateStaffData();
    },
    onError: (error: any) => toast.error(error.message || "Erreur statut"),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return invokeAdminStaffAction({ action: "change_role", user_id: userId, new_role: role });
    },
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      invalidateStaffData();
    },
    onError: (error: any) => toast.error(error.message || "Erreur rôle"),
  });

  const updatePortalMutation = useMutation({
    mutationFn: async ({ userId, key, value }: { userId: string; key: string; value: boolean }) => {
      return invokeAdminStaffAction({ action: "update_portal_access", user_id: userId, [key]: value });
    },
    onSuccess: () => {
      toast.success("Accès portail mis à jour");
      invalidateStaffData();
    },
    onError: (error: any) => toast.error(error.message || "Erreur accès"),
  });

  const updateMfaMutation = useMutation({
    mutationFn: async ({ userId, required }: { userId: string; required: boolean }) => {
      return invokeAdminStaffAction({ action: "update_mfa_requirement", user_id: userId, mfa_required: required });
    },
    onSuccess: () => {
      toast.success("Exigence MFA mise à jour");
      invalidateStaffData();
    },
    onError: (error: any) => toast.error(error.message || "Erreur MFA"),
  });

  const invitationMutation = useMutation({
    mutationFn: async ({ action, userId }: { action: "generate_invitation" | "send_invitation" | "resend_invitation" | "revoke_invitation"; userId: string }) => {
      return invokeAdminStaffAction({ action, user_id: userId });
    },
    onSuccess: (_, variables) => {
      const labels: Record<string, string> = {
        generate_invitation: "Invitation générée",
        send_invitation: "Invitation envoyée",
        resend_invitation: "Invitation renvoyée",
        revoke_invitation: "Invitation révoquée",
      };
      toast.success(labels[variables.action] || "Invitation mise à jour");
      invalidateStaffData();
    },
    onError: (error: any) => toast.error(error.message || "Erreur invitation"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      return invokeAdminStaffAction({ action: "send_password_reset", email });
    },
    onSuccess: () => toast.success("Email de réinitialisation envoyé"),
    onError: (error: any) => toast.error(error.message || "Erreur réinitialisation"),
  });

  const activeCount = staffList.filter((staff: any) => (staff.status || "active") === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Gestion du personnel interne</h1>
          </div>
          <p className="text-xs text-muted-foreground">Créez et gérez les employés, accès portails, MFA et invitations.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Ajouter un employé
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-semibold text-foreground">{staffList.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Actifs</p>
            <p className="text-xl font-semibold text-foreground">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">MFA requis</p>
            <p className="text-xl font-semibold text-foreground">{staffList.filter((staff: any) => staff.mfaRequired).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Invitations en attente</p>
            <p className="text-xl font-semibold text-foreground">
              {staffList.filter((staff: any) => {
                const invitation = invitationByUser.get(staff.user_id);
                return invitation?.status === "generated" || invitation?.status === "sent";
              }).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Rechercher nom, email, rôle…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {ROLE_OPTIONS.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="disabled">Désactivé</SelectItem>
            <SelectItem value="hold">En attente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Employé</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rôle</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Statut</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Portails</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">MFA</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invitation</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Dernière connexion</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>Chargement…</td>
              </tr>
            ) : filteredStaff.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>Aucun employé</td>
              </tr>
            ) : (
              filteredStaff.map((staff: any) => {
                const invitation = invitationByUser.get(staff.user_id);
                const isActive = (staff.status || "active") === "active";
                const portals = [
                  staff.can_access_core && "Core",
                  staff.can_access_employee && "Employee",
                  staff.can_access_field && "Field",
                  staff.can_access_technician && "Technician",
                ].filter(Boolean);

                return (
                  <tr key={staff.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium text-foreground">{staff.displayName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{staff.profile?.email || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline">{ROLE_LABELS[staff.role] || staff.role}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={isActive ? "default" : "destructive"}>{isActive ? "Actif" : "Désactivé"}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {portals.length ? portals.map((portal) => (
                          <Badge key={portal} variant="secondary" className="text-[10px]">{portal}</Badge>
                        )) : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={staff.mfaEnabled ? "default" : "secondary"}>{staff.mfaEnabled ? "Enrôlé" : "Non enrôlé"}</Badge>
                        {staff.mfaRequired ? <ShieldCheck className="h-3.5 w-3.5 text-primary" /> : <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={getInvitationBadgeVariant(invitation?.status)}>
                        {invitation ? INVITATION_LABELS[invitation.status] || invitation.status : "Aucune"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {staff.lastLoginAt ? format(new Date(staff.lastLoginAt), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="icon" variant="ghost" onClick={() => setSelected(staff)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Dossier employé</SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="mt-4 space-y-4">
              <Card>
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nom</span><span>{selected.displayName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{selected.profile?.email || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rôle</span><span>{ROLE_LABELS[selected.role] || selected.role}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Dernière connexion</span><span>{selected.lastLoginAt ? format(new Date(selected.lastLoginAt), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accès portails</p>
                  {[
                    { key: "can_access_core", label: "Nivra Core" },
                    { key: "can_access_employee", label: "Nivra Employee" },
                    { key: "can_access_field", label: "Nivra Field" },
                    { key: "can_access_technician", label: "Nivra Technician" },
                  ].map((portal) => (
                    <label key={portal.key} className="flex items-center justify-between gap-3 text-sm">
                      <span>{portal.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(selected[portal.key])}
                        onChange={(event) => {
                          const value = event.target.checked;
                          setSelected((current: any) => ({ ...current, [portal.key]: value }));
                          updatePortalMutation.mutate({ userId: selected.user_id, key: portal.key, value });
                        }}
                      />
                    </label>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sécurité & statut</p>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>MFA obligatoire</span>
                    <input
                      type="checkbox"
                      checked={Boolean(selected.mfaRequired)}
                      onChange={(event) => {
                        const required = event.target.checked;
                        setSelected((current: any) => ({ ...current, mfaRequired: required }));
                        updateMfaMutation.mutate({ userId: selected.user_id, required });
                      }}
                    />
                  </label>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Changer le rôle</p>
                    <Select
                      value={selected.role}
                      onValueChange={(value) => {
                        setSelected((current: any) => ({ ...current, role: value }));
                        changeRoleMutation.mutate({ userId: selected.user_id, role: value });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((role) => (
                          <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant={(selected.status || "active") === "active" ? "destructive" : "default"}
                      onClick={() => {
                        const nextActive = (selected.status || "active") !== "active";
                        updateStatusMutation.mutate({ userId: selected.user_id, isActive: nextActive });
                        setSelected((current: any) => ({ ...current, status: nextActive ? "active" : "disabled" }));
                      }}
                    >
                      {(selected.status || "active") === "active" ? <Ban className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {(selected.status || "active") === "active" ? "Désactiver" : "Activer"}
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => selected.profile?.email && resetPasswordMutation.mutate(selected.profile.email)}
                      disabled={!selected.profile?.email || resetPasswordMutation.isPending}
                    >
                      <Mail className="mr-2 h-4 w-4" /> Réinit. mot de passe
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invitation</p>
                  {(() => {
                    const invitation = invitationByUser.get(selected.user_id);
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded border border-border p-2">
                            <p className="text-muted-foreground">Statut</p>
                            <p className="font-medium">{invitation ? INVITATION_LABELS[invitation.status] || invitation.status : "Aucune"}</p>
                          </div>
                          <div className="rounded border border-border p-2">
                            <p className="text-muted-foreground">Expiration</p>
                            <p className="font-medium">
                              {invitation?.expires_at ? format(new Date(invitation.expires_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            onClick={() => invitationMutation.mutate({ action: "generate_invitation", userId: selected.user_id })}
                            disabled={invitationMutation.isPending}
                          >
                            Générer invitation
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => invitationMutation.mutate({ action: "send_invitation", userId: selected.user_id })}
                            disabled={invitationMutation.isPending}
                          >
                            Envoyer invitation
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => invitationMutation.mutate({ action: "resend_invitation", userId: selected.user_id })}
                            disabled={invitationMutation.isPending}
                          >
                            Renvoyer invitation
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => invitationMutation.mutate({ action: "revoke_invitation", userId: selected.user_id })}
                            disabled={invitationMutation.isPending}
                          >
                            Révoquer invitation
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Créer un employé interne</DialogTitle>
            <DialogDescription>
              Créez le profil, assignez le rôle, configurez les accès portail et envoyez l'invitation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Prénom *</label>
              <Input value={form.first_name} onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Nom *</label>
              <Input value={form.last_name} onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground">Email *</label>
              <Input
                type="email"
                placeholder="prenom.nom@nivra-telecom.ca"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground">Rôle *</label>
              <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accès aux portails</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {[
                { key: "can_access_core", label: "Nivra Core" },
                { key: "can_access_employee", label: "Nivra Employee" },
                { key: "can_access_field", label: "Nivra Field" },
                { key: "can_access_technician", label: "Nivra Technician" },
              ].map((portal) => (
                <label key={portal.key} className="flex items-center justify-between text-sm">
                  <span>{portal.label}</span>
                  <input
                    type="checkbox"
                    checked={(form as any)[portal.key]}
                    onChange={(event) => setForm((prev: any) => ({ ...prev, [portal.key]: event.target.checked }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sécurité et activation</p>
            <label className="flex items-center justify-between text-sm">
              <span>Compte actif à la création</span>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>MFA obligatoire</span>
              <input
                type="checkbox"
                checked={form.mfa_required}
                onChange={(event) => setForm((prev) => ({ ...prev, mfa_required: event.target.checked }))}
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Envoyer invitation par email</span>
              <input
                type="checkbox"
                checked={form.send_invitation}
                onChange={(event) => setForm((prev) => ({ ...prev, send_invitation: event.target.checked }))}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createStaffMutation.mutate(form)}
              disabled={!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || createStaffMutation.isPending}
            >
              Créer l'employé
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
