/**
 * StaffTvChannels - Manage client TV channel selections
 * Staff portal - completely isolated from admin
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tv, Search, User, Calendar, Package, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

interface ChannelSelectionWithProfile {
  id: string;
  user_id: string;
  status: string;
  channels: unknown;
  total_price: number | null;
  created_at: string;
  profile: { full_name: string | null; email: string | null } | null;
}

export default function StaffTvChannels() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: selections, isLoading } = useQuery({
    queryKey: ["staff-channel-selections"],
    queryFn: async (): Promise<ChannelSelectionWithProfile[]> => {
      const { data: sels, error } = await supabase
        .from("channel_selections")
        .select("id, user_id, status, channels, total_price, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch profiles separately
      const results: ChannelSelectionWithProfile[] = [];
      
      for (const sel of sels || []) {
        let profile = null;
        if (sel.user_id) {
          const { data: p } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("user_id", sel.user_id)
            .maybeSingle();
          profile = p;
        }
        results.push({ ...sel, profile });
      }

      return results;
    },
  });

  const filteredSelections = selections?.filter((sel) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      sel.profile?.full_name?.toLowerCase().includes(searchLower) ||
      sel.profile?.email?.toLowerCase().includes(searchLower)
    );
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff");
  };

  const getChannelCount = (channels: unknown): number => {
    if (Array.isArray(channels)) return channels.length;
    if (typeof channels === "object" && channels !== null) {
      return Object.keys(channels).length;
    }
    return 0;
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
              <Tv className="h-6 w-6 text-teal-400" />
              Gestion Chaînes TV
            </h1>
          </div>
          <p className="text-slate-400 ml-14">Gérer les sélections de chaînes des clients</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher par client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white"
            />
          </div>
        </div>

        {/* Selections Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Chargement...</div>
        ) : filteredSelections?.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            Aucune sélection de chaînes trouvée
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSelections?.map((sel) => (
              <Card key={sel.id} className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Tv className="h-5 w-5 text-teal-400" />
                      Sélection chaînes
                    </CardTitle>
                    <Badge className={statusColors[sel.status] || statusColors.pending}>
                      {sel.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-300">{sel.profile?.full_name || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-400">
                      {getChannelCount(sel.channels)} chaînes sélectionnées
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-400">
                      {format(new Date(sel.created_at), "d MMM yyyy", { locale: fr })}
                    </span>
                  </div>
                  {sel.total_price && (
                    <div className="text-teal-400 font-semibold">
                      {sel.total_price.toFixed(2)} $/mois
                    </div>
                  )}
                  {sel.user_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/staff/clients/${sel.user_id}`)}
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
