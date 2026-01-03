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
  Filter
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [newRole, setNewRole] = useState<StaffRole>("employee");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");

  const [resetErrorOpen, setResetErrorOpen] = useState(false);
  const [resetErrorDetails, setResetErrorDetails] = useState<{
    request_id?: string;
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
        .select("user_id, role")
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
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur créé avec succès" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Disable user mutation
  const disableMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "disable", user_id: userId },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur désactivé" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Enable user mutation
  const enableMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "enable", user_id: userId },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Utilisateur activé" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: StaffRole }) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "change_role", user_id: userId, new_role: newRole },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Rôle modifié" });
      queryClient.invalidateQueries({ queryKey: ["admin-all-staff-users"] });
      setChangeRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Send reset mutation
  const sendResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "send_reset", email },
      });

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

        const requestId = (parsed as any)?.request_id;
        const message = (parsed as any)?.error?.message || response.error.message;

        const err = Object.assign(new Error(message), {
          details: { request_id: requestId, http_status: httpStatus, parsed, raw_body: rawBody },
        });
        throw err;
      }

      if ((response.data as any)?.ok === false) {
        const requestId = (response.data as any)?.request_id;
        const message = (response.data as any)?.error?.message || "Erreur lors de l'envoi";
        const err = Object.assign(new Error(message), {
          details: { request_id: requestId, http_status: httpStatus, parsed: response.data, raw_body: JSON.stringify(response.data) },
        });
        throw err;
      }

      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Email de réinitialisation envoyé" });
    },
    onError: (error: Error & { details?: any }) => {
      const details = (error as any).details as { request_id?: string; http_status?: number; parsed?: unknown; raw_body?: string | null } | undefined;
      setResetErrorDetails(details || null);
      setResetErrorOpen(true);
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

        {/* Reset Error Dialog */}
        <Dialog open={resetErrorOpen} onOpenChange={setResetErrorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Détails de l'erreur</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {resetErrorDetails?.request_id && (
                <p><strong>Request ID:</strong> {resetErrorDetails.request_id}</p>
              )}
              {resetErrorDetails?.http_status && (
                <p><strong>HTTP Status:</strong> {resetErrorDetails.http_status}</p>
              )}
              {resetErrorDetails?.raw_body && (
                <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40">
                  {resetErrorDetails.raw_body}
                </pre>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setResetErrorOpen(false)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersAccess;
