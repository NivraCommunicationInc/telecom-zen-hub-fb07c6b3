import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useClientAccountIdentity } from "@/hooks/useClientAccountIdentity";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";

import { User, Save, Loader2, Lock, CreditCard, Calendar, Eye, EyeOff, Settings, ArrowRight, MapPin, CheckCircle2, XCircle, Bell } from "lucide-react";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ClientPinManagement } from "@/components/client/ClientPinManagement";
import ClientAuthorizedContacts from "@/components/client/ClientAuthorizedContacts";
import { AddressServiceWorkspace } from "@/components/service-address/AddressServiceWorkspace";
import { useLedgerBalance } from "@/hooks/useLedgerBalance";
import { validateCanadianPhone, formatCanadianPhone } from "@/components/checkout/CheckoutPhoneField";
import { validateDob, getMaxDobDate, MIN_AGE_TELECOM } from "@/lib/validation/dob";
// Phase 2 components
import ClientAvatarUpload from "@/components/client/ClientAvatarUpload";
import { CustomerTimelineTable } from "@/components/timeline";
import { portalClient } from "@/integrations/backend/portalClient";
import ClientSessionInfo from "@/components/client/ClientSessionInfo";
import ClientBillingAddressSection from "@/components/client/ClientBillingAddressSection";
import ClientDataExport from "@/components/client/ClientDataExport";
import ClientPinConfirmDialog from "@/components/client/ClientPinConfirmDialog";
import { sanitizePortalAuthError } from "@/lib/errorUtils";
// Phase 3 components - New features
import ClientMFASetup from "@/components/client/ClientMFASetup";
import ClientEmailChange from "@/components/client/ClientEmailChange";
import { useWriteGuard } from "@/hooks/useWriteGuard";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import ClientNotificationPreferences from "@/components/client/ClientNotificationPreferences";
import ClientLanguagePreference from "@/components/client/ClientLanguagePreference";
import ClientAccountDeletion from "@/components/client/ClientAccountDeletion";
import ClientNumberDisplay from "@/components/client/ClientNumberDisplay";
import ClientCommunicationPreferences from "@/components/client/ClientCommunicationPreferences";

/**
 * ClientAddressesList — Multi-adresses côté portail client.
 * Toutes les adresses sont affichées à égalité, chacune avec ses services actifs.
 */
function ClientAddressesList({
  accountId,
  account,
  subscriptions,
  equipment,
  appointments,
  tickets,
  onChanged,
}: {
  accountId: string;
  account?: any;
  subscriptions: any[];
  equipment: any[];
  appointments: any[];
  tickets: any[];
  onChanged: () => void;
}) {
  return (
    <AddressServiceWorkspace
      accountId={accountId}
      account={account}
      subscriptions={subscriptions}
      equipment={equipment}
      appointments={appointments}
      tickets={tickets}
      mode="portal"
      compact
      onChanged={onChanged}
    />
  );
}

const ClientProfile = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: accountIdentity } = useClientAccountIdentity(user?.id);
  const { data: canonicalData } = useCanonicalClientData(user?.id);
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
  // Pass 3A: état "addLocation" retiré — création gérée par <ServiceAddressPicker />.
  // PIN confirmation dialog for sensitive actions
  const [pinConfirmOpen, setPinConfirmOpen] = useState(false);
  const [pendingProfileUpdate, setPendingProfileUpdate] = useState<typeof formData | null>(null);

  // Canonical projections: profile, subscriptions, orders, accounts, service locations
  const profile = canonicalData?.profile ?? null;
  const isLoading = !canonicalData;

  const subscriptions = (canonicalData?.subscriptions || []).filter((s: any) =>
    ["active", "pending", "suspended"].includes(String(s?.status))
  );

  const orders = canonicalData?.orders || [];

  const accounts = canonicalData?.account ? [canonicalData.account] : [];
  const refetchAccounts = () =>
    queryClient.invalidateQueries({ queryKey: ["canonical-client-data"] });

  // R1: prefer canonical service_addresses (fallback to legacy accountServiceLocations during transition)
  const serviceLocations = canonicalData?.serviceAddresses?.length
    ? canonicalData.serviceAddresses
    : (canonicalData?.accountServiceLocations || []);
  const refetchLocations = () =>
    queryClient.invalidateQueries({ queryKey: ["canonical-client-data"] });


  // V2 Ledger Balance - Single source of truth for balance/credit
  const { data: ledgerBalance } = useLedgerBalance(user?.id, portalSupabase);

  // Pass 3A: mutation d'ajout d'adresse retirée — le ServiceAddressPicker gère la création via useAccountAddresses.

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

  // Derived: is identity already locked?
  const isIdentityVerified = !!(profile as any)?.identity_verified;

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Module 49 Phase B2: all writes go through the canonical
      // client-account-actions gateway. Journal + admin_audit_log +
      // client_profile_changes are handled server-side.
      if (!user?.id) throw new Error("Session invalide");

      // Resolve account_id for the current user.
      const { data: acct, error: acctErr } = await portalSupabase
        .from("accounts")
        .select("id")
        .eq("client_id", user.id)
        .maybeSingle();
      if (acctErr) throw acctErr;
      if (!acct?.id) throw new Error("Compte introuvable");

      // Only fields supported by the gateway `profile.update` action.
      const patch: Record<string, string | null> = {};
      if ((profile?.phone || "") !== (data.phone || "")) patch.phone = data.phone || null;

      if (!isIdentityVerified) {
        if (!profile?.first_name && data.first_name) patch.first_name = data.first_name;
        if (!profile?.last_name && data.last_name) patch.last_name = data.last_name;
        if (!profile?.date_of_birth && data.date_of_birth) patch.date_of_birth = data.date_of_birth;
      }

      if (Object.keys(patch).length === 0) {
        // Nothing gateway-supported changed. (Service address is edited via the
        // dedicated ServiceAddressPicker + useAccountAddresses hook.)
        return { skipped: true };
      }

      const idempotencyKey = `client-portal-profile:${acct.id}:${new Date().toISOString().slice(0, 16)}:${Object.keys(patch).sort().join(",")}`;
      const correlationId = crypto.randomUUID();

      const { data: resp, error } = await portalSupabase.functions.invoke("client-account-actions", {
        body: {
          action: "profile.update",
          account_id: acct.id,
          payload: patch,
          idempotency_key: idempotencyKey,
          correlation_id: correlationId,
        },
      });
      if (error) {
        const detail = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
        if ((detail || "").includes("IDENTITY_FIELD_LOCKED")) throw new Error("IDENTITY_LOCKED");
        throw new Error(detail || error.message);
      }
      return resp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data"] });
      queryClient.invalidateQueries({ queryKey: ["client-profile-changes"] });
      toast({ title: "Profil mis à jour avec succès" });
      setPendingProfileUpdate(null);
    },
    onError: (error: any) => {
      if (error?.message === "IDENTITY_LOCKED" || error?.message?.includes("IDENTITY_FIELD_LOCKED")) {
        toast({
          title: "Champs d'identité verrouillés",
          description: "Les informations d'identité (prénom, nom, date de naissance) ne peuvent être modifiées que par le support. Contactez-nous pour toute correction.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Erreur lors de la mise à jour", description: error?.message, variant: "destructive" });
      }
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
        description: sanitizePortalAuthError(error),
        variant: "destructive"
      });
    },
  });

  // Check if there are sensitive changes that require PIN confirmation
  const hasSensitiveChanges = (data: typeof formData): boolean => {
    if (!profile) return false;
    // Phone and address are sensitive fields (identity fields are locked separately)
    return (
      data.phone !== (profile.phone || "") ||
      data.service_address !== (profile.service_address || "")
    );
  };

  const writeGuard = useWriteGuard();

  const submitProfileForm = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone format
    if (formData.phone && !validateCanadianPhone(formData.phone)) {
      toast({
        title: "Format de téléphone invalide",
        description: "Utilisez le format (514) 555-1234",
        variant: "destructive",
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
          variant: "destructive",
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

  const handleSubmit = writeGuard(submitProfileForm);

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

  const handlePasswordChange = writeGuard(() => {
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
  });

  const accountStatusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    frozen: "bg-blue-100 text-blue-700",
    hold: "bg-amber-100 text-amber-700",
    suspended: "bg-red-100 text-red-700",
  };

  const accountStatusLabels: Record<string, string> = {
    active: "Actif",
    frozen: "Gelé",
    hold: "En attente",
    suspended: "Suspendu",
  };

  const resolvedAccountNumber = accountIdentity?.accountNumber || null;
  const resolvedClientNumber = accountIdentity?.clientNumber || profile?.client_number || null;

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Rogers-style breadcrumb */}
        <div className="text-sm text-slate-500">
          <Link to="/portal" className="text-teal-700 hover:text-teal-800">Paramètres</Link>
          <span className="mx-2">/</span>
          <span>Coordonnées et Facturation</span>
        </div>

        <h1 className="text-3xl font-bold text-slate-900">Coordonnées et Facturation</h1>

        {/* Client Number Display - Prominent for support */}
        {(resolvedClientNumber || resolvedAccountNumber) && (
          <ClientNumberDisplay 
            clientNumber={resolvedClientNumber}
            accountNumber={resolvedAccountNumber}
            clientName={profile?.full_name || formData.full_name}
          />
        )}

        {/* Notifications push */}
        <Card className="bg-white border border-slate-200 rounded-lg overflow-hidden border-l-4 border-l-teal-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications push
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Recevez les alertes importantes (paiement reçu, facture, technicien en route) directement sur cet appareil, même quand le site est fermé.
            </p>
            <PushNotificationToggle />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal Information - Rogers style with left border */}
          <Card className="bg-white border border-slate-200 rounded-lg overflow-hidden border-l-4 border-l-teal-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
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
                  {/* ——— Identity Core Fields ——— */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name" className="flex items-center gap-1">
                        Prénom {isIdentityVerified && <Lock className="w-3 h-3 text-muted-foreground" />}
                      </Label>
                      {isIdentityVerified || (profile?.first_name && profile.first_name !== "") ? (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border border-border min-h-[40px]">
                          <span className="text-foreground">{formData.first_name || "—"}</span>
                          <Lock className="w-3 h-3 text-muted-foreground ml-auto" />
                        </div>
                      ) : (
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          placeholder="Jean"
                        />
                      )}
                    </div>
                    <div>
                      <Label htmlFor="last_name" className="flex items-center gap-1">
                        Nom {isIdentityVerified && <Lock className="w-3 h-3 text-muted-foreground" />}
                      </Label>
                      {isIdentityVerified || (profile?.last_name && profile.last_name !== "") ? (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border border-border min-h-[40px]">
                          <span className="text-foreground">{formData.last_name || "—"}</span>
                          <Lock className="w-3 h-3 text-muted-foreground ml-auto" />
                        </div>
                      ) : (
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          placeholder="Dupont"
                        />
                      )}
                    </div>
                  </div>

                  {isIdentityVerified && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded-lg">
                      <Lock className="w-3 h-3 flex-shrink-0" />
                      Les champs d'identité sont verrouillés. Pour toute modification, veuillez contacter le support.
                    </div>
                  )}

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
                    <Label htmlFor="date_of_birth" className="flex items-center gap-1">
                      Date de naissance {isIdentityVerified && <Lock className="w-3 h-3 text-muted-foreground" />}
                    </Label>
                    {isIdentityVerified || profile?.date_of_birth ? (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border border-border min-h-[40px]">
                        <span className="text-foreground">
                          {formData.date_of_birth 
                            ? format(new Date(formData.date_of_birth + "T12:00:00"), "d MMMM yyyy", { locale: fr })
                            : "—"}
                        </span>
                        <Lock className="w-3 h-3 text-muted-foreground ml-auto" />
                      </div>
                    ) : (
                      <>
                        <Input
                          id="date_of_birth"
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                          max={getMaxDobDate(MIN_AGE_TELECOM)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Requis par la réglementation CRTC. Vous devez avoir {MIN_AGE_TELECOM} ans ou plus.
                        </p>
                      </>
                    )}
                  </div>
                  <Button
                    type="submit"
                    variant="hero"
                    disabled={updateProfileMutation.isPending || writeGuard.isReadOnly}
                    title={writeGuard.disabledReason}
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

          {/* Service Locations — Pass 3A: composant partagé (multi-adresses, égalité) */}
          <Card className="bg-white border border-slate-200 rounded-lg overflow-hidden border-l-4 border-l-teal-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Adresses de service
              </CardTitle>
            </CardHeader>
            <CardContent>
              {accounts?.[0]?.id ? (
                <ClientAddressesList
                  accountId={accounts[0].id}
                  account={accounts[0]}
                  subscriptions={subscriptions}
                  equipment={canonicalData?.equipment || []}
                  appointments={canonicalData?.appointments || []}
                  tickets={canonicalData?.supportTickets || []}
                  onChanged={refetchLocations}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun compte actif</p>
              )}
            </CardContent>
          </Card>


          {/* Account Details */}
          <div className="space-y-6">
            {/* Security Card with PIN Management */}
            <Card className="bg-white border border-slate-200 rounded-lg overflow-hidden border-l-4 border-l-teal-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Sécurité du compte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Client PIN Management */}
                <ClientPinManagement />
                
                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
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
            <Card className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <CardHeader>
                <CardTitle>Aperçu du compte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <span className="text-muted-foreground">Abonnements actifs</span>
                  <span className="font-bold text-foreground">{canonicalData?.subscriptions?.length || subscriptions?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <span className="text-muted-foreground">Total commandes</span>
                  <span className="font-bold text-foreground">{canonicalData?.orders?.length || orders?.length || 0}</span>
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
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-primary" />
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

          {/* Unified Timeline (Module 51 B2.3 canonical) — visibility=client */}
          <div className="lg:col-span-2">
            {user?.id && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Historique de mon compte</CardTitle>
                </CardHeader>
                <CardContent>
                  <CustomerTimelineTable
                    clientId={user.id}
                    visibility="client"
                    client={portalClient as any}
                    hideActorRole
                    limit={200}
                  />
                </CardContent>
              </Card>
            )}
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
              disabled={changePasswordMutation.isPending || !passwordForm.newPassword || !passwordForm.confirmPassword || writeGuard.isReadOnly}
              title={writeGuard.disabledReason}
            >
              {changePasswordMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Changer le mot de passe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Location Dialog — retiré (Pass 3A: création via ServiceAddressPicker inline plus haut) */}

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
