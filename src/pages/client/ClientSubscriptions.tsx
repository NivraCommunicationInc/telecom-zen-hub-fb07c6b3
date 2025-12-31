import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Calendar, Pause, Play, XCircle, Edit, AlertTriangle, CheckCircle } from "lucide-react";
import { format, addMonths, addYears } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const ClientSubscriptions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    plan_name: "",
    billing_cycle: "",
  });

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["client-subscriptions-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Pause subscription mutation
  const pauseSubscriptionMutation = useMutation({
    mutationFn: async (subId: string) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "paused" })
        .eq("id", subId)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-subscriptions-all"] });
      toast({ title: "Abonnement suspendu", description: "Vous pouvez le réactiver à tout moment." });
      setPauseDialogOpen(false);
      setSelectedSubscription(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de suspendre l'abonnement", variant: "destructive" });
    },
  });

  // Resume subscription mutation
  const resumeSubscriptionMutation = useMutation({
    mutationFn: async (sub: any) => {
      const nextBillingDate = sub.billing_cycle === "monthly" 
        ? addMonths(new Date(), 1) 
        : addYears(new Date(), 1);
      
      const { error } = await supabase
        .from("subscriptions")
        .update({ 
          status: "active",
          next_billing_date: nextBillingDate.toISOString().split('T')[0],
        })
        .eq("id", sub.id)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-subscriptions-all"] });
      toast({ title: "Abonnement réactivé", description: "Votre abonnement est maintenant actif." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de réactiver l'abonnement", variant: "destructive" });
    },
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (subId: string) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subId)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-subscriptions-all"] });
      toast({ title: "Abonnement annulé", description: "Votre abonnement a été annulé." });
      setCancelDialogOpen(false);
      setSelectedSubscription(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'annuler l'abonnement", variant: "destructive" });
    },
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ subId, updates }: { subId: string; updates: any }) => {
      const nextBillingDate = updates.billing_cycle === "monthly" 
        ? addMonths(new Date(), 1) 
        : addYears(new Date(), 1);

      const { error } = await supabase
        .from("subscriptions")
        .update({ 
          ...updates,
          next_billing_date: nextBillingDate.toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq("id", subId)
        .eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-subscriptions-all"] });
      toast({ title: "Abonnement modifié", description: "Les changements ont été enregistrés." });
      setEditDialogOpen(false);
      setSelectedSubscription(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier l'abonnement", variant: "destructive" });
    },
  });

  const handleEditClick = (sub: any) => {
    setSelectedSubscription(sub);
    setEditForm({
      plan_name: sub.plan_name,
      billing_cycle: sub.billing_cycle,
    });
    setEditDialogOpen(true);
  };

  const handlePauseClick = (sub: any) => {
    setSelectedSubscription(sub);
    setPauseDialogOpen(true);
  };

  const handleCancelClick = (sub: any) => {
    setSelectedSubscription(sub);
    setCancelDialogOpen(true);
  };

  const handleSaveChanges = () => {
    if (!selectedSubscription) return;
    updateSubscriptionMutation.mutate({
      subId: selectedSubscription.id,
      updates: editForm,
    });
  };

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-500",
    cancelled: "bg-red-500/20 text-red-500",
    paused: "bg-amber-500/20 text-amber-500",
  };

  const statusLabels: Record<string, string> = {
    active: "Actif",
    cancelled: "Annulé",
    paused: "Suspendu",
  };

  const statusIcons: Record<string, any> = {
    active: CheckCircle,
    cancelled: XCircle,
    paused: Pause,
  };

  const billingCycleLabels: Record<string, string> = {
    monthly: "Mensuel",
    yearly: "Annuel",
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Mes abonnements</h1>
          <p className="text-muted-foreground mt-1">Gérez vos abonnements et forfaits télécommunications</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {subscriptions?.filter((s: any) => s.status === "active").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Actifs</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Pause className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {subscriptions?.filter((s: any) => s.status === "paused").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Suspendus</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {subscriptions?.filter((s: any) => s.status === "active")
                    .reduce((acc: number, s: any) => acc + Number(s.amount), 0)
                    .toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
                <p className="text-xs text-muted-foreground">Total mensuel</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              Abonnements actifs et historique
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : subscriptions && subscriptions.length > 0 ? (
              <div className="space-y-4">
                {subscriptions.map((sub: any) => {
                  const StatusIcon = statusIcons[sub.status] || CheckCircle;
                  return (
                    <div
                      key={sub.id}
                      className="p-6 bg-accent/50 rounded-lg border border-border"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              sub.status === "active" ? "bg-emerald-500/20" :
                              sub.status === "paused" ? "bg-amber-500/20" : "bg-red-500/20"
                            }`}>
                              <StatusIcon className={`w-5 h-5 ${
                                sub.status === "active" ? "text-emerald-500" :
                                sub.status === "paused" ? "text-amber-500" : "text-red-500"
                              }`} />
                            </div>
                            <div>
                              <h3 className="font-display text-xl font-bold text-foreground">
                                {sub.plan_name}
                              </h3>
                              <Badge className={statusColors[sub.status] || "bg-muted"}>
                                {statusLabels[sub.status] || sub.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Montant</p>
                              <p className="text-lg font-bold text-foreground">
                                {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                <span className="text-sm font-normal text-muted-foreground">
                                  /{sub.billing_cycle === "monthly" ? "mois" : "an"}
                                </span>
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Cycle</p>
                              <p className="text-foreground font-medium">
                                {billingCycleLabels[sub.billing_cycle] || sub.billing_cycle}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Date de début</p>
                              <p className="text-foreground">
                                {format(new Date(sub.start_date), "d MMMM yyyy", { locale: fr })}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Prochaine facturation</p>
                              <p className="text-foreground flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                {sub.next_billing_date
                                  ? format(new Date(sub.next_billing_date), "d MMMM yyyy", { locale: fr })
                                  : "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 lg:flex-col lg:w-auto">
                          {sub.status === "active" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClick(sub)}
                                className="flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Modifier
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePauseClick(sub)}
                                className="flex items-center gap-2 text-amber-500 hover:text-amber-600"
                              >
                                <Pause className="w-4 h-4" />
                                Suspendre
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelClick(sub)}
                                className="flex items-center gap-2 text-red-500 hover:text-red-600"
                              >
                                <XCircle className="w-4 h-4" />
                                Annuler
                              </Button>
                            </>
                          )}
                          {sub.status === "paused" && (
                            <>
                              <Button
                                variant="hero"
                                size="sm"
                                onClick={() => resumeSubscriptionMutation.mutate(sub)}
                                className="flex items-center gap-2"
                              >
                                <Play className="w-4 h-4" />
                                Réactiver
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelClick(sub)}
                                className="flex items-center gap-2 text-red-500 hover:text-red-600"
                              >
                                <XCircle className="w-4 h-4" />
                                Annuler
                              </Button>
                            </>
                          )}
                          {sub.status === "cancelled" && (
                            <p className="text-sm text-muted-foreground italic">
                              Cet abonnement a été annulé
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Vous n'avez pas encore d'abonnement</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Contactez-nous pour souscrire à un forfait télécom avantageux
                </p>
                <Button variant="hero" asChild>
                  <a href="/book">Prendre rendez-vous</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'abonnement</DialogTitle>
            <DialogDescription>
              Modifiez les détails de votre abonnement. Les changements prendront effet immédiatement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nom du forfait</Label>
              <Input
                value={editForm.plan_name}
                onChange={(e) => setEditForm({ ...editForm, plan_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Cycle de facturation</Label>
              <Select
                value={editForm.billing_cycle}
                onValueChange={(v) => setEditForm({ ...editForm, billing_cycle: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                  <SelectItem value="yearly">Annuel (économisez 15%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="hero" 
              onClick={handleSaveChanges}
              disabled={updateSubscriptionMutation.isPending}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause Confirmation Dialog */}
      <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-amber-500" />
              Suspendre l'abonnement
            </AlertDialogTitle>
            <AlertDialogDescription>
              Votre abonnement sera suspendu temporairement. Vous pourrez le réactiver à tout moment.
              Pendant la suspension, vous ne serez pas facturé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedSubscription && pauseSubscriptionMutation.mutate(selectedSubscription.id)}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Suspendre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Annuler l'abonnement
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir annuler cet abonnement ? Cette action est irréversible.
              Votre service sera interrompu à la fin de la période de facturation actuelle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver l'abonnement</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedSubscription && cancelSubscriptionMutation.mutate(selectedSubscription.id)}
              className="bg-red-500 hover:bg-red-600"
            >
              Annuler définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClientLayout>
  );
};

export default ClientSubscriptions;