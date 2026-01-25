/**
 * StaffStreaming - Manage client streaming subscriptions
 * Staff portal - completely isolated from admin
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, Search, User, Calendar, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
  streaming_service_id: string;
  status: string | null;
  monthly_price: number | null;
  start_date: string | null;
  created_at: string;
  profile: { full_name: string | null; email: string | null } | null;
  service: { name: string | null; logo_url: string | null } | null;
}

export default function StaffStreaming() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["staff-streaming-subscriptions"],
    queryFn: async (): Promise<StreamingSubscriptionWithProfile[]> => {
      const { data: subs, error } = await supabase
        .from("client_streaming_subscriptions")
        .select("id, user_id, streaming_service_id, status, monthly_price, start_date, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

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
              Gestion Streaming
            </h1>
          </div>
          <p className="text-slate-400 ml-14">Gérer les abonnements streaming des clients</p>
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
              <Card key={sub.id} className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
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
                        <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center">
                          <Play className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-white text-base">
                          {sub.service?.name || "Service"}
                        </CardTitle>
                        <p className="text-sm text-slate-400">
                          {sub.monthly_price?.toFixed(2) || "0.00"} $/mois
                        </p>
                      </div>
                    </div>
                    <Badge className={statusColors[sub.status || "pending"]}>
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
                      Depuis {sub.start_date ? format(new Date(sub.start_date), "d MMM yyyy", { locale: fr }) : "N/A"}
                    </span>
                  </div>
                  {sub.user_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/staff/clients/${sub.user_id}`)}
                      className="w-full mt-2"
                    >
                      Voir le client
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
