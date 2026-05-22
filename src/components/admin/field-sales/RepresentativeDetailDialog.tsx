/**
 * RepresentativeDetailDialog - View and manage field sales representative details
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { SetPasswordDialog } from "@/components/admin/users/SetPasswordDialog";
import { ProfileName } from "@/hooks/useProfileName";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Package,
  DollarSign,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Ban,
  KeyRound,
  RefreshCw,
  Shield,
  Activity,
  Award,
  Loader2,
  Lock,
  Send,
} from "lucide-react";

interface Representative {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  status: string;
  onboarding_completed_at: string | null;
  terms_accepted_at: string | null;
  staff_pin_hash: string | null;
  last_login_at: string | null;
  created_at: string;
  total_sales: number;
  total_commission: number;
  pending_sales: number;
}

interface RepresentativeDetailDialogProps {
  representative: Representative | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ActivityLog {
  id: string;
  action: string;
  created_at: string;
  details: Record<string, any>;
}

interface SaleRecord {
  id: string;
  local_id: string | null;
  customer_name: string;
  total_amount: number;
  payment_status: string;
  sync_status: string;
  created_at: string;
}

async function extractEdgeFunctionErrorMessage(err: any): Promise<string> {
  const fallback = err?.message || "Erreur lors de l'exécution de la fonction";
  const res: Response | undefined = err?.context;

  // Supabase FunctionsError exposes `context` as a Response
  if (res && typeof (res as any).clone === "function") {
    try {
      const json = await res.clone().json();
      if (json?.error) return String(json.error);
      if (json?.message) return String(json.message);
    } catch {
      // ignore
    }

    try {
      const text = await res.clone().text();
      if (text) return text;
    } catch {
      // ignore
    }
  }

  return fallback;
}

export function RepresentativeDetailDialog({
  representative,
  open,
  onOpenChange,
}: RepresentativeDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [setPasswordDialogOpen, setSetPasswordDialogOpen] = useState(false);
  // Fetch sales history
  const { data: salesHistory, isLoading: salesLoading } = useQuery({
    queryKey: ["rep-sales-history", representative?.user_id],
    enabled: !!representative?.user_id && open,
    queryFn: async () => {
      const { data, error } = await adminSupabase
        .from("field_sales_orders")
        .select("id, local_id, customer_name, total_amount, payment_status, sync_status, created_at")
        .eq("salesperson_id", representative!.user_id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SaleRecord[];
    },
  });

  // Fetch commissions
  const { data: commissions, isLoading: commissionsLoading } = useQuery({
    queryKey: ["rep-commissions", representative?.user_id],
    enabled: !!representative?.user_id && open,
    queryFn: async () => {
      const { data, error } = await adminSupabase
        .from("sales_commissions")
        .select("*")
        .eq("salesperson_id", representative!.user_id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus: boolean) => {
      const { error } = await adminSupabase
        .from("user_roles")
        .update({
          is_active: newStatus,
          status: newStatus ? "active" : "disabled",
        })
        .eq("user_id", representative!.user_id)
        .eq("role", "field_sales");

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Statut mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-reps"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Reset PIN mutation
  const resetPinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await adminSupabase.functions.invoke(
        "admin-manage-staff",
        {
          body: {
            action: "reset_pin",
            user_id: representative!.user_id,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "PIN réinitialisé",
        description: "Le représentant devra configurer un nouveau PIN à la prochaine connexion.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-reps"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Send password reset link mutation (replaces legacy set-password)
  const setPasswordMutation = useMutation({
    mutationFn: async ({ password, forceChange }: { password: string; forceChange: boolean }) => {
      // Password setting is no longer supported - use reset link instead
      throw new Error("Le changement direct de mot de passe a été désactivé. Utilisez l'envoi de lien de réinitialisation.");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Send reset link mutation via audit session
  const sendResetLinkMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await adminSupabase.auth.getSession();

      const { data, error } = await adminSupabase.functions.invoke(
        "admin-audit-session-link",
        {
          body: {
            target_user_id: representative!.user_id,
            reason: "Password reset requested by admin for field sales representative",
          },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        }
      );

      if (error) {
        const message = await extractEdgeFunctionErrorMessage(error);
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Lien envoyé",
        description: "Un lien de réinitialisation sécurisé a été envoyé par courriel.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  if (!representative) return null;

  const isActive = representative.is_active && representative.status === "active";
  const isOnboarded = !!representative.onboarding_completed_at;

  // Calculate stats
  const totalCommissionAmount = commissions?.reduce((sum, c) => sum + (c.commission_amount || c.amount || 0), 0) || 0;
  const pendingCommissions = commissions?.filter(c => c.status === "pending") || [];
  const paidCommissions = commissions?.filter(c => c.status === "paid") || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {representative.full_name?.charAt(0) || representative.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold">{representative.full_name || "—"}</p>
              <p className="text-sm text-slate-400 font-normal">{representative.email}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {isActive ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Actif
                </Badge>
              ) : !isOnboarded ? (
                <Badge className="bg-amber-500/20 text-amber-400 border-0">
                  <Clock className="w-3 h-3 mr-1" />
                  Configuration
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <Ban className="w-3 h-3 mr-1" />
                  Inactif
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
              <User className="h-4 w-4 mr-2" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-slate-700">
              <Package className="h-4 w-4 mr-2" />
              Ventes ({salesHistory?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="commissions" className="data-[state=active]:bg-slate-700">
              <DollarSign className="h-4 w-4 mr-2" />
              Commissions
            </TabsTrigger>
            <TabsTrigger value="actions" className="data-[state=active]:bg-slate-700">
              <Shield className="h-4 w-4 mr-2" />
              Actions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-slate-400">Informations de contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-500" />
                    <span className="text-white">{representative.email}</span>
                  </div>
                  {representative.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-slate-500" />
                      <span className="text-white">{representative.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-400">
                      Créé le {format(new Date(representative.created_at), "d MMMM yyyy", { locale: fr })}
                    </span>
                  </div>
                  {representative.last_login_at && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-400">
                        Dernière connexion: {format(new Date(representative.last_login_at), "d MMM HH:mm", { locale: fr })}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-slate-400">Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-orange-400" />
                      <span className="text-slate-400">Total ventes</span>
                    </div>
                    <span className="text-white font-bold text-lg">{representative.total_sales}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-4 w-4 text-emerald-400" />
                      <span className="text-slate-400">Commissions totales</span>
                    </div>
                    <span className="text-emerald-400 font-bold text-lg">${totalCommissionAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                      <span className="text-slate-400">En attente sync</span>
                    </div>
                    <span className="text-amber-400 font-medium">{representative.pending_sales}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-700 bg-slate-800/50 md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-slate-400">Statut du compte</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-slate-900/50">
                      <div className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center ${isOnboarded ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
                        {isOnboarded ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-400" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Configuration</p>
                      <p className={`text-sm font-medium ${isOnboarded ? "text-emerald-400" : "text-amber-400"}`}>
                        {isOnboarded ? "Complétée" : "En attente"}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-slate-900/50">
                      <div className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center ${representative.terms_accepted_at ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
                        {representative.terms_accepted_at ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-400" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Conditions</p>
                      <p className={`text-sm font-medium ${representative.terms_accepted_at ? "text-emerald-400" : "text-amber-400"}`}>
                        {representative.terms_accepted_at ? "Acceptées" : "En attente"}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-slate-900/50">
                      <div className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center ${representative.staff_pin_hash ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
                        {representative.staff_pin_hash ? (
                          <KeyRound className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-400" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Code PIN</p>
                      <p className={`text-sm font-medium ${representative.staff_pin_hash ? "text-emerald-400" : "text-amber-400"}`}>
                        {representative.staff_pin_hash ? "Configuré" : "Non défini"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="mt-4">
            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  {salesLoading ? (
                    <div className="p-4 space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : !salesHistory || salesHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <Package className="h-12 w-12 mb-3 opacity-50" />
                      <p>Aucune vente enregistrée</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700">
                      {salesHistory.map((sale) => (
                        <div key={sale.id} className="p-4 hover:bg-slate-800/50">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-white">{sale.customer_name}</p>
                              <p className="text-sm text-slate-400">
                                {sale.local_id || sale.id.slice(0, 8)} • {format(new Date(sale.created_at), "d MMM HH:mm", { locale: fr })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-white">${sale.total_amount.toFixed(2)}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge className={
                                  sale.payment_status === "confirmed"
                                    ? "bg-emerald-500/20 text-emerald-400 border-0"
                                    : sale.payment_status === "pending"
                                    ? "bg-amber-500/20 text-amber-400 border-0"
                                    : "bg-red-500/20 text-red-400 border-0"
                                }>
                                  {sale.payment_status === "confirmed" ? "Payé" : sale.payment_status === "pending" ? "En attente" : "Échec"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions" className="mt-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card className="border-slate-700 bg-emerald-500/10">
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-emerald-400">${totalCommissionAmount.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">Total</p>
                </CardContent>
              </Card>
              <Card className="border-slate-700 bg-amber-500/10">
                <CardContent className="p-4 text-center">
                  <Clock className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-amber-400">
                    ${pendingCommissions.reduce((s, c) => s + (c.commission_amount || c.amount || 0), 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400">En attente</p>
                </CardContent>
              </Card>
              <Card className="border-slate-700 bg-cyan-500/10">
                <CardContent className="p-4 text-center">
                  <Award className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-cyan-400">
                    ${paidCommissions.reduce((s, c) => s + (c.commission_amount || c.amount || 0), 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400">Payé</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-700 bg-slate-800/50">
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  {commissionsLoading ? (
                    <div className="p-4 space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : !commissions || commissions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                      <DollarSign className="h-12 w-12 mb-3 opacity-50" />
                      <p>Aucune commission enregistrée</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700">
                      {commissions.map((commission) => (
                        <div key={commission.id} className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-slate-400">
                              {format(new Date(commission.created_at), "d MMMM yyyy", { locale: fr })}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={
                              commission.status === "paid"
                                ? "bg-emerald-500/20 text-emerald-400 border-0"
                                : commission.status === "validated"
                                ? "bg-cyan-500/20 text-cyan-400 border-0"
                                : "bg-amber-500/20 text-amber-400 border-0"
                            }>
                              {commission.status === "paid" ? "Payé" : commission.status === "validated" ? "Validé" : "En attente"}
                            </Badge>
                            <span className="font-bold text-white">
                              ${(commission.commission_amount || commission.amount || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-orange-400" />
                    Gestion du compte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700"
                    onClick={() => resetPinMutation.mutate()}
                    disabled={resetPinMutation.isPending}
                  >
                    {resetPinMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4 mr-2" />
                    )}
                    Réinitialiser le PIN
                  </Button>
                  <Button
                    variant={isActive ? "destructive" : "default"}
                    className={`w-full justify-start ${!isActive && "bg-emerald-600 hover:bg-emerald-700"}`}
                    onClick={() => toggleStatusMutation.mutate(!isActive)}
                    disabled={toggleStatusMutation.isPending}
                  >
                    {toggleStatusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : isActive ? (
                      <>
                        <Ban className="h-4 w-4 mr-2" />
                        Désactiver le compte
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Activer le compte
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Password Management Card */}
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-cyan-400" />
                    Gestion du mot de passe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700"
                    onClick={() => setSetPasswordDialogOpen(true)}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Définir un mot de passe
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700"
                    onClick={() => sendResetLinkMutation.mutate()}
                    disabled={sendResetLinkMutation.isPending}
                  >
                    {sendResetLinkMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Envoyer lien de réinitialisation
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-700 bg-slate-800/50 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-teal-400" />
                    Informations système
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Représentant</span>
                    <span className="text-white text-xs"><ProfileName userId={representative.user_id} /></span>
                  </div>
                  <Separator className="bg-slate-700" />
                  <div className="flex justify-between">
                    <span className="text-slate-400">Créé le</span>
                    <span className="text-white">
                      {format(new Date(representative.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </span>
                  </div>
                  {representative.onboarding_completed_at && (
                    <>
                      <Separator className="bg-slate-700" />
                      <div className="flex justify-between">
                        <span className="text-slate-400">Configuration le</span>
                        <span className="text-white">
                          {format(new Date(representative.onboarding_completed_at), "d MMM yyyy", { locale: fr })}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Set Password Dialog */}
        <SetPasswordDialog
          open={setPasswordDialogOpen}
          onOpenChange={setSetPasswordDialogOpen}
          userEmail={representative.email}
          userName={representative.full_name || undefined}
          isReset={false}
          isPending={setPasswordMutation.isPending}
          onSubmit={({ password, forceChange }) => {
            setPasswordMutation.mutate({ password, forceChange });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
