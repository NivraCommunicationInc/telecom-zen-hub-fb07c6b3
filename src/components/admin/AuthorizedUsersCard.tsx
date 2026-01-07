import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Users, Plus, Edit, Trash2, Shield, ShieldAlert, Phone, Mail, Loader2 } from "lucide-react";

interface AuthorizedUsersCardProps {
  clientId: string;
  clientUserId: string;
  readOnly?: boolean;
}

interface AuthorizedUser {
  id: string;
  full_name: string;
  relationship_label?: string;
  phone?: string;
  email?: string;
  permission_level: "full" | "limited";
  created_at: string;
}

const emptyForm = {
  full_name: "",
  relationship_label: "",
  phone: "",
  email: "",
  permission_level: "limited" as "full" | "limited",
};

export const AuthorizedUsersCard = ({ clientId, clientUserId, readOnly = false }: AuthorizedUsersCardProps) => {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AuthorizedUser | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isEditing, setIsEditing] = useState(false);

  const { data: authorizedUsers, isLoading } = useQuery({
    queryKey: ["authorized-users", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("authorized_users")
        .select("*")
        .eq("client_id", clientUserId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AuthorizedUser[];
    },
    enabled: !!clientUserId,
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("authorized_users").insert({
        client_id: clientUserId,
        full_name: data.full_name,
        relationship_label: data.relationship_label || null,
        phone: data.phone || null,
        email: data.email || null,
        permission_level: data.permission_level,
        created_by: user?.id,
        created_by_role: role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users", clientUserId] });
      toast({ title: "Utilisateur autorisé ajouté" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("authorized_users")
        .update({
          full_name: data.full_name,
          relationship_label: data.relationship_label || null,
          phone: data.phone || null,
          email: data.email || null,
          permission_level: data.permission_level,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users", clientUserId] });
      toast({ title: "Utilisateur autorisé mis à jour" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("authorized_users").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users", clientUserId] });
      toast({ title: "Utilisateur autorisé supprimé" });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData(emptyForm);
    setIsEditing(false);
    setSelectedUser(null);
  };

  const openAddDialog = () => {
    setFormData(emptyForm);
    setIsEditing(false);
    setDialogOpen(true);
  };

  const openEditDialog = (user: AuthorizedUser) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name,
      relationship_label: user.relationship_label || "",
      phone: user.phone || "",
      email: user.email || "",
      permission_level: user.permission_level,
    });
    setIsEditing(true);
    setDialogOpen(true);
  };

  const openDeleteDialog = (user: AuthorizedUser) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.full_name.trim()) {
      toast({ title: "Le nom complet est requis", variant: "destructive" });
      return;
    }
    if (isEditing && selectedUser) {
      updateMutation.mutate({ id: selectedUser.id, data: formData });
    } else {
      addMutation.mutate(formData);
    }
  };

  const isPending = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            Utilisateurs autorisés (Second Contact)
          </CardTitle>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={openAddDialog}>
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : authorizedUsers && authorizedUsers.length > 0 ? (
            authorizedUsers.map((au) => (
              <div
                key={au.id}
                className="p-3 rounded-lg border border-border bg-accent/30 flex items-start justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{au.full_name}</span>
                    {au.relationship_label && (
                      <span className="text-xs text-muted-foreground">
                        ({au.relationship_label})
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {au.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {au.phone}
                      </span>
                    )}
                    {au.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {au.email}
                      </span>
                    )}
                  </div>
                  <Badge 
                    variant={au.permission_level === "full" ? "default" : "outline"}
                    className={au.permission_level === "full" 
                      ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" 
                      : "bg-amber-500/20 text-amber-600 border-amber-500/30"
                    }
                  >
                    {au.permission_level === "full" ? (
                      <><Shield className="w-3 h-3 mr-1" /> Full Authorized</>
                    ) : (
                      <><ShieldAlert className="w-3 h-3 mr-1" /> Limited Authorized</>
                    )}
                  </Badge>
                </div>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEditDialog(au)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openDeleteDialog(au)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun utilisateur autorisé
            </p>
          )}

          {!readOnly && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Niveaux de permission:</p>
              <p><span className="text-emerald-600 font-medium">Full Authorized:</span> Mêmes permissions que le titulaire (peut tout faire)</p>
              <p><span className="text-amber-600 font-medium">Limited Authorized:</span> Peut changer de forfait, canaux TV, équipements, RDV, paiements. Ne peut PAS annuler ou commander de nouveaux services.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Modifier" : "Ajouter"} un utilisateur autorisé
            </DialogTitle>
            <DialogDescription>
              Cette personne pourra agir au nom du client selon son niveau de permission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Jean Dupont"
              />
            </div>

            <div className="space-y-2">
              <Label>Relation/Rôle</Label>
              <Input
                value={formData.relationship_label}
                onChange={(e) => setFormData({ ...formData, relationship_label: e.target.value })}
                placeholder="Conjoint, Parent, Assistant..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(514) 555-1234"
                />
              </div>
              <div className="space-y-2">
                <Label>Courriel</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Niveau de permission *</Label>
              <Select
                value={formData.permission_level}
                onValueChange={(v) => setFormData({ ...formData, permission_level: v as "full" | "limited" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      Full Authorized (Niveau 1)
                    </div>
                  </SelectItem>
                  <SelectItem value="limited">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      Limited Authorized (Niveau 2)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEditing ? "Mettre à jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur autorisé?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser?.full_name} n'aura plus accès au compte client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && deleteMutation.mutate(selectedUser.id)}
              disabled={isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
