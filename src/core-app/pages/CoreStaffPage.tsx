import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  DollarSign,
  Edit,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

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

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

const INVITATION_LABELS: Record<string, string> = {
  generated: "Générée",
  sent: "Envoyée",
  accepted: "Acceptée",
  revoked: "Révoquée",
  expired: "Expirée",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

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

async function invokeStaffAction(payload: Record<string, unknown>) {
  console.log("[CoreStaffPage] invoking admin-manage-staff:", payload.action);
  const { data, error } = await supabase.functions.invoke("admin-manage-staff", { body: payload });

  if (error) {
    console.error("[CoreStaffPage] invoke error:", error);
    let msg = error.message || "Erreur edge function";
    try {
      const ctx = (error as any)?.context;
      if (ctx) {
        const bodyText = typeof ctx.text === "function" ? await ctx.text() : typeof ctx.json === "function" ? JSON.stringify(await ctx.json()) : "";
        if (bodyText) {
          try {
            const body = JSON.parse(bodyText);
            msg = body?.error?.message || body?.message || body?.error || msg;
          } catch {
            msg = bodyText || msg;
          }
        }
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  if (data?.ok === false) {
    const errMsg = data?.error?.message || data?.message || "Erreur inattendue";
    throw new Error(errMsg);
  }

  console.log("[CoreStaffPage] response ok:", payload.action);
  return data;
}

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  base_percentage: "Pourcentage de base (%)",
  flat_bonus: "Bonus fixe ($)",
  tiered: "Par palier",
};

export default function CoreStaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<StaffFormData>(defaultForm);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");

  // PIN reset dialog
  const [pinResetTarget, setPinResetTarget] = useState<any>(null);
  const [newPin, setNewPin] = useState("");

  // Commission dialog
  const [commissionTarget, setCommissionTarget] = useState<any>(null);
  const [commissionRate, setCommissionRate] = useState("");
  const [commissionType, setCommissionType] = useState("base_percentage");

  // Email edit dialog
  const [emailEditTarget, setEmailEditTarget] = useState<any>(null);
  const [newEmail, setNewEmail] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["core-staff-list"] });
    queryClient.invalidateQueries({ queryKey: ["core-staff-invitations"] });
  };

  // ─── Staff list query ───
  const { data: staffList = [], isLoading, error: listError } = useQuery({
    queryKey: ["core-staff-list"],
    queryFn: async () => {
      const res = await invokeStaffAction({ action: "list_staff" });
      return res?.staff || [];
    },
    retry: 2,
    refetchOnWindowFocus: true,
  });

  // ─── Invitation statuses ───
  const staffUserIds = useMemo(
    () => staffList.map((s: any) => s.user_id).sort().join(","),
    [staffList]
  );

  const { data: invitationStatuses = [] } = useQuery({
    queryKey: ["core-staff-invitations", staffUserIds],
    enabled: staffList.length > 0,
    queryFn: async () => {
      const userIds = staffList.map((s: any) => s.user_id);
      const res = await invokeStaffAction({ action: "list_invitation_statuses", user_ids: userIds });
      return res?.invitations || [];
    },
  });

  const invitationByUser = useMemo(
    () => new Map((invitationStatuses as any[]).map((inv) => [inv.user_id, inv])),
    [invitationStatuses]
  );

  // ─── Filtered list ───
  const filteredStaff = useMemo(() => {
    return staffList.filter((s: any) => {
      if (roleFilter !== "all" && s.role !== roleFilter) return false;
      if (statusFilter !== "all") {
        const computed = s.status || (s.is_active === false ? "disabled" : "active");
        if (computed !== statusFilter) return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.displayName?.toLowerCase().includes(q) ||
        s.profile?.email?.toLowerCase().includes(q) ||
        s.role?.toLowerCase().includes(q)
      );
    });
  }, [staffList, roleFilter, statusFilter, search]);

  // Load existing commission when commission dialog opens
  useEffect(() => {
    if (commissionTarget) {
      const existing = commissionTarget.permissions?.commission;
      if (existing) {
        setCommissionType(existing.type || "base_percentage");
        setCommissionRate(String(existing.value ?? ""));
      } else {
        setCommissionType("base_percentage");
        setCommissionRate("");
      }
    }
  }, [commissionTarget]);

  // ─── Mutations ───
  const createMutation = useMutation({
    mutationFn: (payload: StaffFormData) => {
      const full_name = `${payload.first_name} ${payload.last_name}`.trim();
      return invokeStaffAction({
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
    onSuccess: (res: any) => {
      toast.success(res?.message || "Employé créé");
      setCreateOpen(false);
      setForm(defaultForm);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      invokeStaffAction({ action: "update_status", user_id: userId, status }),
    onSuccess: () => { toast.success("Statut mis à jour"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      invokeStaffAction({ action: "change_role", user_id: userId, new_role: role }),
    onSuccess: () => { toast.success("Rôle mis à jour"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const portalMutation = useMutation({
    mutationFn: ({ userId, key, value }: { userId: string; key: string; value: boolean }) =>
      invokeStaffAction({ action: "update_portal_access", user_id: userId, [key]: value }),
    onSuccess: () => { toast.success("Accès portail mis à jour"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const mfaMutation = useMutation({
    mutationFn: ({ userId, required }: { userId: string; required: boolean }) =>
      invokeStaffAction({ action: "update_mfa_requirement", user_id: userId, mfa_required: required }),
    onSuccess: () => { toast.success("MFA mis à jour"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const invitationMutation = useMutation({
    mutationFn: ({ action, userId }: { action: string; userId: string }) =>
      invokeStaffAction({ action, user_id: userId }),
    onSuccess: (_, v) => {
      const labels: Record<string, string> = {
        generate_invitation: "Invitation générée",
        send_invitation: "Invitation envoyée",
        resend_invitation: "Invitation renvoyée",
        revoke_invitation: "Invitation révoquée",
      };
      toast.success(labels[v.action] || "OK");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetPwMutation = useMutation({
    mutationFn: (email: string) => invokeStaffAction({ action: "send_password_reset", email }),
    onSuccess: () => toast.success("Email de réinitialisation envoyé"),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ email, confirmEmail }: { email: string; confirmEmail: string }) =>
      invokeStaffAction({ action: "hard_delete_user", email, confirm_email: confirmEmail }),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Utilisateur supprimé");
      setDeleteTarget(null);
      setDeleteConfirmEmail("");
      setSelected(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pinResetMutation = useMutation({
    mutationFn: ({ userId, pin }: { userId: string; pin: string }) =>
      invokeStaffAction({ action: "reset_pin", user_id: userId, pin }),
    onSuccess: () => {
      toast.success("PIN réinitialisé avec succès");
      setPinResetTarget(null);
      setNewPin("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const commissionMutation = useMutation({
    mutationFn: ({ userId, rate, type }: { userId: string; rate: number; type: string }) =>
      invokeStaffAction({
        action: "set_staff_commission",
        user_id: userId,
        commission_type: type,
        value: rate,
      }),
    onSuccess: () => {
      toast.success("Commission mise à jour avec succès");
      setCommissionTarget(null);
      setCommissionRate("");
      setCommissionType("base_percentage");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ userId, ...fields }: { userId: string; [key: string]: any }) =>
      invokeStaffAction({ action: "update_profile", user_id: userId, ...fields }),
    onSuccess: () => {
      toast.success("Profil mis à jour");
      setEmailEditTarget(null);
      setNewEmail("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeCount = staffList.filter((s: any) => (s.status || "active") === "active").length;

  // Helper: check if a staff member has an invalid email
  const hasInvalidEmail = (staff: any) => {
    const email = staff?.profile?.email;
    return !email || !isValidEmail(email);
  };

  // Helper: safely perform email action with validation
  const handleEmailAction = (email: string, actionFn: () => void) => {
    if (!email || !isValidEmail(email)) {
      toast.error(`Email invalide: "${email || "(vide)"}". Corrigez l'email avant d'envoyer.`);
      return;
    }
    actionFn();
  };

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Gestion du personnel interne</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Créez et gérez les employés, accès portails, MFA et invitations.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Ajouter un employé
        </Button>
      </div>

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-semibold text-foreground">{staffList.length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Actifs</p><p className="text-xl font-semibold text-foreground">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">MFA requis</p><p className="text-xl font-semibold text-foreground">{staffList.filter((s: any) => s.mfaRequired).length}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Invitations en attente</p><p className="text-xl font-semibold text-foreground">
          {staffList.filter((s: any) => { const inv = invitationByUser.get(s.user_id); return inv?.status === "generated" || inv?.status === "sent"; }).length}
        </p></CardContent></Card>
      </div>

      {/* ─── Invalid email warning ─── */}
      {staffList.some(hasInvalidEmail) && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">Emails invalides détectés</p>
            <p className="text-xs opacity-80">
              {staffList.filter(hasInvalidEmail).map((s: any) => `${s.displayName} (${s.profile?.email || "vide"})`).join(", ")}
              — Les emails (invitations, réinitialisation) ne seront pas livrés. Corrigez l'email dans le dossier de l'employé.
            </p>
          </div>
        </div>
      )}

      {/* ─── Error banner ─── */}
      {listError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Erreur chargement : {(listError as Error).message}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => invalidate()}>Réessayer</Button>
        </div>
      )}

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Rôle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="disabled">Désactivé</SelectItem>
            <SelectItem value="hold">En attente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Table ─── */}
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
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </td></tr>
            ) : filteredStaff.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>
                {staffList.length === 0 ? "Aucun employé trouvé — vérifiez la connexion" : "Aucun résultat pour ces filtres"}
              </td></tr>
            ) : (
              filteredStaff.map((staff: any) => {
                const inv = invitationByUser.get(staff.user_id);
                const isActive = (staff.status || "active") === "active";
                const portals = [
                  staff.can_access_core && "Core",
                  staff.can_access_employee && "Employee",
                  staff.can_access_field && "Field",
                  staff.can_access_technician && "Technician",
                ].filter(Boolean);
                const emailInvalid = hasInvalidEmail(staff);

                return (
                  <tr key={staff.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium text-foreground">{staff.displayName}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className={emailInvalid ? "text-destructive" : "text-muted-foreground"}>
                          {staff.profile?.email || "—"}
                        </span>
                        {emailInvalid && <AlertTriangle className="h-3 w-3 text-yellow-500" title="Email invalide" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><Badge variant="outline">{ROLE_LABELS[staff.role] || staff.role}</Badge></td>
                    <td className="px-3 py-2.5"><Badge variant={isActive ? "default" : "destructive"}>{isActive ? "Actif" : "Désactivé"}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {portals.length ? portals.map((p) => <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>) : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={staff.mfaEnabled ? "default" : "secondary"}>{staff.mfaEnabled ? "Enrôlé" : "Non"}</Badge>
                        {staff.mfaRequired ? <ShieldCheck className="h-3.5 w-3.5 text-primary" /> : <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={getInvitationBadgeVariant(inv?.status)}>
                        {inv ? INVITATION_LABELS[inv.status] || inv.status : "Aucune"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {staff.lastLoginAt ? format(new Date(staff.lastLoginAt), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setSelected(staff)} title="Détails">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setPinResetTarget(staff); setNewPin(""); }} title="Reset PIN">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {(staff.role === "field_sales" || staff.role === "sales" || staff.role === "employee") && (
                          <Button size="icon" variant="ghost" onClick={() => setCommissionTarget(staff)} title="Commission">
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setDeleteTarget(staff); setDeleteConfirmEmail(""); }} title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Detail Sheet ─── */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>Dossier employé</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <Card><CardContent className="space-y-2 p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Nom</span><span className="text-foreground">{selected.displayName}</span></div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <div className="flex items-center gap-2">
                    <span className={hasInvalidEmail(selected) ? "text-destructive font-medium" : "text-foreground"}>
                      {selected.profile?.email || "—"}
                    </span>
                    {hasInvalidEmail(selected) && (
                      <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">INVALIDE</span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        setEmailEditTarget(selected);
                        setNewEmail(selected.profile?.email || "");
                      }}
                      title="Modifier l'email"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rôle</span><span className="text-foreground">{ROLE_LABELS[selected.role] || selected.role}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dernière connexion</span><span className="text-foreground">{selected.lastLoginAt ? format(new Date(selected.lastLoginAt), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}</span></div>
              </CardContent></Card>

              {/* Invalid email warning in detail */}
              {hasInvalidEmail(selected) && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Email invalide — les actions email ne fonctionneront pas</p>
                    <p>L'email « {selected.profile?.email || "(vide)"} » est invalide (il manque probablement le domaine complet, ex: .ca). Cliquez sur l'icône ✏️ à côté de l'email pour le corriger.</p>
                  </div>
                </div>
              )}

              <Card><CardContent className="space-y-3 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accès portails</p>
                {[
                  { key: "can_access_core", label: "Nivra Core" },
                  { key: "can_access_employee", label: "Nivra Employee" },
                  { key: "can_access_field", label: "Nivra Field" },
                  { key: "can_access_technician", label: "Nivra Technician" },
                ].map((portal) => (
                  <label key={portal.key} className="flex items-center justify-between gap-3 text-sm text-foreground">
                    <span>{portal.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[portal.key])}
                      onChange={(e) => {
                        const value = e.target.checked;
                        setSelected((c: any) => ({ ...c, [portal.key]: value }));
                        portalMutation.mutate({ userId: selected.user_id, key: portal.key, value });
                      }}
                    />
                  </label>
                ))}
              </CardContent></Card>

              <Card><CardContent className="space-y-3 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sécurité & statut</p>
                <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                  <span>MFA obligatoire</span>
                  <input
                    type="checkbox"
                    checked={Boolean(selected.mfaRequired)}
                    onChange={(e) => {
                      const required = e.target.checked;
                      setSelected((c: any) => ({ ...c, mfaRequired: required }));
                      mfaMutation.mutate({ userId: selected.user_id, required });
                    }}
                  />
                </label>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Changer le rôle</p>
                  <Select
                    value={selected.role}
                    onValueChange={(v) => {
                      setSelected((c: any) => ({ ...c, role: v }));
                      roleMutation.mutate({ userId: selected.user_id, role: v });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={(selected.status || "active") === "active" ? "destructive" : "default"}
                    onClick={() => {
                      const next = (selected.status || "active") !== "active";
                      statusMutation.mutate({ userId: selected.user_id, status: next ? "active" : "disabled" });
                      setSelected((c: any) => ({ ...c, status: next ? "active" : "disabled" }));
                    }}
                  >
                    {(selected.status || "active") === "active" ? <><Ban className="mr-1 h-3.5 w-3.5" /> Désactiver</> : <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Activer</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selected.profile?.email || hasInvalidEmail(selected)}
                    onClick={() => handleEmailAction(selected.profile?.email, () => resetPwMutation.mutate(selected.profile.email))}
                    title={hasInvalidEmail(selected) ? "Corrigez l'email d'abord" : ""}
                  >
                    <Mail className="mr-1 h-3.5 w-3.5" /> Réinit. mot de passe
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setPinResetTarget(selected); setNewPin(""); }}>
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> Réinit. PIN
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { setDeleteTarget(selected); setDeleteConfirmEmail(""); }}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
                  </Button>
                </div>
              </CardContent></Card>

              <Card><CardContent className="space-y-3 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invitation</p>
                {(() => {
                  const inv = invitationByUser.get(selected.user_id);
                  const emailOk = !hasInvalidEmail(selected);
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-border p-2">
                          <p className="text-muted-foreground">Statut</p>
                          <p className="font-medium text-foreground">{inv ? INVITATION_LABELS[inv.status] || inv.status : "Aucune"}</p>
                        </div>
                        <div className="rounded border border-border p-2">
                          <p className="text-muted-foreground">Expiration</p>
                          <p className="font-medium text-foreground">{inv?.expires_at ? format(new Date(inv.expires_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}</p>
                        </div>
                      </div>
                      {!emailOk && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Corrigez l'email avant d'envoyer des invitations
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={() => invitationMutation.mutate({ action: "generate_invitation", userId: selected.user_id })} disabled={invitationMutation.isPending}>Générer</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={invitationMutation.isPending || !emailOk}
                          onClick={() => handleEmailAction(selected.profile?.email, () => invitationMutation.mutate({ action: "send_invitation", userId: selected.user_id }))}
                        >
                          Envoyer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={invitationMutation.isPending || !emailOk}
                          onClick={() => handleEmailAction(selected.profile?.email, () => invitationMutation.mutate({ action: "resend_invitation", userId: selected.user_id }))}
                        >
                          Renvoyer
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => invitationMutation.mutate({ action: "revoke_invitation", userId: selected.user_id })} disabled={invitationMutation.isPending}>Révoquer</Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent></Card>

              {/* Commission section - expanded for all applicable roles */}
              {(selected.role === "field_sales" || selected.role === "sales" || selected.role === "employee") && (
                <Card><CardContent className="space-y-3 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commission</p>
                  {selected.permissions?.commission ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-border p-2">
                          <p className="text-muted-foreground">Type</p>
                          <p className="font-medium text-foreground">{COMMISSION_TYPE_LABELS[selected.permissions.commission.type] || selected.permissions.commission.type}</p>
                        </div>
                        <div className="rounded border border-border p-2">
                          <p className="text-muted-foreground">Valeur</p>
                          <p className="font-medium text-foreground">
                            {selected.permissions.commission.type === "flat_bonus"
                              ? `${selected.permissions.commission.value} $`
                              : `${selected.permissions.commission.value}%`}
                          </p>
                        </div>
                      </div>
                      {selected.permissions.commission.updated_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Dernière mise à jour: {format(new Date(selected.permissions.commission.updated_at), "dd MMM yyyy HH:mm", { locale: fr })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune commission configurée</p>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setCommissionTarget(selected)}>
                    <DollarSign className="mr-1 h-3.5 w-3.5" /> {selected.permissions?.commission ? "Modifier" : "Configurer"} la commission
                  </Button>
                </CardContent></Card>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Create Dialog ─── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Créer un employé interne</DialogTitle>
            <DialogDescription>Remplissez les informations, assignez le rôle et les accès portail.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Prénom *</Label>
              <Input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Email *</Label>
              <Input type="email" placeholder="prenom.nom@nivra-telecom.ca" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              {form.email && !isValidEmail(form.email) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Format d'email invalide (ex: nom@domaine.ca)
                </p>
              )}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Rôle *</Label>
              <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
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
                <label key={portal.key} className="flex items-center justify-between text-sm text-foreground">
                  <span>{portal.label}</span>
                  <input type="checkbox" checked={(form as any)[portal.key]} onChange={(e) => setForm((p: any) => ({ ...p, [portal.key]: e.target.checked }))} />
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded border border-border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sécurité et activation</p>
            {[
              { key: "is_active", label: "Compte actif à la création" },
              { key: "mfa_required", label: "MFA obligatoire" },
              { key: "send_invitation", label: "Envoyer invitation par email" },
            ].map((opt) => (
              <label key={opt.key} className="flex items-center justify-between text-sm text-foreground">
                <span>{opt.label}</span>
                <input type="checkbox" checked={(form as any)[opt.key]} onChange={(e) => setForm((p: any) => ({ ...p, [opt.key]: e.target.checked }))} />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                if (!isValidEmail(form.email)) {
                  toast.error("Format d'email invalide. Vérifiez que l'email contient un domaine valide (ex: nom@nivra-telecom.ca)");
                  return;
                }
                createMutation.mutate(form);
              }}
              disabled={!form.first_name.trim() || !form.last_name.trim() || !form.email.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer l'employé
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Supprimer définitivement</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera <strong>{deleteTarget?.displayName}</strong> ({deleteTarget?.profile?.email}) de façon permanente :
              login, rôle, accès portail, invitations, MFA, PIN — tout sera supprimé.
              <br /><br />
              Pour confirmer, tapez l'email de l'employé ci-dessous :
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder={deleteTarget?.profile?.email || "email@example.com"}
            value={deleteConfirmEmail}
            onChange={(e) => setDeleteConfirmEmail(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConfirmEmail.trim().toLowerCase() !== (deleteTarget?.profile?.email || "").trim().toLowerCase() || deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget?.profile?.email) {
                  deleteMutation.mutate({ email: deleteTarget.profile.email, confirmEmail: deleteConfirmEmail });
                }
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── PIN Reset Dialog ─── */}
      <Dialog open={!!pinResetTarget} onOpenChange={(open) => !open && setPinResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Réinitialiser le PIN
            </DialogTitle>
            <DialogDescription>
              Nouveau PIN à 6 chiffres pour <strong>{pinResetTarget?.displayName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nouveau PIN (6 chiffres)</Label>
              <Input
                type="text"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-xl tracking-[0.5em]"
              />
            </div>
            {newPin.length > 0 && newPin.length < 6 && (
              <p className="text-xs text-destructive">{6 - newPin.length} chiffres restants</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinResetTarget(null)}>Annuler</Button>
            <Button
              onClick={() => pinResetTarget && pinResetMutation.mutate({ userId: pinResetTarget.user_id, pin: newPin })}
              disabled={newPin.length !== 6 || pinResetMutation.isPending}
            >
              {pinResetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Commission Dialog ─── */}
      <Dialog open={!!commissionTarget} onOpenChange={(open) => !open && setCommissionTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Gestion commission
            </DialogTitle>
            <DialogDescription>
              Configurez le taux de commission pour <strong>{commissionTarget?.displayName}</strong>
              {commissionTarget?.role && (
                <span className="ml-1">({ROLE_LABELS[commissionTarget.role] || commissionTarget.role})</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Show existing commission */}
          {commissionTarget?.permissions?.commission && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-muted-foreground mb-1">Commission actuelle</p>
              <div className="flex gap-4">
                <span>Type: <strong>{COMMISSION_TYPE_LABELS[commissionTarget.permissions.commission.type] || commissionTarget.permissions.commission.type}</strong></span>
                <span>Valeur: <strong>
                  {commissionTarget.permissions.commission.type === "flat_bonus"
                    ? `${commissionTarget.permissions.commission.value} $`
                    : `${commissionTarget.permissions.commission.value}%`}
                </strong></span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Type de commission</Label>
              <Select value={commissionType} onValueChange={setCommissionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base_percentage">Pourcentage de base (%)</SelectItem>
                  <SelectItem value="flat_bonus">Bonus fixe ($)</SelectItem>
                  <SelectItem value="tiered">Par palier</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {commissionType === "base_percentage" && "Pourcentage appliqué sur chaque vente activée"}
                {commissionType === "flat_bonus" && "Montant fixe en dollars par vente"}
                {commissionType === "tiered" && "Pourcentage qui augmente par palier de ventes"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{commissionType === "flat_bonus" ? "Montant ($)" : "Taux (%)"}</Label>
              <Input
                type="number"
                min={0}
                max={commissionType === "flat_bonus" ? 10000 : 100}
                step={commissionType === "flat_bonus" ? 1 : 0.5}
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder={commissionType === "flat_bonus" ? "50" : "10"}
              />
              <p className="text-xs text-muted-foreground">
                {commissionType === "flat_bonus"
                  ? `Ex: 50 = 50$ par vente activée`
                  : `Ex: 10 = 10% par vente activée`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommissionTarget(null)}>Annuler</Button>
            <Button
              onClick={() => {
                const rate = parseFloat(commissionRate);
                if (isNaN(rate) || rate < 0) { toast.error("Valeur de commission invalide"); return; }
                commissionTarget && commissionMutation.mutate({ userId: commissionTarget.user_id, rate, type: commissionType });
              }}
              disabled={!commissionRate || commissionMutation.isPending}
            >
              {commissionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer la commission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Email Edit Dialog ─── */}
      <Dialog open={!!emailEditTarget} onOpenChange={(open) => !open && setEmailEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Modifier l'email
            </DialogTitle>
            <DialogDescription>
              Changez l'email de <strong>{emailEditTarget?.displayName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email actuel</Label>
              <p className="text-sm text-muted-foreground">{emailEditTarget?.profile?.email || "(vide)"}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nouvel email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="prenom.nom@nivra-telecom.ca"
              />
              {newEmail && !isValidEmail(newEmail) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Format invalide — vérifiez le domaine (ex: .ca, .com)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailEditTarget(null)}>Annuler</Button>
            <Button
              onClick={() => {
                if (!isValidEmail(newEmail)) {
                  toast.error("Format d'email invalide");
                  return;
                }
                emailEditTarget && updateProfileMutation.mutate({
                  userId: emailEditTarget.user_id,
                  email: newEmail.trim().toLowerCase(),
                });
              }}
              disabled={!newEmail || !isValidEmail(newEmail) || updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mettre à jour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
