import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
  RefreshCw
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

const AdminUsers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [newRole, setNewRole] = useState<StaffRole>("employee");

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      full_name: "",
      role: "employee",
      require_password_change: true,
    },
  });

  // Fetch staff users
  const { data: staffUsers, isLoading } = useQuery({
    queryKey: ["admin-staff-users"],
    queryFn: async () => {
      // Get users with staff roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "employee", "technician"]);

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) return [];

      // Get profiles for these users
      const userIds = rolesData.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, created_at")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Combine data
      const users: StaffUser[] = rolesData.map(roleRow => {
        const profile = profiles?.find(p => p.user_id === roleRow.user_id);
        return {
          id: roleRow.user_id,
          email: profile?.email || "—",
          role: roleRow.role as StaffRole,
          full_name: profile?.full_name || null,
          created_at: profile?.created_at || new Date().toISOString(),
          last_sign_in_at: null, // We can't get this from client-side
          banned_until: null,
        };
      });

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
      queryClient.invalidateQueries({ queryKey: ["admin-staff-users"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-staff-users"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-staff-users"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-staff-users"] });
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
      try {
        console.log("[sendResetMutation] Invoking admin-manage-staff with action: send_reset, email:", email);
        const response = await supabase.functions.invoke("admin-manage-staff", {
          body: { action: "send_reset", email },
        });
        
        console.log("[sendResetMutation] Full response:", {
          data: response.data,
          error: response.error,
        });
        
        if (response.error) {
          const errorDetails = {
            message: response.error.message,
            context: response.error.context,
            name: response.error.name,
            rawBody: JSON.stringify(response.data),
          };
          console.error("[sendResetMutation] Edge Function error:", errorDetails);
          throw new Error(`Edge Function error: ${response.error.message} | Details: ${JSON.stringify(errorDetails)}`);
        }
        
        if (response.data?.ok === false) {
          const errorDetails = {
            step: response.data.step,
            status: response.data.status,
            message: response.data.message,
            stack: response.data.stack,
            provider_error: response.data.provider_error,
          };
          console.error("[sendResetMutation] Backend error:", errorDetails);
          throw new Error(`Backend error at step "${response.data.step}": ${response.data.message} | Provider: ${JSON.stringify(response.data.provider_error)}`);
        }
        
        if (response.data?.error) {
          console.error("[sendResetMutation] Legacy error format:", response.data.error);
          throw new Error(response.data.error);
        }
        
        return response.data;
      } catch (err: unknown) {
        const error = err as Error & { context?: unknown };
        console.error("[sendResetMutation] Caught exception:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
          context: error.context,
        });
        throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Succès", description: "Email de réinitialisation envoyé" });
    },
    onError: (error: Error) => {
      console.error("[sendResetMutation] onError:", error);
      toast({ 
        title: "Erreur", 
        description: error.message, 
        variant: "destructive",
        duration: 15000, // Keep visible longer for debugging
      });
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Utilisateurs & Rôles</h1>
            <p className="text-muted-foreground mt-1">Gérez les comptes du personnel administratif</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Créer un utilisateur
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Personnel
            </CardTitle>
            <CardDescription>
              Administrateurs, employés et techniciens avec accès au système
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !staffUsers || staffUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Aucun utilisateur trouvé</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffUsers.map(user => {
                    const config = roleConfig[user.role];
                    const Icon = config.icon;
                    return (
                      <TableRow key={user.id}>
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
                          {format(new Date(user.created_at), "d MMM yyyy", { locale: fr })}
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
                              <DropdownMenuSeparator />
                              {user.banned_until ? (
                                <DropdownMenuItem 
                                  onClick={() => enableMutation.mutate(user.id)}
                                  disabled={enableMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Activer
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => disableMutation.mutate(user.id)}
                                  disabled={disableMutation.isPending}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Désactiver
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
                        <Input {...field} placeholder="Jean Tremblay" />
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
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Administrateur
                            </span>
                          </SelectItem>
                          <SelectItem value="employee">
                            <span className="flex items-center gap-2">
                              <UserCog className="h-4 w-4" />
                              Employé
                            </span>
                          </SelectItem>
                          <SelectItem value="technician">
                            <span className="flex items-center gap-2">
                              <Wrench className="h-4 w-4" />
                              Technicien
                            </span>
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
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">
                        Exiger un changement de mot de passe à la première connexion
                      </FormLabel>
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
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="employee">Employé</SelectItem>
                  <SelectItem value="technician">Technicien</SelectItem>
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
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
