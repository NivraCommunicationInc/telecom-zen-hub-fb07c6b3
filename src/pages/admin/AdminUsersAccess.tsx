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
  Search,
  Filter,
  Settings2
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ALL_PERMISSIONS, PERMISSION_LABELS, DEFAULT_PERMISSIONS, type Permission, type PermissionSet } from "@/hooks/useUserPermissions";

type StaffRole = "admin" | "employee" | "technician";

interface StaffUser {
  id: string;
  email: string;
  role: StaffRole;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  is_active: boolean;
  source: "user_roles" | "employees" | "technicians";
  permissions: Partial<PermissionSet>;
}

const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  full_name: z.string().min(2, "Nom requis (min 2 caractères)"),
  role: z.enum(["admin", "employee", "technician"]),
  require_password_change: z.boolean(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

const roleConfig: Record<StaffRole, { label: string; icon: typeof Shield; variant: "default" | "secondary" | "outline" }> = {
  admin: { label: "Administrateur", icon: Shield, variant: "default" },
  employee: { label: "Employé", icon: UserCog, variant: "secondary" },
  technician: { label: "Technicien", icon: Wrench, variant: "outline" },
};

const AdminUsersAccess = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [newRole, setNewRole] = useState<StaffRole>("employee");
  const [editingPermissions, setEditingPermissions] = useState<Partial<PermissionSet>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");

  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalDetails, setErrorModalDetails] = useState<{
    request_id?: string;
    step?: string;
    message?: string;
    http_status?: number;
    parsed?: unknown;
    raw_body?: string | null;
  } | null>(null);

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      full_name: "",
      role: "employee",
      require_password_change: true,
    },
  });

  // Fetch all staff users from multiple sources
  const { data: staffUsers, isLoading, refetch } = useQuery({
    queryKey: ["admin-all-staff-users"],
    queryFn: async () => {
      const users: StaffUser[] = [];

      // 1. Get users with staff roles from user_roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, permissions")
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
            created_at: profile?.created_at || new Date().toISOString(),
            last_sign_in_at: null,
            banned_until: null,
            is_active: true,
            source: "user_roles",
            permissions: (roleRow.permissions as Partial<PermissionSet>) || {},
          });
        });
      }

      // 2. Get employees from employees table (if not already in user_roles)
      const { data: employeesData } = await supabase
        .from("employees")
        .select("id, email, full_name, is_active, created_at, updated_at");

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
              source: "employees",
              permissions: {},
            });
          } else {
            // Merge info
            users[existingIndex].is_active = emp.is_active;
            users[existingIndex].last_sign_in_at = emp.updated_at;
          }
        });
      }

      // 3. Get technicians from technicians table
      const { data: techniciansData } = await supabase
        .from("technicians")
        .select("id, email, full_name, status, created_at, updated_at");

      if (techniciansData) {
        techniciansData.forEach(tech => {
          const existingIndex = users.findIndex(u => u.email.toLowerCase() === tech.email.toLowerCase());
          if (existingIndex === -1) {
            users.push({
              id: tech.id,
              email: tech.email,
              role: "technician",
              full_name: tech.full_name,
              created_at: tech.created_at,
              last_sign_in_at: tech.updated_at,
              banned_until: null,
              is_active: tech.status === "active",
              source: "technicians",
              permissions: {},
            });
          } else {
            // Merge info
            users[existingIndex].is_active = tech.status === "active";
            users[existingIndex].last_sign_in_at = tech.updated_at;
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

  // Create staff mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: {
          action: "create",
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          require_password_change: data.require_password_change,
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
        variant: isPromoted ? "default" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setCreateDialogOpen(false);
      form.reset();
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
        const err = Object.assign(new Error(details.message), { details });
        throw err;
      }

      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur désactivé" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      const details = error.details;
      setErrorModalDetails(details || null);
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
        const err = Object.assign(new Error(details.message), { details });
        throw err;
      }

      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur activé" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      const details = error.details;
      setErrorModalDetails(details || null);
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
        const err = Object.assign(new Error(details.message), { details });
        throw err;
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
      const details = error.details;
      setErrorModalDetails(details || null);
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
        const err = Object.assign(new Error(details.message), { details });
        throw err;
      }

      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Email de réinitialisation envoyé" });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      const details = error.details;
      setErrorModalDetails(details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive", duration: 15000 });
    },
  });

  const handleCreateSubmit = (data: CreateUserForm) => {
    createMutation.mutate(data);
  };

  const handleChangeRole = () => {
    if (selectedUser) {
      changeRoleMutation.mutate({ userId: selectedUser.id, newRole });
    }
  };

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Partial<PermissionSet> }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "update_permissions", user_id: userId, permissions },
      });

      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        const err = Object.assign(new Error(details.message), { details });
        throw err;
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
      const details = error.details;
      setErrorModalDetails(details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const openPermissionsDialog = (user: StaffUser) => {
    setSelectedUser(user);
    // Initialize with user's current permissions merged with role defaults
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

  // Apply role pack mutation
  const applyRolePackMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "apply_role_pack", user_id: userId },
      });

      if (response.error || (response.data as any)?.ok === false) {
        const details = await extractErrorDetails(response);
        const err = Object.assign(new Error(details.message), { details });
        throw err;
      }

      return response.data;
    },
    onSuccess: (data: { role?: string }) => {
      toast({ title: "Succès", description: `Pack de permissions "${data.role}" appliqué` });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
    },
    onError: (error: Error & { details?: typeof errorModalDetails }) => {
      const details = error.details;
      setErrorModalDetails(details || null);
      setErrorModalOpen(true);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Filter users
  const filteredUsers = staffUsers?.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
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
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-[200px]"
                      />
                    </div>
                    <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as StaffRole | "all")}>
                      <SelectTrigger className="w-[160px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Tous les rôles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les rôles</SelectItem>
                        <SelectItem value="admin">Administrateurs</SelectItem>
                        <SelectItem value="employee">Employés</SelectItem>
                        <SelectItem value="technician">Techniciens</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={config.variant} className="gap-1">
                                <Icon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.is_active ? "default" : "secondary"}>
                                {user.is_active ? "Actif" : "Désactivé"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(user.created_at), "d MMM yyyy", { locale: fr })}
                            </TableCell>
                            <TableCell>
                              {user.last_sign_in_at 
                                ? format(new Date(user.last_sign_in_at), "d MMM yyyy HH:mm", { locale: fr })
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
                                  <DropdownMenuItem 
                                    onClick={() => openPermissionsDialog(user)}
                                  >
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
                                    onClick={() => sendResetMutation.mutate(user.email)}
                                    disabled={sendResetMutation.isPending}
                                  >
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    Envoyer réinitialisation
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link to={`/admin/audit-log?email=${encodeURIComponent(user.email)}`}>
                                      <History className="h-4 w-4 mr-2" />
                                      Voir l'historique
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => applyRolePackMutation.mutate(user.id)}
                                    disabled={applyRolePackMutation.isPending}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Appliquer pack du rôle
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {user.is_active ? (
                                    <DropdownMenuItem 
                                      onClick={() => disableMutation.mutate(user.id)}
                                      disabled={disableMutation.isPending}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Ban className="h-4 w-4 mr-2" />
                                      Désactiver
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem 
                                      onClick={() => enableMutation.mutate(user.id)}
                                      disabled={enableMutation.isPending}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Activer
                                    </DropdownMenuItem>
                                  )}
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
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un utilisateur</DialogTitle>
              <DialogDescription>
                Ajoutez un nouveau membre du personnel avec accès au système
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="nom@nivratelecom.ca" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom complet</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jean Dupont" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rôle</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un rôle" />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="require_password_change"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Exiger changement de mot de passe au premier login
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Création..." : "Créer"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

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
                {changeRoleMutation.isPending ? "Modification..." : "Confirmer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Error Details Modal */}
        <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détails de l'erreur</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {errorModalDetails?.request_id && (
                <p><strong>Request ID:</strong> <code className="bg-muted px-1 rounded">{errorModalDetails.request_id}</code></p>
              )}
              {errorModalDetails?.step && (
                <p><strong>Étape:</strong> <code className="bg-muted px-1 rounded">{errorModalDetails.step}</code></p>
              )}
              {errorModalDetails?.message && (
                <p><strong>Message:</strong> {errorModalDetails.message}</p>
              )}
              {errorModalDetails?.http_status && (
                <p><strong>HTTP Status:</strong> {errorModalDetails.http_status}</p>
              )}
              {errorModalDetails?.raw_body && (
                <div>
                  <p className="mb-1"><strong>Réponse JSON:</strong></p>
                  <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-48">
                    {errorModalDetails.raw_body}
                  </pre>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setErrorModalOpen(false)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Permissions - {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
              <DialogDescription>
                Configurez les permissions granulaires pour cet utilisateur. 
                {selectedUser?.role === "admin" && (
                  <span className="text-primary font-medium"> (Les administrateurs ont toutes les permissions par défaut)</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ALL_PERMISSIONS.map(perm => (
                  <div 
                    key={perm} 
                    className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={`perm-${perm}`}
                      checked={editingPermissions[perm] ?? false}
                      onCheckedChange={() => togglePermission(perm)}
                      disabled={selectedUser?.role === "admin"}
                    />
                    <label
                      htmlFor={`perm-${perm}`}
                      className="text-sm font-medium leading-none cursor-pointer flex-1"
                    >
                      {PERMISSION_LABELS[perm]}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleSavePermissions} 
                disabled={updatePermissionsMutation.isPending || selectedUser?.role === "admin"}
              >
                {updatePermissionsMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersAccess;
