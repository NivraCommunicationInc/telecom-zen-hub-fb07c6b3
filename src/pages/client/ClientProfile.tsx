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
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { User, Save, Loader2, Lock, CreditCard, DollarSign, Calendar, Eye, EyeOff, Settings, ArrowRight, MapPin, Plus, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ClientPinManagement } from "@/components/client/ClientPinManagement";
import ClientAuthorizedContacts from "@/components/client/ClientAuthorizedContacts";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { useLedgerBalance } from "@/hooks/useLedgerBalance";
import { validateCanadianPhone, formatCanadianPhone } from "@/components/checkout/CheckoutPhoneField";
import { validateDob, getMaxDobDate, MIN_AGE_TELECOM } from "@/lib/validation/dob";
// Phase 2 components
import ClientAvatarUpload from "@/components/client/ClientAvatarUpload";
import ClientProfileChangeHistory from "@/components/client/ClientProfileChangeHistory";
import ClientSessionInfo from "@/components/client/ClientSessionInfo";
import ClientBillingAddressSection from "@/components/client/ClientBillingAddressSection";
import ClientDataExport from "@/components/client/ClientDataExport";
import ClientPinConfirmDialog from "@/components/client/ClientPinConfirmDialog";
// Phase 3 components - New features
import ClientMFASetup from "@/components/client/ClientMFASetup";
import ClientEmailChange from "@/components/client/ClientEmailChange";
import ClientNotificationPreferences from "@/components/client/ClientNotificationPreferences";
import ClientLanguagePreference from "@/components/client/ClientLanguagePreference";
import ClientAccountDeletion from "@/components/client/ClientAccountDeletion";
import ClientNumberDisplay from "@/components/client/ClientNumberDisplay";
import ClientCommunicationPreferences from "@/components/client/ClientCommunicationPreferences";
const ClientProfile = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    full_name: "", // Kept for backwards compatibility display
    email: "",
    phone: "",
    date_of_birth: "",
    service_address: "",
    service_city: "",
    service_province: "",
    service_postal_code: "",
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
  const [addLocationDialogOpen, setAddLocationDialogOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({
    label: "",
    service_address: "",
    service_city: "",
    service_postal_code: "",
  });
  // PIN confirmation dialog for sensitive actions
  const [pinConfirmOpen, setPinConfirmOpen] = useState(false);
  const [pendingProfileUpdate, setPendingProfileUpdate] = useState<typeof formData | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
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
      const { data, error } = await portalSupabase
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
      if (!user?.id) return [];
      // SECURITY: Always filter by user_id to prevent data leakage
      const { data, error } = await portalSupabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch client accounts and service locations
  const { data: accounts, refetch: refetchAccounts } = useQuery({
    queryKey: ["client-accounts", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("accounts")
        .select("*")
        .eq("client_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: serviceLocations, refetch: refetchLocations } = useQuery({
    queryKey: ["client-service-locations", user?.id],
    queryFn: async () => {
      if (!accounts || accounts.length === 0) return [];
      const accountIds = accounts.map((a: any) => a.id);
      const { data, error } = await portalSupabase
        .from("account_service_locations")
        .select("*")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accounts && accounts.length > 0,
  });

  // V2 Ledger Balance - Single source of truth for balance/credit
  const { data: ledgerBalance } = useLedgerBalance(user?.id, portalSupabase);

  // Add service location mutation
  const addLocationMutation = useMutation({
    mutationFn: async (data: typeof newLocation) => {
      if (!accounts || accounts.length === 0) throw new Error("No account found");
      const { error } = await portalSupabase.from("account_service_locations").insert({
        account_id: accounts[0].id,
        label: data.label,
        service_address: data.service_address,
        service_city: data.service_city,
        service_postal_code: data.service_postal_code,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchLocations();
      toast({ title: "Adresse ajoutée avec succès" });
      setAddLocationDialogOpen(false);
      setNewLocation({ label: "", service_address: "", service_city: "", service_postal_code: "" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        full_name: profile.full_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
        date_of_birth: profile.date_of_birth || "",
        service_address: profile.service_address || "",
        service_city: profile.service_city || "",
        service_province: profile.service_province || "",
        service_postal_code: profile.service_postal_code || "",
      });
    }
  }, [profile, user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Log changes to client_profile_changes table
      const changedFields: { field: string; oldValue: string | null; newValue: string | null }[] = [];
      
      if (profile) {
        const fieldsToCheck = [
          { key: "first_name", old: profile.first_name, new: data.first_name },
          { key: "last_name", old: profile.last_name, new: data.last_name },
          { key: "phone", old: profile.phone, new: data.phone },
          { key: "date_of_birth", old: profile.date_of_birth, new: data.date_of_birth },
          { key: "service_address", old: profile.service_address, new: data.service_address },
          { key: "service_city", old: profile.service_city, new: data.service_city },
          { key: "service_postal_code", old: profile.service_postal_code, new: data.service_postal_code },
        ];
        
        for (const field of fieldsToCheck) {
          if (field.old !== field.new && (field.old || field.new)) {
            changedFields.push({
              field: field.key,
              oldValue: field.old || null,
              newValue: field.new || null,
            });
          }
        }
      }

      // Update profile
      const { error } = await portalSupabase
        .from("profiles")
        .update({
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          full_name: `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.full_name,
          phone: data.phone,
          date_of_birth: data.date_of_birth || null,
          service_address: data.service_address || null,
          service_city: data.service_city || null,
          service_province: data.service_province || null,
          service_postal_code: data.service_postal_code || null,
        })
        .eq("user_id", user?.id);
      if (error) throw error;

      // Log changes
      if (changedFields.length > 0 && user?.id) {
        for (const change of changedFields) {
          await portalSupabase.from("client_profile_changes").insert({
            client_id: user.id,
            changed_by_id: user.id,
            changed_by_role: "client",
            field_name: change.field,
            old_value: change.oldValue,
            new_value: change.newValue,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      queryClient.invalidateQueries({ queryKey: ["client-profile-changes"] });
      toast({ title: "Profil mis à jour avec succès" });
      setPendingProfileUpdate(null);
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
      setPendingProfileUpdate(null);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { newPassword: string }) => {
      const { error } = await portalSupabase.auth.updateUser({
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

  // Check if there are sensitive changes that require PIN confirmation
  const hasSensitiveChanges = (data: typeof formData): boolean => {
    if (!profile) return false;
    // Phone, date of birth, and address are sensitive fields
    return (
      data.phone !== (profile.phone || "") ||
      data.date_of_birth !== (profile.date_of_birth || "") ||
      data.service_address !== (profile.service_address || "")
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone format
    if (formData.phone && !validateCanadianPhone(formData.phone)) {
      toast({ 
        title: "Format de téléphone invalide", 
        description: "Utilisez le format (514) 555-1234",
        variant: "destructive" 
      });
      return;
    }
    
    // Validate age (minimum 16 years for telecom services)
    if (formData.date_of_birth) {
      const dobValidation = validateDob(formData.date_of_birth, { minAge: MIN_AGE_TELECOM });
      if (!dobValidation.isValid) {
        toast({ 
          title: "Date de naissance invalide", 
          description: dobValidation.error?.fr || "Vous devez avoir au moins 16 ans",
          variant: "destructive" 
        });
        return;
      }
    }
    
    // Check if sensitive changes require PIN confirmation
    if (hasSensitiveChanges(formData)) {
      setPendingProfileUpdate(formData);
      setPinConfirmOpen(true);
    } else {
      updateProfileMutation.mutate(formData);
    }
  };

  // Handle PIN confirmed - execute pending update
  const handlePinConfirmed = () => {
    if (pendingProfileUpdate) {
      updateProfileMutation.mutate(pendingProfileUpdate);
    }
  };

  // Password strength validation
  const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (password.length < 8) errors.push("Au moins 8 caractères");
    if (!/[A-Z]/.test(password)) errors.push("Au moins une majuscule");
    if (!/[a-z]/.test(password)) errors.push("Au moins une minuscule");
    if (!/[0-9]/.test(password)) errors.push("Au moins un chiffre");
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(password)) errors.push("Au moins un caractère spécial");
    return { isValid: errors.length === 0, errors };
  };

  const passwordValidation = validatePassword(passwordForm.newPassword);

  const handlePasswordChange = () => {
    if (!passwordValidation.isValid) {
      toast({ 
        title: "Mot de passe trop faible", 
        description: passwordValidation.errors.join(", "),
        variant: "destructive" 
      });
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Mon profil</h1>
            <p className="text-muted-foreground mt-1">Gérez vos informations personnelles et votre compte</p>
          </div>
        </div>

        {/* Client Number Display - Prominent for support */}
        {profile?.client_number && (
          <ClientNumberDisplay 
            clientNumber={profile.client_number} 
            clientName={profile.full_name || formData.full_name}
          />
        )}

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
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                (ledgerBalance?.balance ?? 0) > 0 ? "bg-amber-500/20" : "bg-emerald-500/20"
              }`}>
                <DollarSign className={`w-5 h-5 ${
                  (ledgerBalance?.balance ?? 0) > 0 ? "text-amber-500" : "text-emerald-500"
                }`} />
              </div>
              <div>
                <p className={`text-lg font-bold ${
                  (ledgerBalance?.balance ?? 0) > 0 ? "text-amber-500" : "text-emerald-500"
                }`}>
                  {((ledgerBalance?.balance ?? 0) > 0)
                    ? Number(ledgerBalance?.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
                    : "0,00 $"}
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
                  {Number(ledgerBalance?.availableCredit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
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
                  {/* Avatar Upload */}
                  <div className="flex justify-center pb-2">
                    <ClientAvatarUpload
                      userId={user?.id || ""}
                      currentAvatarUrl={profile?.avatar_url}
                      fullName={profile?.full_name || formData.full_name}
                      onAvatarChange={(url) => {
                        queryClient.invalidateQueries({ queryKey: ["client-profile"] });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">Prénom</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="Jean"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Nom</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Dupont"
                      />
                    </div>
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
                      onChange={(e) => setFormData({ ...formData, phone: formatCanadianPhone(e.target.value) })}
                      placeholder="(514) 555-1234"
                      maxLength={14}
                    />
                    {formData.phone && !validateCanadianPhone(formData.phone) && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Format invalide. Utilisez (514) 555-1234
                      </p>
                    )}
                    {formData.phone && validateCanadianPhone(formData.phone) && (
                      <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Format valide
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="date_of_birth">Date de naissance</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      max={getMaxDobDate(MIN_AGE_TELECOM)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Vous devez avoir au moins {MIN_AGE_TELECOM} ans pour nos services
                    </p>
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

          {/* Service Locations */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-400" />
                Adresses de service
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAddLocationDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {accounts && accounts.length > 0 && accounts[0] && (
                <div className="p-3 border rounded-lg bg-accent/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge>Principal</Badge>
                    <span className="text-xs text-muted-foreground">{accounts[0].account_number}</span>
                  </div>
                  <p className="text-sm">{accounts[0].primary_service_address}, {accounts[0].primary_service_city}</p>
                </div>
              )}
              {serviceLocations?.map((loc: any) => (
                <div key={loc.id} className="p-3 border rounded-lg">
                  <Badge variant="outline" className="mb-1">{loc.label}</Badge>
                  <p className="text-sm">{loc.service_address}, {loc.service_city}</p>
                </div>
              ))}
              {(!accounts || accounts.length === 0) && (!serviceLocations || serviceLocations.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune adresse de service</p>
              )}
            </CardContent>
          </Card>

          {/* Account Details */}
          <div className="space-y-6">
            {/* Security Card with PIN Management */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-cyan-400" />
                  Sécurité du compte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Client PIN Management */}
                <ClientPinManagement />
                
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

          {/* PHASE 3: 2FA Setup */}
          <div className="lg:col-span-2">
            {user?.id && <ClientMFASetup userId={user.id} />}
          </div>

          {/* PHASE 3: Email Change */}
          <div className="space-y-6">
            {user?.id && user?.email && (
              <ClientEmailChange userId={user.id} currentEmail={user.email} />
            )}
            
            {/* Language Preference */}
            {user?.id && <ClientLanguagePreference userId={user.id} />}
          </div>

          {/* PHASE 3: Notification Preferences */}
          <div className="space-y-6">
            {user?.id && <ClientNotificationPreferences userId={user.id} />}
          </div>

          {/* PHASE 3: Communication Preferences (Marketing) */}
          <div className="lg:col-span-2">
            {user?.id && <ClientCommunicationPreferences userId={user.id} />}
          </div>

          {/* Authorized Contacts - Full Width */}
          <div className="lg:col-span-2">
            <ClientAuthorizedContacts />
          </div>

          {/* Profile Change History */}
          <div className="lg:col-span-2">
            {user?.id && <ClientProfileChangeHistory clientId={user.id} />}
          </div>

          {/* Additional Security & Data Sections */}
          <div className="space-y-6">
            {/* Session Info */}
            {user?.id && <ClientSessionInfo userId={user.id} />}
            
            {/* Data Export (GDPR/Loi 25) */}
            {user?.id && user?.email && (
              <ClientDataExport userId={user.id} userEmail={user.email} />
            )}
          </div>

          {/* Billing Address & Account Deletion */}
          <div className="space-y-6">
            {user?.id && (
              <ClientBillingAddressSection
                userId={user.id}
                serviceAddress={profile?.service_address}
                serviceCity={profile?.service_city}
                servicePostalCode={profile?.service_postal_code}
              />
            )}
            
            {/* PHASE 3: Account Deletion (Loi 25) */}
            {user?.id && <ClientAccountDeletion userId={user.id} />}
          </div>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le mot de passe</DialogTitle>
            <DialogDescription>
              Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.
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
                  className={passwordForm.newPassword ? (passwordValidation.isValid ? "border-emerald-500" : "border-amber-500") : ""}
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
              {/* Password strength indicator */}
              {passwordForm.newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i <= (5 - passwordValidation.errors.length)
                            ? passwordValidation.isValid
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs space-y-0.5">
                    {["Au moins 8 caractères", "Une majuscule", "Une minuscule", "Un chiffre", "Un caractère spécial"].map((req, idx) => {
                      const checks = [
                        passwordForm.newPassword.length >= 8,
                        /[A-Z]/.test(passwordForm.newPassword),
                        /[a-z]/.test(passwordForm.newPassword),
                        /[0-9]/.test(passwordForm.newPassword),
                        /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(passwordForm.newPassword),
                      ];
                      return (
                        <p key={idx} className={`flex items-center gap-1 ${checks[idx] ? "text-emerald-500" : "text-muted-foreground"}`}>
                          {checks[idx] ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {req}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
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

      {/* Add Location Dialog */}
      <Dialog open={addLocationDialogOpen} onOpenChange={setAddLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une adresse de service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nom/Libellé *</Label>
              <Input value={newLocation.label} onChange={(e) => setNewLocation({ ...newLocation, label: e.target.value })} placeholder="Ex: Bureau, Chalet" />
            </div>
            <div>
              <Label>Adresse *</Label>
              <AddressAutocomplete
                value={newLocation.service_address}
                onValueChange={(value) => setNewLocation({ ...newLocation, service_address: value })}
                onSelect={(details: AddressValue) => {
                  // Defense-in-depth: also call setter with formatted address
                  const addressText = details.formatted || details.line1;
                  setNewLocation({
                    ...newLocation,
                    service_address: addressText,
                    service_city: details.city || newLocation.service_city,
                    service_postal_code: details.postalCode || newLocation.service_postal_code,
                  });
                }}
                placeholder="Rechercher une adresse..."
                restrictToQuebec={true}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ville</Label>
                <Input value={newLocation.service_city} onChange={(e) => setNewLocation({ ...newLocation, service_city: e.target.value })} placeholder="Montréal" />
              </div>
              <div>
                <Label>Code postal</Label>
                <Input value={newLocation.service_postal_code} onChange={(e) => setNewLocation({ ...newLocation, service_postal_code: e.target.value })} placeholder="H2X 1Y4" />
              </div>
            </div>
            <Button className="w-full" onClick={() => addLocationMutation.mutate(newLocation)} disabled={!newLocation.label || !newLocation.service_address || addLocationMutation.isPending}>
              {addLocationMutation.isPending ? "Ajout..." : "Ajouter l'adresse"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Confirmation Dialog for sensitive changes */}
      {user?.id && (
        <ClientPinConfirmDialog
          open={pinConfirmOpen}
          onOpenChange={(open) => {
            setPinConfirmOpen(open);
            if (!open) setPendingProfileUpdate(null);
          }}
          userId={user.id}
          onConfirmed={handlePinConfirmed}
          title="Confirmation de modification"
          description="Pour modifier vos informations sensibles (téléphone, adresse, date de naissance), veuillez confirmer votre identité avec votre NIP client."
        />
      )}
    </ClientLayout>
  );
};

export default ClientProfile;
