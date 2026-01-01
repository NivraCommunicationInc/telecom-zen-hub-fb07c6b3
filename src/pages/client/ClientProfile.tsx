import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Save, Loader2, Lock, CreditCard, DollarSign, Calendar, Eye, EyeOff, Wifi, Settings, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ClientProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["client-subscriptions-count", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user?.id)
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: orders } = useQuery({
    queryKey: ["client-orders-count", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
      });
    }
  }, [profile, user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          phone: data.phone,
        })
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      toast({ title: "Profil mis à jour avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { newPassword: string }) => {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mot de passe modifié avec succès" });
      setPasswordDialogOpen(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur lors du changement de mot de passe", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const handlePasswordChange = () => {
    if (passwordForm.newPassword.length < 6) {
      toast({ title: "Le mot de passe doit contenir au moins 6 caractères", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ newPassword: passwordForm.newPassword });
  };

  const accountStatusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-500",
    frozen: "bg-blue-500/20 text-blue-500",
    hold: "bg-amber-500/20 text-amber-500",
    suspended: "bg-red-500/20 text-red-500",
  };

  const accountStatusLabels: Record<string, string> = {
    active: "Actif",
    frozen: "Gelé",
    hold: "En attente",
    suspended: "Suspendu",
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Mon profil</h1>
          <p className="text-muted-foreground mt-1">Gérez vos informations personnelles et votre compte</p>
        </div>

        {/* Account Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                accountStatusColors[profile?.account_status || "active"]?.replace("text-", "bg-").replace("/20", "/20")
              } bg-emerald-500/20`}>
                <User className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <Badge className={accountStatusColors[profile?.account_status || "active"]}>
                  {accountStatusLabels[profile?.account_status || "active"]}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Statut</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {Number(profile?.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
                <p className="text-xs text-muted-foreground">Solde dû</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-500">
                  {Number(profile?.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
                <p className="text-xs text-muted-foreground">Crédit</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">
                  {profile?.created_at ? format(new Date(profile.created_at), "MMM yyyy", { locale: fr }) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Membre depuis</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal Information */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                Informations personnelles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="full_name">Nom complet</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Jean Dupont"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      L'email ne peut pas être modifié
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(514) 555-1234"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="hero"
                    disabled={updateProfileMutation.isPending}
                    className="w-full"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Enregistrer les modifications
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Account Details */}
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-cyan-400" />
                  Sécurité du compte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Mot de passe</p>
                    <p className="text-sm text-muted-foreground">
                      Changer votre mot de passe
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setPasswordDialogOpen(true)}>
                    Modifier
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Authentification à deux facteurs</p>
                    <p className="text-sm text-muted-foreground">
                      Non activée
                    </p>
                  </div>
                  <Badge variant="outline">Bientôt</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Aperçu du compte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <span className="text-muted-foreground">Abonnements actifs</span>
                  <span className="font-bold text-foreground">{subscriptions?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                  <span className="text-muted-foreground">Total commandes</span>
                  <span className="font-bold text-foreground">{orders?.length || 0}</span>
                </div>
                {profile?.employer_discount && (
                  <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <span className="text-emerald-500">Rabais employeur</span>
                    <span className="font-bold text-emerald-500">{profile.employer_discount}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Mes Services Quick Link */}
            <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-400/5 border-cyan-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Mes services</p>
                      <p className="text-sm text-muted-foreground">
                        Gérer forfaits, équipements, facturation
                      </p>
                    </div>
                  </div>
                  <Button variant="hero" size="sm" asChild>
                    <Link to="/portal/services">
                      Accéder
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le mot de passe</DialogTitle>
            <DialogDescription>
              Entrez votre nouveau mot de passe. Il doit contenir au moins 6 caractères.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label>Confirmer le mot de passe</Label>
              <div className="relative">
                <Input
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="hero" 
              onClick={handlePasswordChange}
              disabled={changePasswordMutation.isPending || !passwordForm.newPassword || !passwordForm.confirmPassword}
            >
              {changePasswordMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Changer le mot de passe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
};

export default ClientProfile;
