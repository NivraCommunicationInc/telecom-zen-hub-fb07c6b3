import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { 
  Tv, 
  Clock, 
  CheckCircle2, 
  XCircle,
  User,
  Mail,
  Calendar,
  DollarSign,
  Package,
  AlertCircle,
  Search,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  Gift,
  Percent,
  AlertTriangle,
  Wrench,
  Power,
  Ban,
  RefreshCw,
  History,
  Eye,
  Send,
  Shield
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ChannelSelection {
  id: string;
  user_id: string;
  channels: any[];
  total_price: number;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  related_ticket_id: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  client_number: string | null;
  phone: string | null;
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
  is_active: boolean;
}

interface TVChannel {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  is_active: boolean | null;
  is_hd: boolean | null;
  is_4k: boolean | null;
  status?: string;
  incident_type?: string | null;
  incident_reason?: string | null;
  incident_at?: string | null;
  replacement_channel_id?: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

interface ChannelActivityLog {
  id: string;
  channel_id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  actor_id: string;
  actor_role: string | null;
  actor_name: string | null;
  actor_email: string | null;
  client_id: string | null;
  client_email: string | null;
  notified_client: boolean;
  created_at: string;
}

const CHANNEL_STATUS_OPTIONS = [
  { value: "active", label: "Actif", icon: CheckCircle2, color: "bg-green-500" },
  { value: "maintenance", label: "Maintenance", icon: Wrench, color: "bg-yellow-500" },
  { value: "shutdown", label: "Arrêté", icon: Power, color: "bg-red-500" },
  { value: "end_of_life", label: "Fin de vie", icon: Ban, color: "bg-gray-500" },
];

const INCIDENT_TYPE_OPTIONS = [
  { value: "service_interruption", label: "Interruption de service" },
  { value: "permanently_closed", label: "Chaîne fermée définitivement" },
  { value: "discontinued", label: "Chaîne discontinuée" },
  { value: "legal_removal", label: "Retrait légal/réglementaire" },
];

const AdminChannels = () => {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { isAdmin, isEmployee, isTechnician, permissions } = useRoleAccess();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSelection, setSelectedSelection] = useState<ChannelSelection | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionDialog, setActionDialog] = useState<"confirm" | "cancel" | null>(null);
  
  // Channel management state
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<TVChannel | null>(null);
  const [channelForm, setChannelForm] = useState({
    status: "active",
    incident_type: "",
    incident_reason: "",
    replacement_channel_id: "",
    notify_clients: true,
  });

  // Channel activity logs dialog
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedChannelForLogs, setSelectedChannelForLogs] = useState<TVChannel | null>(null);

  // Edit selection dialog
  const [editSelectionDialogOpen, setEditSelectionDialogOpen] = useState(false);
  const [editingSelection, setEditingSelection] = useState<ChannelSelection | null>(null);
  const [editedChannels, setEditedChannels] = useState<any[]>([]);

  // Package management state
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ChannelPackage | null>(null);
  const [packageForm, setPackageForm] = useState({
    name: "",
    description: "",
    category: "theme_pack",
    original_price: "",
    discounted_price: "",
    is_active: true,
  });

  // Fetch all channel selections
  const { data: selections = [], isLoading } = useQuery({
    queryKey: ["admin-channel-selections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_selections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChannelSelection[];
    },
  });

  // Fetch all profiles for display
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-for-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, client_number, phone");
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Fetch related support tickets
  const { data: tickets = [] } = useQuery({
    queryKey: ["admin-channel-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .ilike("subject", "%Channel Selection%")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch channel packages
  const { data: packages = [] } = useQuery({
    queryKey: ["admin-channel-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_packages")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ChannelPackage[];
    },
  });

  // Fetch TV channels
  const { data: tvChannels = [] } = useQuery({
    queryKey: ["admin-tv-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_channels")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as TVChannel[];
    },
  });

  // Fetch channel activity logs
  const { data: channelLogs = [] } = useQuery({
    queryKey: ["admin-channel-activity-logs", selectedChannelForLogs?.id],
    queryFn: async () => {
      if (!selectedChannelForLogs?.id) return [];
      const { data, error } = await supabase
        .from("channel_activity_logs")
        .select("*")
        .eq("channel_id", selectedChannelForLogs.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChannelActivityLog[];
    },
    enabled: !!selectedChannelForLogs?.id,
  });

  // Fetch orders with TV channels for client visibility
  const { data: tvOrders = [] } = useQuery({
    queryKey: ["admin-tv-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .or("service_type.ilike.%TV%,service_type.ilike.%Bundle%")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getProfileByUserId = (userId: string) => {
    return profiles.find(p => p.user_id === userId);
  };

  // Confirm selection mutation
  const confirmMutation = useMutation({
    mutationFn: async ({ selectionId, notes }: { selectionId: string; notes: string }) => {
      const { error: selectionError } = await supabase
        .from("channel_selections")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          notes: notes,
        })
        .eq("id", selectionId);

      if (selectionError) throw selectionError;

      if (selectedSelection?.related_ticket_id) {
        await supabase
          .from("support_tickets")
          .update({ status: "resolved" })
          .eq("id", selectedSelection.related_ticket_id);
      }

      if (selectedProfile?.email) {
        try {
          await supabase.functions.invoke("send-channel-notification", {
            body: {
              email: selectedProfile.email,
              name: selectedProfile.full_name || "Client",
              type: "confirmed",
              channels: selectedSelection?.channels || [],
              totalPrice: selectedSelection?.total_price || 0,
              notes: notes,
            },
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
        }
      }

      await logActivity("channel_selection_confirmed", "channel_selection", selectionId, { notes });
      return { success: true };
    },
    onSuccess: () => {
      toast.success("Sélection de chaînes confirmée!");
      setActionDialog(null);
      setSelectedSelection(null);
      setActionNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-channel-selections"] });
      queryClient.invalidateQueries({ queryKey: ["admin-channel-tickets"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Cancel selection mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ selectionId, notes }: { selectionId: string; notes: string }) => {
      const { error: selectionError } = await supabase
        .from("channel_selections")
        .update({
          status: "cancelled",
          notes: notes,
        })
        .eq("id", selectionId);

      if (selectionError) throw selectionError;

      if (selectedSelection?.related_ticket_id) {
        await supabase
          .from("support_tickets")
          .update({ status: "closed" })
          .eq("id", selectedSelection.related_ticket_id);
      }

      if (selectedProfile?.email) {
        try {
          await supabase.functions.invoke("send-channel-notification", {
            body: {
              email: selectedProfile.email,
              name: selectedProfile.full_name || "Client",
              type: "cancelled",
              channels: selectedSelection?.channels || [],
              totalPrice: selectedSelection?.total_price || 0,
              notes: notes,
            },
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
        }
      }

      await logActivity("channel_selection_cancelled", "channel_selection", selectionId, { notes });
      return { success: true };
    },
    onSuccess: () => {
      toast.success("Sélection annulée");
      setActionDialog(null);
      setSelectedSelection(null);
      setActionNotes("");
      queryClient.invalidateQueries({ queryKey: ["admin-channel-selections"] });
      queryClient.invalidateQueries({ queryKey: ["admin-channel-tickets"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Update channel status mutation
  const updateChannelStatusMutation = useMutation({
    mutationFn: async ({ 
      channelId, 
      status, 
      incidentType, 
      incidentReason, 
      replacementChannelId,
      notifyClients 
    }: { 
      channelId: string; 
      status: string; 
      incidentType?: string; 
      incidentReason?: string;
      replacementChannelId?: string;
      notifyClients: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      const oldChannel = selectedChannel;
      const isShutdown = status === "shutdown" || status === "end_of_life";

      // Update channel
      const updateData: any = {
        status,
        updated_by: user.id,
        is_active: status === "active",
      };

      if (incidentType) {
        updateData.incident_type = incidentType;
        updateData.incident_reason = incidentReason || null;
        updateData.incident_at = new Date().toISOString();
      }

      if (replacementChannelId) {
        updateData.replacement_channel_id = replacementChannelId;
      }

      const { error } = await supabase
        .from("tv_channels")
        .update(updateData)
        .eq("id", channelId);

      if (error) throw error;

      // Log the activity
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const roleDisplayMap: Record<string, string> = {
        admin: "Admin",
        employee: "Employé",
        technician: "Technicien",
      };

      await supabase.from("channel_activity_logs").insert({
        channel_id: channelId,
        action: `channel_status_${status}`,
        field_changed: "status",
        old_value: oldChannel?.status || "active",
        new_value: status,
        reason: incidentReason || null,
        actor_id: user.id,
        actor_role: roleDisplayMap[userRole?.role || "admin"],
        actor_name: profile?.full_name || user.email?.split("@")[0],
        actor_email: profile?.email || user.email,
        notified_client: notifyClients,
      });

      // Notify affected clients if channel is shutdown
      if (notifyClients && isShutdown) {
        // Find clients with this channel in their orders
        const { data: affectedOrders } = await supabase
          .from("orders")
          .select("user_id, client_email, selected_channels")
          .or("service_type.ilike.%TV%,service_type.ilike.%Bundle%");

        const affectedClients = new Set<string>();
        affectedOrders?.forEach(order => {
          const channels = order.selected_channels as any[] || [];
          if (channels.some((ch: any) => ch.id === channelId)) {
            if (order.client_email) affectedClients.add(order.client_email);
          }
        });

        // Send notifications
        for (const email of affectedClients) {
          try {
            await supabase.functions.invoke("send-channel-notification", {
              body: {
                email,
                type: "channel_update",
                channelName: selectedChannel?.name,
                status,
                reason: incidentReason,
                replacementChannel: replacementChannelId 
                  ? tvChannels.find(c => c.id === replacementChannelId)?.name 
                  : null,
              },
            });
          } catch (err) {
            console.error("Failed to notify client:", err);
          }
        }
      }

      await logActivity(
        `channel_status_updated_${status}`,
        "tv_channel",
        channelId,
        { status, incidentType, incidentReason },
        { changedField: "status", oldValue: oldChannel?.status, newValue: status, reason: incidentReason }
      );

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Statut de la chaîne mis à jour");
      setChannelDialogOpen(false);
      setSelectedChannel(null);
      queryClient.invalidateQueries({ queryKey: ["admin-tv-channels"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Override selection mutation
  const overrideSelectionMutation = useMutation({
    mutationFn: async ({ 
      selectionId, 
      channels, 
      totalPrice 
    }: { 
      selectionId: string; 
      channels: any[]; 
      totalPrice: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("channel_selections")
        .update({
          channels,
          total_price: totalPrice,
          notes: "Modifié par l'administrateur",
        })
        .eq("id", selectionId);

      if (error) throw error;

      const profile = getProfileByUserId(editingSelection?.user_id || "");
      if (profile?.email) {
        try {
          await supabase.functions.invoke("send-channel-notification", {
            body: {
              email: profile.email,
              name: profile.full_name || "Client",
              type: "selection_modified",
              channels,
              totalPrice,
              notes: "Votre sélection de chaînes a été modifiée par notre équipe.",
            },
          });
        } catch (err) {
          console.error("Failed to send notification:", err);
        }
      }

      await logActivity("channel_selection_overridden", "channel_selection", selectionId, { 
        channelCount: channels.length, 
        totalPrice 
      });

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Sélection modifiée");
      setEditSelectionDialogOpen(false);
      setEditingSelection(null);
      queryClient.invalidateQueries({ queryKey: ["admin-channel-selections"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Update ticket status mutation
  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", ticketId);

      if (error) throw error;
      await logActivity("ticket_status_updated", "support_ticket", ticketId, { status });
      return { success: true };
    },
    onSuccess: () => {
      toast.success("Statut du ticket mis à jour");
      queryClient.invalidateQueries({ queryKey: ["admin-channel-tickets"] });
    },
  });

  // Create/Update package mutation
  const savePackageMutation = useMutation({
    mutationFn: async (pkg: typeof packageForm & { id?: string }) => {
      const savingsPercent = pkg.original_price && pkg.discounted_price
        ? Math.round(((parseFloat(pkg.original_price) - parseFloat(pkg.discounted_price)) / parseFloat(pkg.original_price)) * 100)
        : 0;

      if (editingPackage) {
        const { error } = await supabase
          .from("channel_packages")
          .update({
            name: pkg.name,
            description: pkg.description || null,
            category: pkg.category,
            original_price: parseFloat(pkg.original_price) || 0,
            discounted_price: parseFloat(pkg.discounted_price) || 0,
            savings_percent: savingsPercent,
            is_active: pkg.is_active,
          })
          .eq("id", editingPackage.id);
        if (error) throw error;
        await logActivity("package_updated", "channel_package", editingPackage.id);
      } else {
        const { error } = await supabase
          .from("channel_packages")
          .insert({
            name: pkg.name,
            description: pkg.description || null,
            category: pkg.category,
            channels: [],
            original_price: parseFloat(pkg.original_price) || 0,
            discounted_price: parseFloat(pkg.discounted_price) || 0,
            savings_percent: savingsPercent,
            is_active: pkg.is_active,
          });
        if (error) throw error;
        await logActivity("package_created", "channel_package", null);
      }
    },
    onSuccess: () => {
      toast.success(editingPackage ? "Forfait mis à jour" : "Forfait créé");
      queryClient.invalidateQueries({ queryKey: ["admin-channel-packages"] });
      setPackageDialogOpen(false);
      setEditingPackage(null);
      setPackageForm({ name: "", description: "", category: "theme_pack", original_price: "", discounted_price: "", is_active: true });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Toggle package active status
  const togglePackageMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("channel_packages")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut du forfait mis à jour");
      queryClient.invalidateQueries({ queryKey: ["admin-channel-packages"] });
    },
  });

  // Delete package mutation
  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("channel_packages")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await logActivity("package_deleted", "channel_package", id);
    },
    onSuccess: () => {
      toast.success("Forfait supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin-channel-packages"] });
    },
  });

  const openEditPackage = (pkg: ChannelPackage) => {
    setEditingPackage(pkg);
    setPackageForm({
      name: pkg.name,
      description: pkg.description || "",
      category: pkg.category,
      original_price: String(pkg.original_price),
      discounted_price: String(pkg.discounted_price),
      is_active: pkg.is_active,
    });
    setPackageDialogOpen(true);
  };

  const openCreatePackage = () => {
    setEditingPackage(null);
    setPackageForm({ name: "", description: "", category: "theme_pack", original_price: "", discounted_price: "", is_active: true });
    setPackageDialogOpen(true);
  };

  const openChannelStatusDialog = (channel: TVChannel) => {
    setSelectedChannel(channel);
    setChannelForm({
      status: channel.status || "active",
      incident_type: channel.incident_type || "",
      incident_reason: channel.incident_reason || "",
      replacement_channel_id: channel.replacement_channel_id || "",
      notify_clients: true,
    });
    setChannelDialogOpen(true);
  };

  const openChannelLogs = (channel: TVChannel) => {
    setSelectedChannelForLogs(channel);
    setLogsDialogOpen(true);
  };

  const openEditSelection = (selection: ChannelSelection) => {
    setEditingSelection(selection);
    setEditedChannels([...(selection.channels as any[])]);
    setEditSelectionDialogOpen(true);
  };

  const removeChannelFromSelection = (channelIndex: number) => {
    setEditedChannels(prev => prev.filter((_, idx) => idx !== channelIndex));
  };

  const calculateEditedTotal = () => {
    return editedChannels.reduce((sum, ch) => sum + (ch.price || 0), 0);
  };

  const pendingSelections = selections.filter(s => s.status === "pending");
  const confirmedSelections = selections.filter(s => s.status === "confirmed");
  const cancelledSelections = selections.filter(s => s.status === "cancelled");

  const filteredSelections = selections.filter(s => {
    if (!searchTerm) return true;
    const profile = getProfileByUserId(s.user_id);
    const searchLower = searchTerm.toLowerCase();
    return (
      profile?.full_name?.toLowerCase().includes(searchLower) ||
      profile?.email?.toLowerCase().includes(searchLower) ||
      profile?.client_number?.toLowerCase().includes(searchLower)
    );
  });

  const filteredChannels = tvChannels.filter(ch => {
    if (!searchTerm) return true;
    return ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           ch.category.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
      case "confirmed":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmé</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> Annulé</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getChannelStatusBadge = (status: string) => {
    const option = CHANNEL_STATUS_OPTIONS.find(o => o.value === status);
    if (!option) return <Badge>{status}</Badge>;
    const Icon = option.icon;
    return <Badge className={option.color}><Icon className="w-3 h-3 mr-1" /> {option.label}</Badge>;
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

  const openActionDialog = (selection: ChannelSelection, action: "confirm" | "cancel") => {
    setSelectedSelection(selection);
    setSelectedProfile(getProfileByUserId(selection.user_id) || null);
    setActionDialog(action);
    setActionNotes("");
  };

  // Channel statistics
  const activeChannels = tvChannels.filter(c => c.status === "active" || !c.status).length;
  const maintenanceChannels = tvChannels.filter(c => c.status === "maintenance").length;
  const shutdownChannels = tvChannels.filter(c => c.status === "shutdown" || c.status === "end_of_life").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Tv className="h-8 w-8 text-primary" />
            Gestion des Chaînes TV
          </h1>
          <p className="text-muted-foreground mt-2">
            Gérez les sélections de chaînes, statuts et incidents
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingSelections.length}</p>
                  <p className="text-sm text-muted-foreground">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{confirmedSelections.length}</p>
                  <p className="text-sm text-muted-foreground">Confirmées</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Tv className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeChannels}</p>
                  <p className="text-sm text-muted-foreground">Chaînes actives</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Wrench className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{maintenanceChannels}</p>
                  <p className="text-sm text-muted-foreground">Maintenance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Power className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{shutdownChannels}</p>
                  <p className="text-sm text-muted-foreground">Arrêtées</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{packages.length}</p>
                  <p className="text-sm text-muted-foreground">Forfaits</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              En attente ({pendingSelections.length})
            </TabsTrigger>
            <TabsTrigger value="all">Toutes les sélections</TabsTrigger>
            <TabsTrigger value="channels" className="flex items-center gap-2">
              <Tv className="h-4 w-4" />
              Gestion Chaînes ({tvChannels.length})
            </TabsTrigger>
            <TabsTrigger value="tickets">Tickets associés</TabsTrigger>
            <TabsTrigger value="packages" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Forfaits ({packages.length})
            </TabsTrigger>
          </TabsList>

          {/* Pending Selections Tab */}
          <TabsContent value="pending" className="space-y-4">
            {pendingSelections.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune sélection en attente</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingSelections.map(selection => {
                  const profile = getProfileByUserId(selection.user_id);
                  return (
                    <Card key={selection.id} className="border-l-4 border-l-yellow-500">
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                          {/* Client Info */}
                          <div className="space-y-3">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Information Client
                            </h3>
                            <div className="space-y-2 text-sm">
                              <p><strong>Nom:</strong> {profile?.full_name || "N/A"}</p>
                              <p><strong>Email:</strong> {profile?.email || "N/A"}</p>
                              <p><strong>Téléphone:</strong> {profile?.phone || "N/A"}</p>
                              <p><strong>N° Client:</strong> {profile?.client_number || "N/A"}</p>
                            </div>
                          </div>

                          {/* Selection Details */}
                          <div className="space-y-3">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              <Tv className="h-4 w-4" />
                              Chaînes Sélectionnées ({(selection.channels as any[])?.length || 0})
                            </h3>
                            <ScrollArea className="h-32">
                              <div className="space-y-1">
                                {(selection.channels as any[])?.map((ch: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span>{ch.name}</span>
                                    <span className="text-muted-foreground">
                                      {ch.price === 0 ? "Inclus" : `$${ch.price}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                            <Separator />
                            <div className="flex justify-between font-semibold">
                              <span>Total mensuel:</span>
                              <span className="text-primary">${selection.total_price?.toFixed(2)}/mois</span>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-3">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Détails
                            </h3>
                            <div className="space-y-2 text-sm">
                              <p><strong>Date:</strong> {format(new Date(selection.created_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                              <p><strong>Statut:</strong> {getStatusBadge(selection.status)}</p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="space-y-3">
                            <h3 className="font-semibold text-lg">Actions</h3>
                            <div className="flex flex-col gap-2">
                              <Button 
                                onClick={() => openActionDialog(selection, "confirm")}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Confirmer
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => openEditSelection(selection)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Modifier
                              </Button>
                              <Button 
                                variant="destructive"
                                onClick={() => openActionDialog(selection, "cancel")}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Annuler
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* All Selections Tab */}
          <TabsContent value="all" className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email ou numéro client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredSelections.map(selection => {
                const profile = getProfileByUserId(selection.user_id);
                return (
                  <Card key={selection.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(selection.status)}
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(selection.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                            </span>
                          </div>
                          <p className="font-medium">{profile?.full_name || "Client inconnu"}</p>
                          <p className="text-sm text-muted-foreground">{profile?.email}</p>
                          <p className="text-sm">
                            {(selection.channels as any[])?.length || 0} chaînes - ${selection.total_price?.toFixed(2)}/mois
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditSelection(selection)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Modifier
                          </Button>
                          {selection.status === "pending" && (
                            <>
                              <Button size="sm" onClick={() => openActionDialog(selection, "confirm")}>
                                Confirmer
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openActionDialog(selection, "cancel")}>
                                Annuler
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Channel Management Tab */}
          <TabsContent value="channels" className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou catégorie..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredChannels.map(channel => (
                <Card key={channel.id} className={channel.status === "shutdown" || channel.status === "end_of_life" ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          {channel.name}
                          {channel.is_hd && <Badge variant="outline" className="text-xs">HD</Badge>}
                          {channel.is_4k && <Badge variant="outline" className="text-xs">4K</Badge>}
                        </h4>
                        <p className="text-sm text-muted-foreground">{channel.category}</p>
                      </div>
                      {getChannelStatusBadge(channel.status || "active")}
                    </div>

                    {channel.incident_type && (
                      <div className="p-2 bg-red-50 rounded-lg mb-3 text-sm">
                        <div className="flex items-center gap-1 text-red-600 font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          {INCIDENT_TYPE_OPTIONS.find(i => i.value === channel.incident_type)?.label}
                        </div>
                        {channel.incident_reason && (
                          <p className="text-red-500 mt-1">{channel.incident_reason}</p>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between text-sm mb-3">
                      <span>Prix:</span>
                      <span className="font-medium">
                        {channel.price === 0 ? "Inclus" : `$${channel.price}/mois`}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => openChannelStatusDialog(channel)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Statut
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => openChannelLogs(channel)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredChannels.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Tv className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune chaîne trouvée</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tickets de Sélection de Chaînes</CardTitle>
                <CardDescription>Tous les tickets liés aux sélections de chaînes</CardDescription>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun ticket
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
                                <span className="font-medium">#{ticket.ticket_number}</span>
                              </div>
                              <p className="font-medium">{ticket.subject}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {ticket.status === "open" && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => updateTicketMutation.mutate({ ticketId: ticket.id, status: "in_progress" })}
                                >
                                  <ArrowRight className="h-4 w-4 mr-1" />
                                  En cours
                                </Button>
                              )}
                              {ticket.status === "in_progress" && (
                                <Button 
                                  size="sm"
                                  onClick={() => updateTicketMutation.mutate({ ticketId: ticket.id, status: "resolved" })}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Terminer
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Packages Tab */}
          <TabsContent value="packages" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Gestion des Forfaits Thématiques</h3>
                <p className="text-sm text-muted-foreground">Créez et gérez les forfaits de chaînes avec réductions</p>
              </div>
              <Button onClick={openCreatePackage}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau Forfait
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages.map(pkg => {
                const channelsList = Array.isArray(pkg.channels) ? pkg.channels : [];
                return (
                  <Card key={pkg.id} className={`${!pkg.is_active ? 'opacity-60' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {pkg.name}
                            {!pkg.is_active && <Badge variant="secondary">Inactif</Badge>}
                          </CardTitle>
                          <CardDescription>{pkg.description}</CardDescription>
                        </div>
                        {pkg.savings_percent && (
                          <Badge className="bg-green-500">
                            <Percent className="w-3 h-3 mr-1" />
                            -{pkg.savings_percent}%
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Prix original:</span>
                        <span className="line-through">${pkg.original_price}/mois</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Prix réduit:</span>
                        <span className="text-green-600">${pkg.discounted_price}/mois</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {channelsList.length} chaînes incluses
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={pkg.is_active}
                            onCheckedChange={(checked) => togglePackageMutation.mutate({ id: pkg.id, is_active: checked })}
                          />
                          <span className="text-sm">{pkg.is_active ? 'Actif' : 'Inactif'}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditPackage(pkg)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Supprimer ce forfait?")) {
                                deletePackageMutation.mutate(pkg.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {packages.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun forfait thématique</p>
                  <Button className="mt-4" onClick={openCreatePackage}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un forfait
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Dialog (Confirm/Cancel Selection) */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "confirm" ? "Confirmer la sélection" : "Annuler la sélection"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog === "confirm" 
                ? "Confirmez cette sélection de chaînes pour le client."
                : "Annulez cette sélection de chaînes."}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSelection && selectedProfile && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p><strong>Client:</strong> {selectedProfile.full_name}</p>
                <p><strong>Email:</strong> {selectedProfile.email}</p>
                <p><strong>Chaînes:</strong> {(selectedSelection.channels as any[])?.length || 0}</p>
                <p><strong>Total:</strong> ${selectedSelection.total_price?.toFixed(2)}/mois</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optionnel)</label>
                <Textarea
                  placeholder="Ajoutez des notes..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Fermer
            </Button>
            <Button
              variant={actionDialog === "cancel" ? "destructive" : "default"}
              onClick={() => {
                if (actionDialog === "confirm") {
                  confirmMutation.mutate({ selectionId: selectedSelection!.id, notes: actionNotes });
                } else {
                  cancelMutation.mutate({ selectionId: selectedSelection!.id, notes: actionNotes });
                }
              }}
              disabled={confirmMutation.isPending || cancelMutation.isPending}
            >
              {actionDialog === "confirm" ? "Confirmer" : "Annuler la sélection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Status Dialog */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5" />
              Modifier le statut: {selectedChannel?.name}
            </DialogTitle>
            <DialogDescription>
              Mettez à jour le statut de la chaîne et signalez les incidents
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Statut de la chaîne</Label>
              <Select 
                value={channelForm.status} 
                onValueChange={(value) => setChannelForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(channelForm.status === "shutdown" || channelForm.status === "end_of_life" || channelForm.status === "maintenance") && (
              <>
                <div className="space-y-2">
                  <Label>Type d'incident</Label>
                  <Select 
                    value={channelForm.incident_type} 
                    onValueChange={(value) => setChannelForm(prev => ({ ...prev, incident_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Raison (interne)</Label>
                  <Textarea
                    placeholder="Décrivez la raison du changement..."
                    value={channelForm.incident_reason}
                    onChange={(e) => setChannelForm(prev => ({ ...prev, incident_reason: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Chaîne de remplacement (optionnel)</Label>
                  <Select 
                    value={channelForm.replacement_channel_id} 
                    onValueChange={(value) => setChannelForm(prev => ({ ...prev, replacement_channel_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une chaîne" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucune</SelectItem>
                      {tvChannels
                        .filter(c => c.id !== selectedChannel?.id && (c.status === "active" || !c.status))
                        .map(channel => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Switch
                checked={channelForm.notify_clients}
                onCheckedChange={(checked) => setChannelForm(prev => ({ ...prev, notify_clients: checked }))}
              />
              <div>
                <p className="font-medium text-sm">Notifier les clients</p>
                <p className="text-xs text-muted-foreground">
                  Envoyer une notification aux clients affectés
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                updateChannelStatusMutation.mutate({
                  channelId: selectedChannel!.id,
                  status: channelForm.status,
                  incidentType: channelForm.incident_type || undefined,
                  incidentReason: channelForm.incident_reason || undefined,
                  replacementChannelId: channelForm.replacement_channel_id || undefined,
                  notifyClients: channelForm.notify_clients,
                });
              }}
              disabled={updateChannelStatusMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Mettre à jour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Activity Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique: {selectedChannelForLogs?.name}
            </DialogTitle>
            <DialogDescription>
              Journal des modifications de cette chaîne
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px]">
            {channelLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucun historique</p>
              </div>
            ) : (
              <div className="space-y-3">
                {channelLogs.map(log => (
                  <Card key={log.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.actor_role}</Badge>
                            <span className="font-medium">{log.actor_name}</span>
                            {log.notified_client && (
                              <Badge className="bg-blue-500 text-xs">
                                <Mail className="h-3 w-3 mr-1" />
                                Notifié
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{log.actor_email}</p>
                          <p className="text-sm">
                            <strong>{log.field_changed}:</strong> {log.old_value} → {log.new_value}
                          </p>
                          {log.reason && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Raison:</strong> {log.reason}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Selection Dialog */}
      <Dialog open={editSelectionDialogOpen} onOpenChange={setEditSelectionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Modifier la sélection
            </DialogTitle>
            <DialogDescription>
              Modifiez ou supprimez les chaînes de cette sélection
            </DialogDescription>
          </DialogHeader>

          {editingSelection && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{getProfileByUserId(editingSelection.user_id)?.full_name}</p>
                <p className="text-sm text-muted-foreground">{getProfileByUserId(editingSelection.user_id)?.email}</p>
              </div>

              <div className="space-y-2">
                <Label>Chaînes sélectionnées</Label>
                <ScrollArea className="h-[200px] border rounded-lg p-2">
                  {editedChannels.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">Aucune chaîne</p>
                  ) : (
                    <div className="space-y-2">
                      {editedChannels.map((ch, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-background rounded">
                          <div>
                            <p className="font-medium">{ch.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {ch.price === 0 ? "Inclus" : `$${ch.price}/mois`}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => removeChannelFromSelection(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="flex justify-between font-semibold p-3 bg-primary/10 rounded-lg">
                <span>Nouveau total:</span>
                <span className="text-primary">${calculateEditedTotal().toFixed(2)}/mois</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSelectionDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => {
                overrideSelectionMutation.mutate({
                  selectionId: editingSelection!.id,
                  channels: editedChannels,
                  totalPrice: calculateEditedTotal(),
                });
              }}
              disabled={overrideSelectionMutation.isPending}
            >
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Package Dialog */}
      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? "Modifier le forfait" : "Nouveau forfait"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du forfait</Label>
              <Input
                value={packageForm.name}
                onChange={(e) => setPackageForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Pack Sport"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={packageForm.description}
                onChange={(e) => setPackageForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description du forfait..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prix original ($/mois)</Label>
                <Input
                  type="number"
                  value={packageForm.original_price}
                  onChange={(e) => setPackageForm(prev => ({ ...prev, original_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Prix réduit ($/mois)</Label>
                <Input
                  type="number"
                  value={packageForm.discounted_price}
                  onChange={(e) => setPackageForm(prev => ({ ...prev, discounted_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={packageForm.is_active}
                onCheckedChange={(checked) => setPackageForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>Forfait actif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => savePackageMutation.mutate(packageForm)}
              disabled={savePackageMutation.isPending || !packageForm.name}
            >
              {editingPackage ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminChannels;