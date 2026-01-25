/**
 * StaffClients - Employee portal client listing and search
 * Completely isolated from admin portal
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Users, Search, Loader2, Phone, Mail, MapPin, 
  User, Shield, Eye, RefreshCw, Hash, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffClientAccessGate, useStaffClientAccess } from "@/components/staff/StaffClientAccessGate";

interface ClientProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  client_number: string | null;
  service_address: string | null;
  service_city: string | null;
  created_at: string;
  account_status: string | null;
}

export default function StaffClients() {
  const navigate = useNavigate();
  const { checkAccess } = useStaffClientAccess();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClientProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Access gate state
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [showAccessGate, setShowAccessGate] = useState(false);

  // Fetch recent clients
  const { data: recentClients, isLoading, refetch } = useQuery({
    queryKey: ["staff-recent-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, phone, client_number, service_address, service_city, created_at, account_status")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return (data || []) as ClientProfile[];
    },
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      toast.error("Veuillez entrer au moins 2 caractères");
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      const query = searchQuery.trim().toLowerCase();
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, phone, client_number, service_address, service_city, created_at, account_status")
        .or(`email.ilike.%${query}%,full_name.ilike.%${query}%,phone.ilike.%${query}%,client_number.ilike.%${query}%`)
        .limit(50);

      if (error) throw error;

      setSearchResults((data || []) as ClientProfile[]);
      
      if (!data?.length) {
        toast.info("Aucun client trouvé");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Erreur lors de la recherche");
    } finally {
      setIsSearching(false);
    }
  };

  const handleClientClick = useCallback((client: ClientProfile) => {
    if (checkAccess(client.user_id)) {
      // Already verified, navigate directly
      navigate(`/staff/clients/${client.user_id}`);
    } else {
      // Need to authenticate
      setSelectedClient(client);
      setShowAccessGate(true);
    }
  }, [checkAccess, navigate]);

  const handleAccessGranted = () => {
    if (selectedClient) {
      navigate(`/staff/clients/${selectedClient.user_id}`);
    }
    setShowAccessGate(false);
    setSelectedClient(null);
  };

  const displayClients = searchResults.length > 0 ? searchResults : (recentClients || []);
  const isShowingSearch = searchResults.length > 0;

  return (
    <div className="min-h-screen relative">
      <StaffBackground />
      
      <div className="relative z-10 p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg">
              <Users className="h-6 w-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Clients</h1>
              <p className="text-slate-400">Rechercher et gérer les dossiers clients</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Search Card */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-teal-400" />
              Recherche Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nom, email, téléphone ou numéro de client..."
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSearching}
                className="bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 hover:from-teal-600 hover:to-cyan-600"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
              </Button>
              {isShowingSearch && (
                <Button 
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  Réinitialiser
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Clients List */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="h-5 w-5 text-teal-400" />
                {isShowingSearch ? `Résultats (${searchResults.length})` : "Clients récents"}
              </span>
              {!isShowingSearch && recentClients && (
                <Badge className="bg-slate-700 text-slate-300">{recentClients.length} clients</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
              </div>
            ) : displayClients.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Aucun client trouvé</p>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="grid gap-3">
                  {displayClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleClientClick(client)}
                      className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 transition-all hover:border-teal-500/50 text-left group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-2.5 rounded-full bg-slate-700 group-hover:bg-teal-500/20 transition-colors">
                            <User className="h-5 w-5 text-slate-400 group-hover:text-teal-400" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-white group-hover:text-teal-400 transition-colors">
                              {client.full_name || "Client sans nom"}
                            </p>
                            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                              {client.email && (
                                <span className="flex items-center gap-1.5">
                                  <Mail className="h-3.5 w-3.5" />
                                  {client.email}
                                </span>
                              )}
                              {client.phone && (
                                <span className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5" />
                                  {client.phone}
                                </span>
                              )}
                              {client.client_number && (
                                <span className="flex items-center gap-1.5">
                                  <Hash className="h-3.5 w-3.5" />
                                  {client.client_number}
                                </span>
                              )}
                            </div>
                            {client.service_address && (
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {client.service_address}
                                {client.service_city && `, ${client.service_city}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                          </span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Shield className="h-4 w-4 text-amber-400" />
                            <Eye className="h-4 w-4 text-teal-400" />
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Access Gate Modal */}
      <StaffClientAccessGate
        clientId={selectedClient?.user_id || ""}
        clientName={selectedClient?.full_name || undefined}
        clientEmail={selectedClient?.email || undefined}
        isOpen={showAccessGate}
        onClose={() => {
          setShowAccessGate(false);
          setSelectedClient(null);
        }}
        onAccessGranted={handleAccessGranted}
      />
    </div>
  );
}
