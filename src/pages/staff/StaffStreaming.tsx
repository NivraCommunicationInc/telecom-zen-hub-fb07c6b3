/**
 * StaffStreaming - Manage client streaming subscriptions
 * Staff portal - enhanced with activation/deactivation controls
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, Search, User, Calendar, DollarSign, ArrowLeft, Power, PowerOff, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
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
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  suspended: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

interface StreamingSubscriptionWithProfile {
  id: string;
  user_id: string;
  streaming_service_id: string | null;
  status: string;
  monthly_price: number | null;
  start_date: string | null;
  created_at: string;
  profile: { full_name: string | null; email: string | null } | null;
  service: { name: string | null; logo_url: string | null } | null;
}

export default function StaffStreaming() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedSub, setSelectedSub] = useState<StreamingSubscriptionWithProfile | null>(null);
  const [actionType, setActionType] = useState<"activate" | "suspend" | null>(null);

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["staff-streaming-subscriptions"],
    queryFn: async (): Promise<StreamingSubscriptionWithProfile[]> => {
      const { data: subs, error } = await supabase
        .from("client_streaming_subscriptions")
        .select("id, user_id, streaming_service_id, status, monthly_price, start_date, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch profiles and services separately
      const results: StreamingSubscriptionWithProfile[] = [];
      
      for (const sub of subs || []) {
        let profile = null;
        let service = null;

        if (sub.user_id) {
          const { data: p } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("user_id", sub.user_id)
            .maybeSingle();
          profile = p;
        }

        if (sub.streaming_service_id) {
          const { data: s } = await supabase
            .from("streaming_services")
            .select("name, logo_url")
            .eq("id", sub.streaming_service_id)
            .maybeSingle();
          service = s;
        }

        results.push({ ...sub, profile, service });
      }

      return results;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ subId, newStatus }: { subId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("client_streaming_subscriptions")
        .update({ 
          status: newStatus,
          ...(newStatus === "cancelled" ? { cancelled_at: new Date().toISOString() } : {})
        })
        .eq("id", subId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(actionType === "activate" ? "Service activé" : "Service suspendu");
      queryClient.invalidateQueries({ queryKey: ["staff-streaming-subscriptions"] });
      setSelectedSub(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  const filteredSubscriptions = subscriptions?.filter((sub) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      sub.profile?.full_name?.toLowerCase().includes(searchLower) ||
      sub.profile?.email?.toLowerCase().includes(searchLower) ||
      sub.service?.name?.toLowerCase().includes(searchLower)
    );
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff");
  };

  const handleStatusAction = (sub: StreamingSubscriptionWithProfile, action: "activate" | "suspend") => {
    setSelectedSub(sub);
    setActionType(action);
  };

  const confirmAction = () => {
    if (!selectedSub || !actionType) return;
    const newStatus = actionType === "activate" ? "active" : "suspended";
    updateStatusMutation.mutate({ subId: selectedSub.id, newStatus });
  };

  // Stats
  const activeCount = subscriptions?.filter(s => s.status === "active").length || 0;
  const suspendedCount = subscriptions?.filter(s => s.status === "suspended" || s.status === "cancelled").length || 0;
  const totalRevenue = subscriptions?.filter(s => s.status === "active").reduce((acc, s) => acc + (s.monthly_price || 0), 0) || 0;

  return (
    <div className="min-h-screen flex relative">
      <StaffBackground />
      <StaffSidebar onSignOut={handleSignOut} />
      
      <main className="flex-1 p-6 overflow-auto z-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/staff/dashboard")}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Play className="h-6 w-6 text-teal-400" />
              Gestion Streaming+
            </h1>
          </div>
          <p className="text-slate-400 ml-14">Gérer les abonnements streaming des clients</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Power className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{activeCount}</p>
                <p className="text-sm text-slate-400">Actifs</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/20">
                <PowerOff className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{suspendedCount}</p>
                <p className="text-sm text-slate-400">Suspendus/Annulés</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-teal-500/20">
                <DollarSign className="h-5 w-5 text-teal-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalRevenue.toFixed(2)} $</p>
                <p className="text-sm text-slate-400">Revenus mensuels</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher par client ou service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white"
            />
          </div>
        </div>

        {/* Subscriptions Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Chargement...</div>
        ) : filteredSubscriptions?.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            Aucun abonnement streaming trouvé
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubscriptions?.map((sub) => (
              <Card key={sub.id} className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm hover:border-teal-500/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {sub.service?.logo_url ? (
                        <img 
                          src={sub.service.logo_url} 
                          alt={sub.service.name || ""}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Play className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-white text-base">
                          {sub.service?.name || "Service Streaming"}
                        </CardTitle>
                        <p className="text-sm text-teal-400 font-semibold">
                          {sub.monthly_price?.toFixed(2)} $/mois
                        </p>
                      </div>
                    </div>
                    <Badge className={statusColors[sub.status] || statusColors.pending}>
                      {sub.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-300">{sub.profile?.full_name || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-400">
                      Depuis {sub.start_date 
                        ? format(new Date(sub.start_date), "d MMM yyyy", { locale: fr })
                        : format(new Date(sub.created_at), "d MMM yyyy", { locale: fr })
                      }
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    {sub.status === "active" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                        onClick={() => handleStatusAction(sub, "suspend")}
                      >
                        <PowerOff className="h-3 w-3 mr-1" />
                        Suspendre
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-green-500/50 text-green-400 hover:bg-green-500/10"
                        onClick={() => handleStatusAction(sub, "activate")}
                      >
                        <Power className="h-3 w-3 mr-1" />
                        Activer
                      </Button>
                    )}
                    {sub.user_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/staff/clients/${sub.user_id}`)}
                        className="flex-1"
                      >
                        Voir client
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedSub && !!actionType} onOpenChange={() => { setSelectedSub(null); setActionType(null); }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              {actionType === "activate" ? "Activer le service" : "Suspendre le service"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {actionType === "activate" ? (
                <>
                  Voulez-vous activer le service <strong className="text-white">{selectedSub?.service?.name}</strong> pour{" "}
                  <strong className="text-white">{selectedSub?.profile?.full_name}</strong> ?
                </>
              ) : (
                <>
                  Voulez-vous suspendre le service <strong className="text-white">{selectedSub?.service?.name}</strong> pour{" "}
                  <strong className="text-white">{selectedSub?.profile?.full_name}</strong> ?
                  <br />
                  <span className="text-amber-400">Le client n'aura plus accès à ce service.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={actionType === "activate" 
                ? "bg-green-600 hover:bg-green-700 text-white" 
                : "bg-orange-600 hover:bg-orange-700 text-white"
              }
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? "En cours..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
