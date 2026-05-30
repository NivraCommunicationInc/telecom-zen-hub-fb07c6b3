import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
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
  Download,
  Gift,
  Percent,
  Edit,
  Save,
  X,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { checkAccountBlockedForAction } from "@/lib/accountBlockCheck";
import { useClientBlockStatus } from "@/hooks/useClientBlockStatus";
import BlockedActionWrapper from "@/components/client/BlockedActionWrapper";
import { notifyAdmin, getAdminPortalLink } from "@/hooks/useAdminNotification";

interface Channel {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  is_hd: boolean;
  is_4k: boolean;
}

interface ChannelPackage {
  id: string;
  name: string;
  description: string | null;
  channels: any;
  original_price: number;
  discounted_price: number;
  savings_percent: number | null;
  category: string;
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

interface TVOrder {
  id: string;
  order_number: string;
  service_type: string;
  category: string;
  status: string;
  selected_channels: any[];
  created_at: string;
}

const ClientChannels = () => {
  const { user } = useClientAuth();
  const { isAccountBlocked } = useClientBlockStatus();
  const queryClient = useQueryClient();
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<ChannelPackage[]>([]);
  const [activeTab, setActiveTab] = useState("my-channels");
  
  // Editing state for order channels
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingChannels, setEditingChannels] = useState<any[]>([]);

  // Fetch all channels
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["tv-channels"],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("tv_channels")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Channel[];
    },
  });

  // Fetch channel packages
  const { data: packages = [] } = useQuery({
    queryKey: ["channel-packages"],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("channel_packages")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as ChannelPackage[];
    },
  });

  // TV orders, profile, and tickets from canonical snapshot
  const { data: canonical, isLoading: canonicalLoading } = useCanonicalClientData(user?.id);

  const tvOrders: TVOrder[] = ((canonical?.orders || []) as any[])
    .filter((order) => {
      const category = String(order.category || "").toLowerCase();
      const serviceType = String(order.service_type || "").toLowerCase();
      return (
        category.includes("tv") ||
        serviceType.includes("tv") ||
        serviceType.includes("giga") ||
        category.includes("giga")
      );
    })
    .map((o) => ({
      id: o.id,
      order_number: o.order_number,
      service_type: o.service_type,
      category: o.category,
      status: o.status,
      selected_channels: o.selected_channels || [],
      created_at: o.created_at,
    }));
  const ordersLoading = canonicalLoading;

  // Filter out cancelled orders for channel display
  const activeOrders = tvOrders.filter((order) => order.status !== "cancelled");

  // Fetch user's channel selections (not yet in canonical snapshot)
  const { data: selections = [], isLoading: selectionsLoading } = useQuery({
    queryKey: ["channel-selections", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await portalSupabase
        .from("channel_selections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChannelSelection[];
    },
    enabled: !!user?.id,
  });

  const profile = canonical?.profile || null;

  // Related channel tickets from canonical snapshot
  const tickets = ((canonical?.supportTickets || []) as any[]).filter((t) =>
    String(t.subject || "").toLowerCase().includes("channel")
  );


  // Update order channels mutation
  const updateOrderChannelsMutation = useMutation({
    mutationFn: async ({ orderId, channels }: { orderId: string; channels: any[] }) => {
      const { error } = await portalSupabase
        .from("orders")
        .update({ 
          selected_channels: channels,
          channel_assigned_by: user?.id || null,
        })
        .eq("id", orderId);
      if (error) throw error;

      // Send confirmation email (non-blocking)
      try {
        const channelList = Array.isArray(channels) ? channels : [];
        const totalPrice = channelList.reduce(
          (sum: number, ch: any) => sum + Number(ch?.price || 0),
          0,
        );
        const names = channelList
          .map((ch: any) => ch?.name)
          .filter(Boolean)
          .slice(0, 8)
          .join(", ") + (channelList.length > 8 ? `, +${channelList.length - 8} autres` : "");
        await portalSupabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "client_tv_channels_updated",
            recipientEmail: profile?.email || user?.email,
            idempotencyKey: `tv_channels_updated_${orderId}_${Date.now()}`,
            templateData: {
              first_name: (profile as any)?.first_name || (profile?.full_name || "").split(" ")[0] || "",
              client_name: profile?.full_name || "",
              channel_count: String(channelList.length),
              total_price: `${totalPrice.toFixed(2)} $`,
              channel_names: names || "—",
            },
          },
        });
      } catch {
        /* non-blocking */
      }
    },
    onSuccess: () => {
      toast.success("Chaînes mises à jour. Un courriel de confirmation a été envoyé.");
      setEditingOrderId(null);
      setEditingChannels([]);
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Submit channel selection mutation
  const submitSelectionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      
      // Combine channels and packages
      const channelPrice = selectedChannels.reduce((sum, ch) => sum + (ch.price || 0), 0);
      const packagePrice = selectedPackages.reduce((sum, pkg) => sum + (pkg.discounted_price || 0), 0);
      const totalPrice = channelPrice + packagePrice;
      
      const channelData = [
        ...selectedChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          category: ch.category,
          price: ch.price,
          is_hd: ch.is_hd,
          is_4k: ch.is_4k,
          type: 'channel',
        })),
        ...selectedPackages.map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          category: pkg.category,
          price: pkg.discounted_price,
          original_price: pkg.original_price,
          savings_percent: pkg.savings_percent,
          included_channels: pkg.channels,
          type: 'package',
        })),
      ];

      const totalItems = selectedChannels.length + selectedPackages.length;

      // Create support ticket first
      const etaHours = Math.floor(Math.random() * 22) + 2; // 2-24 hours
      const etaDate = new Date();
      etaDate.setHours(etaDate.getHours() + etaHours);

      let ticketDescription = `
**Demande de sélection de chaînes TV**

**Client:** ${profile?.full_name || "N/A"}
**Email:** ${profile?.email || user.email}
**Numéro client:** ${profile?.client_number || "N/A"}
`;

      if (selectedChannels.length > 0) {
        ticketDescription += `
**Chaînes sélectionnées (${selectedChannels.length}):**
${selectedChannels.map(ch => `- ${ch.name} (${ch.category === 'basic' ? 'Inclus' : `$${ch.price}/mois`})`).join('\n')}
`;
      }

      if (selectedPackages.length > 0) {
        ticketDescription += `
**Forfaits thématiques (${selectedPackages.length}):**
${selectedPackages.map(pkg => `- ${pkg.name} ($${pkg.discounted_price}/mois - Économie de ${pkg.savings_percent}%)`).join('\n')}
`;
      }

      ticketDescription += `
**Total mensuel estimé:** $${totalPrice.toFixed(2)}/mois

**ETA:** ${format(etaDate, "d MMMM yyyy à HH:mm", { locale: fr })}

Cette demande est en attente de confirmation par un administrateur.
      `.trim();

      const { data: ticket, error: ticketError } = await portalSupabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          subject: `Channel Selection Request - ${totalItems} items`,
          description: ticketDescription,
          priority: "normal",
          status: "open",
          client_email: profile?.email || user.email,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create channel selection record
      const { data: selection, error: selectionError } = await portalSupabase
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
    onSuccess: (data) => {
      toast.success("Sélection de chaînes soumise avec succès!");
      
      // Send admin notification (fire-and-forget)
      notifyAdmin({
        event_type: "channel_change_request",
        event_id: data.selection.id,
        event_number: data.ticket.ticket_number,
        client_name: profile?.full_name || user?.email,
        client_email: user?.email,
        client_phone: profile?.phone,
        summary: `Demande de changement de chaînes - ${selectedChannels.length} chaînes, ${selectedPackages.length} forfaits`,
        details: {
          "Chaînes sélectionnées": selectedChannels.length,
          "Forfaits sélectionnés": selectedPackages.length,
          "Total mensuel": `$${totalPrice.toFixed(2)}/mois`,
        },
        priority: "normal",
        admin_portal_link: getAdminPortalLink(`/admin/channels?selection=${data.selection.id}`),
      });
      
      setSelectedChannels([]);
      setSelectedPackages([]);
      setActiveTab("history");
      queryClient.invalidateQueries({ queryKey: ["channel-selections"] });
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
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

  const togglePackage = (pkg: ChannelPackage) => {
    setSelectedPackages(prev => {
      const exists = prev.find(p => p.id === pkg.id);
      if (exists) {
        return prev.filter(p => p.id !== pkg.id);
      }
      return [...prev, pkg];
    });
  };

  const channelPrice = selectedChannels.reduce((sum, ch) => sum + (ch.price || 0), 0);
  const packagePrice = selectedPackages.reduce((sum, pkg) => sum + (pkg.discounted_price || 0), 0);
  const totalPrice = channelPrice + packagePrice;
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
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300"><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmé</Badge>;
      case "activated":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300"><CheckCircle2 className="w-3 h-3 mr-1" /> Activé ✅</Badge>;
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

  const PackageCard = ({ pkg }: { pkg: ChannelPackage }) => {
    const isSelected = selectedPackages.some(p => p.id === pkg.id);
    const channelsList = Array.isArray(pkg.channels) ? pkg.channels : [];
    
    return (
      <div 
        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
          isSelected 
            ? 'border-green-500 bg-green-50 shadow-md' 
            : 'border-border hover:border-green-500/50 hover:bg-green-50/30'
        }`}
        onClick={() => togglePackage(pkg)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Checkbox checked={isSelected} className="pointer-events-none" />
              <span className="font-semibold text-lg">{pkg.name}</span>
              {pkg.savings_percent && (
                <Badge className="bg-green-500 text-white">
                  <Percent className="w-3 h-3 mr-1" />
                  -{pkg.savings_percent}%
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Chaînes incluses ({channelsList.length}):</p>
              <div className="flex flex-wrap gap-1">
                {channelsList.slice(0, 4).map((ch: any, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {ch.name}
                  </Badge>
                ))}
                {channelsList.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{channelsList.length - 4} autres
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground line-through">
              ${pkg.original_price}/mois
            </div>
            <div className="text-xl font-bold text-green-600">
              ${pkg.discounted_price}/mois
            </div>
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

        {/* TV Channel Changes Info - Contract Annex */}
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Délais de traitement des changements</p>
                <p className="text-muted-foreground">
                  Les modifications de chaînes sont traitées via ticket interne. 
                  Délai estimé : <strong>2h à 24h</strong> selon la complexité. 
                  Statuts : Ouvert → En cours → Terminé.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="my-channels" className="flex items-center gap-2">
              <Tv className="h-4 w-4" />
              Mes Chaînes
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          {/* My Channels Tab - Shows channels from TV orders */}
          <TabsContent value="my-channels" className="space-y-6">
            {ordersLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Chargement de vos chaînes...
                </CardContent>
              </Card>
            ) : activeOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Tv className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">Aucun forfait TV actif</h3>
                  <p className="text-muted-foreground">
                    Vous n'avez pas encore de commande TV avec des chaînes sélectionnées.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {activeOrders.map(order => {
                  const orderChannels = Array.isArray(order.selected_channels) ? order.selected_channels : [];
                  const isEditing = editingOrderId === order.id;
                  const displayChannels = isEditing ? editingChannels : orderChannels;
                  
                  const baseChannels = displayChannels.filter((ch: any) => ch.type === 'base_included' || ch.category === 'base');
                  const freeChoiceChannels = displayChannels.filter((ch: any) => ch.type === 'free_choice' || ch.category === 'free_choice');
                  const paidChannels = displayChannels.filter((ch: any) => ch.type === 'paid_addon' || ch.category === 'paid');
                  
                  const getStatusBadgeColor = (status: string) => {
                    switch (status) {
                      case 'pending': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
                      case 'processing': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
                      case 'completed': return 'bg-green-500/20 text-green-600 border-green-500/30';
                      case 'shipped': return 'bg-purple-500/20 text-purple-600 border-purple-500/30';
                      default: return 'bg-gray-500/20 text-gray-600 border-gray-500/30';
                    }
                  };

                  const startEditing = () => {
                    setEditingOrderId(order.id);
                    setEditingChannels([...orderChannels]);
                  };

                  const cancelEditing = () => {
                    setEditingOrderId(null);
                    setEditingChannels([]);
                  };

                  const saveChanges = () => {
                    updateOrderChannelsMutation.mutate({
                      orderId: order.id,
                      channels: editingChannels,
                    });
                  };

                  const toggleEditChannel = (channel: Channel, type: string) => {
                    setEditingChannels(prev => {
                      const exists = prev.find((ch: any) => ch.id === channel.id);
                      if (exists) {
                        return prev.filter((ch: any) => ch.id !== channel.id);
                      }
                      return [...prev, {
                        id: channel.id,
                        name: channel.name,
                        category: channel.category,
                        price: channel.price,
                        is_hd: channel.is_hd,
                        type: type,
                      }];
                    });
                  };

                  return (
                    <Card key={order.id} className="border-l-4 border-l-primary">
                      <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Tv className="h-5 w-5 text-primary" />
                              Commande {order.order_number}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {order.service_type} • Créée le {format(new Date(order.created_at), "d MMMM yyyy", { locale: fr })}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getStatusBadgeColor(order.status)}>
                              {order.status === 'pending' ? 'En attente' : 
                               order.status === 'processing' ? 'En traitement' :
                               order.status === 'completed' ? 'Complétée' :
                               order.status === 'shipped' ? 'Expédiée' : order.status}
                            </Badge>
                            {!isEditing ? (
                              <BlockedActionWrapper action="change">
                                <Button variant="outline" size="sm" onClick={startEditing} disabled={isAccountBlocked}>
                                  <Edit className="h-4 w-4 mr-1" />
                                  Modifier
                                </Button>
                              </BlockedActionWrapper>
                            ) : (
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={cancelEditing}
                                  disabled={updateOrderChannelsMutation.isPending}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Annuler
                                </Button>
                                <BlockedActionWrapper action="change">
                                  <Button 
                                    size="sm" 
                                    onClick={saveChanges}
                                    disabled={isAccountBlocked || updateOrderChannelsMutation.isPending}
                                  >
                                    {updateOrderChannelsMutation.isPending ? (
                                      "Sauvegarde..."
                                    ) : (
                                      <>
                                        <Save className="h-4 w-4 mr-1" />
                                        Sauvegarder
                                      </>
                                    )}
                                  </Button>
                                </BlockedActionWrapper>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {orderChannels.length === 0 && !isEditing ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Aucune chaîne sélectionnée pour cette commande.</p>
                            <Button variant="link" onClick={startEditing} className="mt-2">
                              Ajouter des chaînes
                            </Button>
                          </div>
                        ) : isEditing ? (
                          <div className="space-y-4">
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-sm text-blue-700 flex items-center gap-2">
                                <Edit className="h-4 w-4" />
                                Mode édition - Cliquez sur les chaînes pour les ajouter/retirer
                              </p>
                            </div>
                            
                            {/* Base Channels (read-only in edit mode) */}
                            {baseChannels.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  Chaînes de base (incluses)
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {baseChannels.map((ch: any, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="bg-green-100 text-green-700">
                                      {ch.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Editable Free Choice Channels */}
                            <div>
                              <h4 className="font-medium mb-2 flex items-center gap-2">
                                <Star className="h-4 w-4 text-yellow-500" />
                                Chaînes au choix (sélectionnez)
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {channels.filter(ch => ch.category === 'free_choice').map(channel => {
                                  const isSelected = editingChannels.some((ch: any) => ch.id === channel.id);
                                  return (
                                    <div 
                                      key={channel.id}
                                      className={`p-2 rounded border cursor-pointer transition-all ${
                                        isSelected 
                                          ? 'border-primary bg-primary/10' 
                                          : 'border-border hover:border-primary/50'
                                      }`}
                                      onClick={() => toggleEditChannel(channel, 'free_choice')}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Checkbox checked={isSelected} className="pointer-events-none" />
                                        <span className="text-sm">{channel.name}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Editable Paid Channels */}
                            <div>
                              <h4 className="font-medium mb-2 flex items-center gap-2">
                                <Package className="h-4 w-4 text-purple-500" />
                                Chaînes payantes
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {channels.filter(ch => ch.category === 'paid').map(channel => {
                                  const isSelected = editingChannels.some((ch: any) => ch.id === channel.id);
                                  return (
                                    <div 
                                      key={channel.id}
                                      className={`p-2 rounded border cursor-pointer transition-all ${
                                        isSelected 
                                          ? 'border-purple-500 bg-purple-50' 
                                          : 'border-border hover:border-purple-500/50'
                                      }`}
                                      onClick={() => toggleEditChannel(channel, 'paid_addon')}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <Checkbox checked={isSelected} className="pointer-events-none" />
                                          <span className="text-sm">{channel.name}</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">${channel.price}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Base Channels */}
                            {baseChannels.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Check className="h-4 w-4 text-green-500" />
                                  Chaînes de base ({baseChannels.length})
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {baseChannels.map((ch: any, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="bg-green-100 text-green-700">
                                      {ch.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Free Choice Channels */}
                            {freeChoiceChannels.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Star className="h-4 w-4 text-yellow-500" />
                                  Chaînes au choix ({freeChoiceChannels.length})
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {freeChoiceChannels.map((ch: any, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="bg-yellow-100 text-yellow-700">
                                      {ch.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Paid Channels */}
                            {paidChannels.length > 0 && (
                              <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                  <Package className="h-4 w-4 text-purple-500" />
                                  Chaînes payantes ({paidChannels.length})
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {paidChannels.map((ch: any, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="bg-purple-100 text-purple-700">
                                      {ch.name} {ch.price > 0 && `($${ch.price}/mois)`}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
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
