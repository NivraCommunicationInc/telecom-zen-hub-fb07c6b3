import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Tv, 
  Star, 
  Package, 
  Check, 
  ShoppingCart, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Calendar,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Channel {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  is_hd: boolean;
  is_4k: boolean;
}

interface ChannelSelection {
  id: string;
  channels: any[];
  total_price: number;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  related_ticket_id: string | null;
}

const ClientChannels = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>([]);
  const [activeTab, setActiveTab] = useState("browse");

  // Fetch all channels
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["tv-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_channels")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Channel[];
    },
  });

  // Fetch user's channel selections
  const { data: selections = [], isLoading: selectionsLoading } = useQuery({
    queryKey: ["channel-selections", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("channel_selections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChannelSelection[];
    },
    enabled: !!user?.id,
  });

  // Fetch user's profile for the ticket
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch related tickets
  const { data: tickets = [] } = useQuery({
    queryKey: ["channel-tickets", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .ilike("subject", "%Channel Selection%")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Submit channel selection mutation
  const submitSelectionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const totalPrice = selectedChannels.reduce((sum, ch) => sum + (ch.price || 0), 0);
      const channelData = selectedChannels.map(ch => ({
        id: ch.id,
        name: ch.name,
        category: ch.category,
        price: ch.price,
        is_hd: ch.is_hd,
        is_4k: ch.is_4k,
      }));

      // Create support ticket first
      const etaHours = Math.floor(Math.random() * 22) + 2; // 2-24 hours
      const etaDate = new Date();
      etaDate.setHours(etaDate.getHours() + etaHours);

      const ticketDescription = `
**Demande de sélection de chaînes TV**

**Client:** ${profile?.full_name || "N/A"}
**Email:** ${profile?.email || user.email}
**Numéro client:** ${profile?.client_number || "N/A"}

**Chaînes sélectionnées (${selectedChannels.length}):**
${selectedChannels.map(ch => `- ${ch.name} (${ch.category === 'basic' ? 'Inclus' : `$${ch.price}/mois`})`).join('\n')}

**Total mensuel estimé:** $${totalPrice.toFixed(2)}/mois

**ETA:** ${format(etaDate, "d MMMM yyyy à HH:mm", { locale: fr })}

Cette demande est en attente de confirmation par un administrateur.
      `.trim();

      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          subject: `Channel Selection Request - ${selectedChannels.length} chaînes`,
          description: ticketDescription,
          priority: "normal",
          status: "open",
          client_email: profile?.email || user.email,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create channel selection record
      const { data: selection, error: selectionError } = await supabase
        .from("channel_selections")
        .insert({
          user_id: user.id,
          channels: channelData,
          total_price: totalPrice,
          status: "pending",
          related_ticket_id: ticket.id,
        })
        .select()
        .single();

      if (selectionError) throw selectionError;

      return { selection, ticket };
    },
    onSuccess: () => {
      toast.success("Sélection de chaînes soumise avec succès!");
      setSelectedChannels([]);
      setActiveTab("history");
      queryClient.invalidateQueries({ queryKey: ["channel-selections"] });
      queryClient.invalidateQueries({ queryKey: ["channel-tickets"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const basicChannels = channels.filter(ch => ch.category === "basic");
  const premiumChannels = channels.filter(ch => ch.category === "premium");
  const bundleChannels = channels.filter(ch => ch.category === "bundle");

  const toggleChannel = (channel: Channel) => {
    setSelectedChannels(prev => {
      const exists = prev.find(ch => ch.id === channel.id);
      if (exists) {
        return prev.filter(ch => ch.id !== channel.id);
      }
      return [...prev, channel];
    });
  };

  const totalPrice = selectedChannels.reduce((sum, ch) => sum + (ch.price || 0), 0);
  const selectedPremium = selectedChannels.filter(ch => ch.category === "premium");
  const selectedBundles = selectedChannels.filter(ch => ch.category === "bundle");

  const generateICS = (ticketDate: string, ticketSubject: string) => {
    const startDate = new Date(ticketDate);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later

    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nivra Telecom//Channel Selection//FR
BEGIN:VEVENT
UID:${Date.now()}@nivra.com
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${ticketSubject}
DESCRIPTION:Votre demande de sélection de chaînes TV est en cours de traitement. Un conseiller vous contactera bientôt.
LOCATION:Nivra Telecom
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nivra-channel-selection.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmé</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTicketStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-blue-500">Ouvert</Badge>;
      case "in_progress":
        return <Badge className="bg-orange-500">En cours</Badge>;
      case "resolved":
        return <Badge className="bg-green-500">Terminé</Badge>;
      case "closed":
        return <Badge className="bg-gray-500">Fermé</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const ChannelCard = ({ channel }: { channel: Channel }) => {
    const isSelected = selectedChannels.some(ch => ch.id === channel.id);
    
    return (
      <div 
        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
          isSelected 
            ? 'border-primary bg-primary/5 shadow-md' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        }`}
        onClick={() => toggleChannel(channel)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Checkbox checked={isSelected} className="pointer-events-none" />
              <span className="font-medium">{channel.name}</span>
              {channel.is_hd && <Badge variant="secondary" className="text-xs">HD</Badge>}
              {channel.is_4k && <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">4K</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{channel.description}</p>
          </div>
          <div className="text-right">
            {channel.price === 0 ? (
              <span className="text-green-600 font-semibold">Inclus</span>
            ) : (
              <span className="font-semibold">${channel.price}/mois</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Tv className="h-8 w-8 text-primary" />
            Sélection de Chaînes TV
          </h1>
          <p className="text-muted-foreground mt-2">
            Personnalisez votre forfait TV avec les chaînes de votre choix
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="browse" className="flex items-center gap-2">
              <Tv className="h-4 w-4" />
              Parcourir
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Channel Selection */}
              <div className="lg:col-span-2 space-y-6">
                {/* Basic Channels */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      Chaînes de Base (Incluses)
                    </CardTitle>
                    <CardDescription>
                      Ces chaînes sont incluses dans tous les forfaits TV
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {basicChannels.map(channel => (
                      <ChannelCard key={channel.id} channel={channel} />
                    ))}
                  </CardContent>
                </Card>

                {/* Premium Channels */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      Chaînes Premium ($10 - $18/mois chacune)
                    </CardTitle>
                    <CardDescription>
                      Ajoutez des chaînes individuelles à votre forfait
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-3">
                        {premiumChannels.map(channel => (
                          <ChannelCard key={channel.id} channel={channel} />
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Bundle Channels */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-purple-500" />
                      Forfaits & Bundles Premium
                    </CardTitle>
                    <CardDescription>
                      Économisez avec nos forfaits regroupés
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {bundleChannels.map(channel => (
                      <ChannelCard key={channel.id} channel={channel} />
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Cart Summary */}
              <div className="lg:col-span-1">
                <Card className="sticky top-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Votre Sélection
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedChannels.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Tv className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Aucune chaîne sélectionnée</p>
                        <p className="text-sm">Cliquez sur une chaîne pour l'ajouter</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {selectedPremium.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">Chaînes Premium ({selectedPremium.length})</p>
                              {selectedPremium.map(ch => (
                                <div key={ch.id} className="flex justify-between text-sm py-1">
                                  <span>{ch.name}</span>
                                  <span>${ch.price}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {selectedBundles.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-muted-foreground mb-1">Bundles ({selectedBundles.length})</p>
                              {selectedBundles.map(ch => (
                                <div key={ch.id} className="flex justify-between text-sm py-1">
                                  <span>{ch.name}</span>
                                  <span>${ch.price}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="flex justify-between font-semibold text-lg">
                            <span>Total mensuel</span>
                            <span className="text-primary">${totalPrice.toFixed(2)}/mois</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            + taxes applicables (TPS 5% + TVQ 9.975%)
                          </p>
                        </div>

                        <Button 
                          className="w-full" 
                          size="lg"
                          onClick={() => submitSelectionMutation.mutate()}
                          disabled={submitSelectionMutation.isPending || selectedChannels.length === 0}
                        >
                          {submitSelectionMutation.isPending ? (
                            "Traitement..."
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Soumettre la sélection
                            </>
                          )}
                        </Button>

                        <p className="text-xs text-center text-muted-foreground">
                          Un conseiller confirmera votre sélection sous 2-24h
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {/* Channel Selection History */}
            <Card>
              <CardHeader>
                <CardTitle>Historique des Sélections</CardTitle>
                <CardDescription>Vos demandes de sélection de chaînes</CardDescription>
              </CardHeader>
              <CardContent>
                {selectionsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Chargement...</div>
                ) : selections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Tv className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Aucune sélection effectuée</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setActiveTab("browse")}
                    >
                      Parcourir les chaînes
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selections.map(selection => (
                      <Card key={selection.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                {getStatusBadge(selection.status)}
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(selection.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                                </span>
                              </div>
                              <p className="font-medium">
                                {(selection.channels as any[])?.length || 0} chaînes sélectionnées
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Total: ${selection.total_price?.toFixed(2)}/mois
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(selection.channels as any[])?.slice(0, 5).map((ch: any, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">{ch.name}</Badge>
                                ))}
                                {(selection.channels as any[])?.length > 5 && (
                                  <Badge variant="secondary" className="text-xs">+{(selection.channels as any[]).length - 5} autres</Badge>
                                )}
                              </div>
                            </div>
                            {selection.confirmed_at && (
                              <div className="text-sm text-green-600">
                                <CheckCircle2 className="h-4 w-4 inline mr-1" />
                                Confirmé le {format(new Date(selection.confirmed_at), "d MMM yyyy", { locale: fr })}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Support Tickets History */}
            <Card>
              <CardHeader>
                <CardTitle>Tickets de Support Associés</CardTitle>
                <CardDescription>Statut de vos demandes de chaînes</CardDescription>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun ticket associé
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tickets.map(ticket => (
                      <Card key={ticket.id}>
                        <CardContent className="p-4">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {getTicketStatusBadge(ticket.status)}
                                <span className="text-sm font-medium">#{ticket.ticket_number}</span>
                              </div>
                              <p className="font-medium">{ticket.subject}</p>
                              <p className="text-sm text-muted-foreground">
                                Créé le {format(new Date(ticket.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateICS(ticket.created_at, ticket.subject)}
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              Ajouter au calendrier
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ClientLayout>
  );
};

export default ClientChannels;
