import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { 
  Users, 
  Plus, 
  Shield, 
  UserCog, 
  Wrench, 
  MoreHorizontal,
  Ban,
  CheckCircle,
  KeyRound,
  RefreshCw,
  History,
  ExternalLink,
  Settings2,
  Eye,
  BadgeCheck,
  Phone,
  Trash2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ALL_PERMISSIONS, PERMISSION_LABELS, DEFAULT_PERMISSIONS, type Permission, type PermissionSet } from "@/hooks/useUserPermissions";
import { 
  CreateUserDialog, 
  type CreateUserFormData,
  SetPinDialog,
  SetPasswordDialog,
  UserDetailsDrawer,
  StaffFilters,
  type StaffRole,
  type StatusFilter,
  type PinFilter,
} from "@/components/admin/users";

type StaffStatus = "active" | "disabled" | "hold";

interface StaffUser {
  id: string;
  email: string;
  role: StaffRole;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  is_active: boolean;
  status: StaffStatus;
  source: "user_roles" | "employees" | "technicians";
  permissions: Partial<PermissionSet>;
  phone?: string | null;
  badge_number?: string | null;
  job_title?: string | null;
  pin_set_at?: string | null;
  require_password_change?: boolean;
  last_login_at?: string | null;
}

const statusConfig: Record<StaffStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  disabled: { label: "Désactivé", variant: "destructive" },
  hold: { label: "En attente", variant: "outline" },
};

const roleConfig: Record<StaffRole, { label: string; icon: typeof Shield; variant: "default" | "secondary" | "outline" }> = {
  admin: { label: "Administrateur", icon: Shield, variant: "default" },
  employee: { label: "Employé", icon: UserCog, variant: "secondary" },
  technician: { label: "Technicien", icon: Wrench, variant: "outline" },
};

const AdminUsersAccess = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinDialogMode, setPinDialogMode] = useState<"set" | "reset">("set");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] = useState<"set" | "reset">("set");
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  
  // Selected user
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [newRole, setNewRole] = useState<StaffRole>("employee");
  const [newStatus, setNewStatus] = useState<StaffStatus>("active");
  const [editingPermissions, setEditingPermissions] = useState<Partial<PermissionSet>>({});
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pinFilter, setPinFilter] = useState<PinFilter>("all");

  // Error modal
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalDetails, setErrorModalDetails] = useState<{
    request_id?: string;
    step?: string;
    message?: string;
    http_status?: number;
    parsed?: unknown;
    raw_body?: string | null;
  } | null>(null);

  // Fetch all staff users from multiple sources
  const { data: staffUsers, isLoading, refetch } = useQuery({
    queryKey: ["admin-all-staff-users"],
    queryFn: async () => {
      const users: StaffUser[] = [];

      // 1. Get users with staff roles from user_roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, permissions, is_active, status, require_password_change, last_login_at, created_at")
        .in("role", ["admin", "employee", "technician"]);

      if (rolesError) throw rolesError;

      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, created_at")
          .in("user_id", userIds);

        rolesData.forEach(roleRow => {
          const profile = profiles?.find(p => p.user_id === roleRow.user_id);
          users.push({
            id: roleRow.user_id,
            email: profile?.email || "—",
            role: roleRow.role as StaffRole,
            full_name: profile?.full_name || null,
            created_at: roleRow.created_at || profile?.created_at || new Date().toISOString(),
            last_sign_in_at: null,
            banned_until: null,
            is_active: roleRow.is_active !== false,
            status: (roleRow.status as StaffStatus) || "active",
            source: "user_roles",
            permissions: (roleRow.permissions as Partial<PermissionSet>) || {},
            require_password_change: roleRow.require_password_change || false,
            last_login_at: roleRow.last_login_at || null,
          });
        });
      }

      // 2. Get employees from employees table (merge with existing)
      const { data: employeesData } = await supabase
        .from("employees")
        .select("id, email, full_name, is_active, created_at, updated_at, phone, badge_number, job_title, pin_set_at");

      if (employeesData) {
        employeesData.forEach(emp => {
          const existingIndex = users.findIndex(u => u.email.toLowerCase() === emp.email.toLowerCase());
          if (existingIndex === -1) {
            users.push({
              id: emp.id,
              email: emp.email,
              role: "employee",
              full_name: emp.full_name,
              created_at: emp.created_at,
              last_sign_in_at: emp.updated_at,
              banned_until: null,
              is_active: emp.is_active,
              status: emp.is_active ? "active" : "disabled",
              source: "employees",
              permissions: {},
              phone: emp.phone,
              badge_number: emp.badge_number,
              job_title: emp.job_title,
              pin_set_at: emp.pin_set_at,
            });
          } else {
            // Merge employee info
            users[existingIndex].is_active = emp.is_active;
            users[existingIndex].last_sign_in_at = emp.updated_at;
            users[existingIndex].phone = emp.phone;
            users[existingIndex].badge_number = emp.badge_number;
            users[existingIndex].job_title = emp.job_title;
            users[existingIndex].pin_set_at = emp.pin_set_at;
          }
        });
      }

      // 3. Get technicians from technicians table
      const { data: techniciansData } = await supabase
        .from("technicians")
        .select("id, user_id, email, full_name, status, created_at, updated_at, phone");

      if (techniciansData) {
        techniciansData.forEach(tech => {
          const existingIndex = users.findIndex(u => u.email.toLowerCase() === tech.email.toLowerCase());
          if (existingIndex === -1) {
            users.push({
              id: tech.user_id || tech.id,
              email: tech.email,
              role: "technician",
              full_name: tech.full_name,
              created_at: tech.created_at,
              last_sign_in_at: tech.updated_at,
              banned_until: null,
              is_active: tech.status === "active",
              status: tech.status === "active" ? "active" : "disabled",
              source: "technicians",
              permissions: {},
              phone: tech.phone,
            });
          } else {
            // Merge technician info
            users[existingIndex].is_active = tech.status === "active";
            users[existingIndex].last_sign_in_at = tech.updated_at;
            if (tech.phone) users[existingIndex].phone = tech.phone;
          }
        });
      }

      return users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  // Helper to extract error details from response
  const extractErrorDetails = async (response: { error?: { message: string }; data?: unknown; response?: Response }) => {
    const httpStatus = response.response?.status;
    let rawBody: string | null = null;
    let parsed: unknown = null;

    if (response.error) {
      try {
        rawBody = response.response ? await response.response.clone().text() : null;
        parsed = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        parsed = null;
      }
    } else if (response.data && (response.data as any)?.ok === false) {
      parsed = response.data;
      rawBody = JSON.stringify(response.data);
    }

    const requestId = (parsed as any)?.request_id;
    const step = (parsed as any)?.step;
    const message = (parsed as any)?.message || (parsed as any)?.error?.message || response.error?.message || "Erreur inconnue";

    return { request_id: requestId, step, message, http_status: httpStatus, parsed, raw_body: rawBody };
  };

  // Create staff mutation (extended)
  const createMutation = useMutation({
    mutationFn: async (data: CreateUserFormData & { permissions: Partial<PermissionSet> }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: {
          action: "create",
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          require_password_change: data.send_invitation,
          permissions: data.permissions,
          phone: data.phone || undefined,
          badge_number: data.badge_number,
          job_title: data.job_title || undefined,
          pin: data.pin || undefined,
          require_pin_change: data.require_pin_change,
          is_active: data.is_active,
          send_invitation: data.send_invitation,
          internal_note: data.internal_note || undefined,
        },
      });

      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        const err = Object.assign(new Error(details.message), { details });
        throw err;
      }

      return response.data;
    },
    onSuccess: (data: { mode?: string; message?: string }) => {
      const isPromoted = data?.mode === "existing_user_promoted";
      toast({ 
        title: isPromoted ? "Compte existant mis à jour" : "Succès", 
        description: isPromoted 
          ? "Compte déjà existant — rôle mis à jour." 
          : "Utilisateur créé avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setCreateDialogOpen(false);
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      const details = error.details;
      setErrorModalDetails(details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive", duration: 15000 });
    },
  });

  // Disable user mutation
  const disableMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "disable", user_id: userId },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur désactivé" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Enable user mutation
  const enableMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "enable", user_id: userId },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur activé" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: StaffRole }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "change_role", user_id: userId, new_role: newRole },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Rôle modifié" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setChangeRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Send reset mutation
  const sendResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "send_reset", email },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Email de réinitialisation envoyé" });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive", duration: 15000 });
    },
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Partial<PermissionSet> }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "update_permissions", user_id: userId, permissions },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Permissions mises à jour" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setPermissionsDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Apply role pack mutation - sends both user_id and email for robustness
  const applyRolePackMutation = useMutation({
    mutationFn: async (staff: StaffUser) => {
      // Always send target_email + target_role for robustness
      // staff.id may be Auth user_id (from user_roles) or employees.id/technicians.id
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { 
          action: "apply_role_pack", 
          target_user_id: staff.id,
          target_email: staff.email,
          target_role: staff.role,
        },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: (data: { role?: string }) => {
      toast({ title: "Succès", description: `Pack de permissions "${data.role}" appliqué` });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Set/Reset PIN mutation
  const setPinMutation = useMutation({
    mutationFn: async ({ userId, pin, requireChange, isReset }: { userId: string; pin: string; requireChange: boolean; isReset: boolean }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { 
          action: isReset ? "reset_pin" : "set_pin", 
          user_id: userId, 
          pin,
          require_pin_change: requireChange,
        },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: pinDialogMode === "reset" ? "PIN réinitialisé" : "PIN défini" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setPinDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Force password change mutation
  const forcePasswordChangeMutation = useMutation({
    mutationFn: async ({ userId, requireChange }: { userId: string; requireChange: boolean }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "force_password_change", user_id: userId, require_change: requireChange },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: (data: { message?: string }) => {
      toast({ title: "Succès", description: data?.message || "Paramètre mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Set staff password mutation
  const setStaffPasswordMutation = useMutation({
    mutationFn: async ({ userId, password, forceChange }: { userId: string; password: string; forceChange: boolean }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { 
          action: "set_staff_password", 
          user_id: userId, 
          password,
          force_change: forceChange,
        },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: passwordDialogMode === "reset" ? "Mot de passe réinitialisé" : "Mot de passe défini" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setPasswordDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Send password reset email mutation (for staff - not PIN!)
  const sendPasswordResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "send_password_reset", email },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Email de réinitialisation du mot de passe envoyé" });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive", duration: 15000 });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: StaffStatus }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "update_status", user_id: userId, status },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: (data: { message?: string }) => {
      toast({ title: "Succès", description: data?.message || "Statut mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setStatusDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Hard delete mutation
  const hardDeleteMutation = useMutation({
    mutationFn: async ({ email, confirmEmail }: { email: string; confirmEmail: string }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "hard_delete_user", email, confirm_email: confirmEmail },
      });
      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        throw Object.assign(new Error(details.message), { details });
      }
      return response.data;
    },
    onSuccess: (data: { message?: string }) => {
      toast({ title: "Succès", description: data?.message || "Utilisateur supprimé définitivement" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      setDeleteConfirmEmail("");
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      setErrorModalDetails(error.details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const openPermissionsDialog = (user: StaffUser) => {
    setSelectedUser(user);
    const roleDefaults = DEFAULT_PERMISSIONS[user.role] || {};
    const merged: Partial<PermissionSet> = {};
    ALL_PERMISSIONS.forEach(perm => {
      merged[perm] = user.permissions[perm] ?? roleDefaults[perm] ?? false;
    });
    setEditingPermissions(merged);
    setPermissionsDialogOpen(true);
  };

  const handleSavePermissions = () => {
    if (selectedUser) {
      updatePermissionsMutation.mutate({ userId: selectedUser.id, permissions: editingPermissions });
    }
  };

  const togglePermission = (perm: Permission) => {
    setEditingPermissions(prev => ({
      ...prev,
      [perm]: !prev[perm],
    }));
  };

  const handleChangeRole = () => {
    if (selectedUser) {
      changeRoleMutation.mutate({ userId: selectedUser.id, newRole });
    }
  };

  const openPinDialog = (user: StaffUser, mode: "set" | "reset") => {
    setSelectedUser(user);
    setPinDialogMode(mode);
    setPinDialogOpen(true);
  };

  const handleSetPin = (pin: string, requireChange: boolean) => {
    if (selectedUser) {
      setPinMutation.mutate({ 
        userId: selectedUser.id, 
        pin, 
        requireChange, 
        isReset: pinDialogMode === "reset" 
      });
    }
  };

  const openPasswordDialog = (user: StaffUser, mode: "set" | "reset") => {
    setSelectedUser(user);
    setPasswordDialogMode(mode);
    setPasswordDialogOpen(true);
  };

  const handleSetPassword = (data: { password: string; forceChange: boolean }) => {
    if (selectedUser) {
      setStaffPasswordMutation.mutate({ 
        userId: selectedUser.id, 
        password: data.password, 
        forceChange: data.forceChange,
      });
    }
  };

  const openDetailsDrawer = (user: StaffUser) => {
    setSelectedUser(user);
    setDetailsDrawerOpen(true);
  };

  // Filter users
  const filteredUsers = staffUsers?.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.badge_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && user.status === "active") ||
      (statusFilter === "disabled" && (user.status === "disabled" || user.status === "hold"));
    const matchesPin = pinFilter === "all" ||
      (pinFilter === "defined" && user.pin_set_at) ||
      (pinFilter === "not_defined" && !user.pin_set_at);
    return matchesSearch && matchesRole && matchesStatus && matchesPin;
  });

  const countByRole = {
    admin: staffUsers?.filter(u => u.role === "admin").length || 0,
    employee: staffUsers?.filter(u => u.role === "employee").length || 0,
    technician: staffUsers?.filter(u => u.role === "technician").length || 0,
    total: staffUsers?.length || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Utilisateurs & Accès</h1>
            <p className="text-muted-foreground mt-1">Gestion centralisée de tous les comptes staff</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer un utilisateur
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{countByRole.total}</p>
                  <p className="text-xs text-muted-foreground">Total Staff</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{countByRole.admin}</p>
                  <p className="text-xs text-muted-foreground">Administrateurs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-secondary-foreground" />
                <div>
                  <p className="text-2xl font-bold">{countByRole.employee}</p>
                  <p className="text-xs text-muted-foreground">Employés</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{countByRole.technician}</p>
                  <p className="text-xs text-muted-foreground">Techniciens</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="staff" className="space-y-4">
          <TabsList>
            <TabsTrigger value="staff">
              <Users className="h-4 w-4 mr-2" />
              Staff (Admin/Employé/Tech)
            </TabsTrigger>
            <TabsTrigger value="clients" asChild>
              <Link to="/admin/clients" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Clients
              </Link>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Personnel
                    </CardTitle>
                    <CardDescription>
                      Administrateurs, employés et techniciens avec accès au système
                    </CardDescription>
                  </div>
                  <StaffFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    roleFilter={roleFilter}
                    onRoleFilterChange={setRoleFilter}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    pinFilter={pinFilter}
                    onPinFilterChange={setPinFilter}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !filteredUsers || filteredUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Aucun utilisateur trouvé</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Badge</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>PIN</TableHead>
                        <TableHead>Créé le</TableHead>
                        <TableHead>Dernière activité</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map(user => {
                        const config = roleConfig[user.role];
                        const Icon = config.icon;
                        return (
                          <TableRow key={`${user.source}-${user.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{user.full_name || "—"}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                {user.job_title && (
                                  <p className="text-xs text-muted-foreground">{user.job_title}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={config.variant} className="gap-1">
                                <Icon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const statusCfg = statusConfig[user.status];
                                return (
                                  <Badge variant={statusCfg.variant} className="gap-1">
                                    {user.status === "hold" && <Clock className="h-3 w-3" />}
                                    {statusCfg.label}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              {user.badge_number ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <BadgeCheck className="h-3 w-3 text-muted-foreground" />
                                  {user.badge_number}
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              {user.phone ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {user.phone}
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.pin_set_at ? "default" : "outline"} className="text-xs">
                                {user.pin_set_at ? "Défini" : "Non"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(user.created_at), "d MMM yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              {(user.last_login_at || user.last_sign_in_at)
                                ? format(new Date(user.last_login_at || user.last_sign_in_at!), "d MMM yyyy HH:mm", { locale: fr })
                                : "—"
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openDetailsDrawer(user)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Voir détails
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openPermissionsDialog(user)}>
                                    <Settings2 className="h-4 w-4 mr-2" />
                                    Permissions
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setNewRole(user.role);
                                      setChangeRoleDialogOpen(true);
                                    }}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Changer le rôle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => applyRolePackMutation.mutate(user)}
                                    disabled={applyRolePackMutation.isPending}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Appliquer pack du rôle
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {user.role !== "admin" && (
                                    <>
                                      <DropdownMenuItem onClick={() => openPinDialog(user, user.pin_set_at ? "reset" : "set")}>
                                        <KeyRound className="h-4 w-4 mr-2" />
                                        {user.pin_set_at ? "Réinitialiser PIN" : "Définir PIN"}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openPasswordDialog(user, "set")}>
                                        <KeyRound className="h-4 w-4 mr-2" />
                                        Définir mot de passe
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openPasswordDialog(user, "reset")}>
                                        <KeyRound className="h-4 w-4 mr-2" />
                                        Réinitialiser mot de passe
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={() => sendPasswordResetMutation.mutate(user.email)}
                                    disabled={sendPasswordResetMutation.isPending}
                                  >
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    Envoyer lien reset MDP
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => forcePasswordChangeMutation.mutate({ 
                                      userId: user.id, 
                                      requireChange: !user.require_password_change 
                                    })}
                                    disabled={forcePasswordChangeMutation.isPending}
                                  >
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    {user.require_password_change 
                                      ? "✓ Forcer changement MDP (actif)" 
                                      : "Forcer changement MDP"
                                    }
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link to={`/admin/audit-log?email=${encodeURIComponent(user.email)}`}>
                                      <History className="h-4 w-4 mr-2" />
                                      Voir l'historique
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setNewStatus(user.status);
                                      setStatusDialogOpen(true);
                                    }}
                                  >
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    Changer le statut
                                  </DropdownMenuItem>
                                  {user.status === "active" ? (
                                    <DropdownMenuItem 
                                      onClick={() => disableMutation.mutate(user.id)}
                                      disabled={disableMutation.isPending}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Ban className="h-4 w-4 mr-2" />
                                      Désactiver (legacy)
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem 
                                      onClick={() => enableMutation.mutate(user.id)}
                                      disabled={enableMutation.isPending}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Activer (legacy)
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setDeleteConfirmEmail("");
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer définitivement
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create User Dialog */}
        <CreateUserDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />

        {/* Set/Reset PIN Dialog */}
        <SetPinDialog
          open={pinDialogOpen}
          onOpenChange={setPinDialogOpen}
          userName={selectedUser?.full_name || selectedUser?.email || ""}
          isReset={pinDialogMode === "reset"}
          onSubmit={handleSetPin}
          isPending={setPinMutation.isPending}
        />

        {/* Set/Reset Password Dialog */}
        <SetPasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          userEmail={selectedUser?.email || ""}
          userName={selectedUser?.full_name || undefined}
          isReset={passwordDialogMode === "reset"}
          isPending={setStaffPasswordMutation.isPending}
          onSubmit={handleSetPassword}
        />

        {/* User Details Drawer */}
        <UserDetailsDrawer
          open={detailsDrawerOpen}
          onOpenChange={setDetailsDrawerOpen}
          user={selectedUser}
        />

        {/* Change Role Dialog */}
        <Dialog open={changeRoleDialogOpen} onOpenChange={setChangeRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Changer le rôle</DialogTitle>
              <DialogDescription>
                Modifier le rôle de {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={newRole} onValueChange={(v) => setNewRole(v as StaffRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Administrateur
                    </div>
                  </SelectItem>
                  <SelectItem value="employee">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" />
                      Employé
                    </div>
                  </SelectItem>
                  <SelectItem value="technician">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Technicien
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChangeRoleDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleChangeRole} disabled={changeRoleMutation.isPending}>
                {changeRoleMutation.isPending ? "..." : "Confirmer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Gérer les permissions</DialogTitle>
              <DialogDescription>
                Configurer les permissions de {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {ALL_PERMISSIONS.map(perm => (
                <label key={perm} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
                  <Checkbox
                    checked={editingPermissions[perm] ?? false}
                    onCheckedChange={() => togglePermission(perm)}
                  />
                  <span className="text-sm">{PERMISSION_LABELS[perm]}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSavePermissions} disabled={updatePermissionsMutation.isPending}>
                {updatePermissionsMutation.isPending ? "..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Status Dialog */}
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Changer le statut</DialogTitle>
              <DialogDescription>
                Modifier le statut de {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as StaffStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Actif
                    </div>
                  </SelectItem>
                  <SelectItem value="disabled">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-destructive" />
                      Désactivé
                    </div>
                  </SelectItem>
                  <SelectItem value="hold">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      En attente
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-3">
                {newStatus === "active" && "L'utilisateur peut accéder aux portails normalement."}
                {newStatus === "disabled" && "L'utilisateur ne pourra plus se connecter aux portails."}
                {newStatus === "hold" && "L'utilisateur est temporairement suspendu."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={() => selectedUser && updateStatusMutation.mutate({ userId: selectedUser.id, status: newStatus })} 
                disabled={updateStatusMutation.isPending}
                variant={newStatus !== "active" ? "destructive" : "default"}
              >
                {updateStatusMutation.isPending ? "..." : "Confirmer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hard Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Supprimer définitivement
              </DialogTitle>
              <DialogDescription>
                Cette action est <strong>irréversible</strong>. L'utilisateur sera supprimé de toutes les tables, 
                son historique d'audit sera effacé, et son email sera libéré pour réutilisation.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm font-medium">Utilisateur à supprimer :</p>
                <p className="text-sm text-muted-foreground">{selectedUser?.full_name}</p>
                <p className="text-sm font-mono">{selectedUser?.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Pour confirmer, retapez l'email :</label>
                <input
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  placeholder={selectedUser?.email}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                variant="destructive"
                onClick={() => selectedUser && hardDeleteMutation.mutate({ 
                  email: selectedUser.email, 
                  confirmEmail: deleteConfirmEmail 
                })}
                disabled={
                  hardDeleteMutation.isPending || 
                  deleteConfirmEmail.toLowerCase() !== selectedUser?.email.toLowerCase()
                }
              >
                {hardDeleteMutation.isPending ? "Suppression..." : "Supprimer définitivement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Error Modal */}
        <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Détails de l'erreur</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {errorModalDetails?.request_id && (
                <p><strong>Request ID:</strong> {errorModalDetails.request_id}</p>
              )}
              {errorModalDetails?.step && (
                <p><strong>Étape:</strong> {errorModalDetails.step}</p>
              )}
              {errorModalDetails?.message && (
                <p><strong>Message:</strong> {errorModalDetails.message}</p>
              )}
              {errorModalDetails?.http_status && (
                <p><strong>HTTP Status:</strong> {errorModalDetails.http_status}</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setErrorModalOpen(false)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersAccess;
