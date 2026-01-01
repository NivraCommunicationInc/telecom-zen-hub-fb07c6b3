import { useState, useRef, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Users, Plus, Search, Eye, Upload, FileText, Trash2, 
  ShoppingBag, CreditCard, Ticket, Calendar, Bell, Package,
  DollarSign, Clock, AlertCircle, Wallet, Ban, Pause, Play, MinusCircle, PlusCircle,
  Router, Monitor, Smartphone, Shield, CheckCircle, XCircle, AlertTriangle,
  Phone, MapPin, User, IdCard, Wrench, Hash
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useRoleAccess } from "@/hooks/useRoleAccess";

// Public website plans mapping (must match exactly)
const publicPlans = {
  internet: [
    { id: "internet-100", name: "Internet 100 Mbps", price: 55, category: "Internet" },
    { id: "internet-500", name: "Internet 500 Mbps", price: 60, category: "Internet" },
    { id: "internet-940", name: "Internet 940 Mbps", price: 70, category: "Internet" },
  ],
  mobile: [
    { id: "mobile-50", name: "Mobile 50$/30 jours", price: 50, category: "Mobile", data: "50-55 GB 4G" },
    { id: "mobile-60", name: "Mobile 60$/30 jours", price: 60, category: "Mobile", data: "75-80 GB 4G" },
  ],
  tv: [
    { id: "tv-basic", name: "Internet 100 + TV Basic", price: 75, category: "TV+Internet", channels: 26 },
    { id: "tv-5choices", name: "Internet 500 + TV 5 choix", price: 80, category: "TV+Internet", channels: 32 },
    { id: "tv-10choices", name: "Internet 500 + TV 10 choix", price: 90, category: "TV+Internet", channels: 37 },
    { id: "tv-15choices", name: "Internet 500 + TV 15 choix", price: 95, category: "TV+Internet", channels: 42 },
    { id: "tv-25choices", name: "Internet 500 + TV 25 choix", price: 110, category: "TV+Internet", channels: 52 },
    { id: "giga-tv-basic", name: "GIGA + TV Basic", price: 85, category: "GIGA+TV", channels: 26 },
    { id: "giga-tv-5choices", name: "GIGA + TV 5 choix", price: 95, category: "GIGA+TV", channels: 32 },
    { id: "giga-tv-10choices", name: "GIGA + TV 10 choix", price: 105, category: "GIGA+TV", channels: 37 },
    { id: "giga-tv-15choices", name: "GIGA + TV 15 choix", price: 110, category: "GIGA+TV", channels: 42 },
    { id: "giga-tv-25choices", name: "GIGA + TV 25 choix", price: 120, category: "GIGA+TV", channels: 52 },
  ],
};

const allPlans = [...publicPlans.internet, ...publicPlans.mobile, ...publicPlans.tv];

const AdminClients = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { isAdmin, permissions } = useRoleAccess();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<"all" | "name" | "email" | "phone" | "tag">("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [newClient, setNewClient] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    phone: "",
    date_of_birth: "",
    service_address: "",
    service_city: "",
    service_postal_code: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all clients - show ALL profiles regardless of role
  const { data: clients, isLoading, refetch: refetchClients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      // Fetch all profiles without role filtering - all users are clients
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles separately to ensure no join issues
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Merge roles into profiles
      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
      
      return profilesData?.map(profile => ({
        ...profile,
        role: rolesMap.get(profile.user_id) || 'client',
        user_roles: [{ role: rolesMap.get(profile.user_id) || 'client' }]
      })) || [];
    },
    refetchOnWindowFocus: true,
    staleTime: 0, // Always refetch to ensure latest data
  });

  // Real-time subscription for instant client visibility
  useEffect(() => {
    const channel = supabase
      .channel('admin-clients-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          // Refetch clients when profiles table changes
          refetchClients();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => {
          // Refetch clients when user_roles table changes
          refetchClients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchClients]);

  // Fetch client-specific data when a client is selected
  const { data: clientOrders } = useQuery({
    queryKey: ["client-orders", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  // Fetch client payments
  const { data: clientPayments } = useQuery({
    queryKey: ["client-payments", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientBilling } = useQuery({
    queryKey: ["client-billing", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientTickets } = useQuery({
    queryKey: ["client-tickets", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientSubscriptions } = useQuery({
    queryKey: ["client-subscriptions", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientAppointments } = useQuery({
    queryKey: ["client-appointments", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .or(`client_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientDocuments } = useQuery({
    queryKey: ["client-documents", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClient?.user_id,
  });

  // Filter clients with enhanced search
  const filteredClients = clients?.filter((client: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    switch (searchFilter) {
      case "name":
        return client.full_name?.toLowerCase().includes(query) ||
               client.first_name?.toLowerCase().includes(query) ||
               client.last_name?.toLowerCase().includes(query);
      case "email":
        return client.email?.toLowerCase().includes(query);
      case "phone":
        return client.phone?.includes(query);
      case "tag":
        return client.sector_tags?.some((tag: string) => tag.toLowerCase().includes(query));
      default:
        return (
          client.full_name?.toLowerCase().includes(query) ||
          client.first_name?.toLowerCase().includes(query) ||
          client.last_name?.toLowerCase().includes(query) ||
          client.email?.toLowerCase().includes(query) ||
          client.phone?.includes(query) ||
          client.client_number?.toLowerCase().includes(query) ||
          client.sector_tags?.some((tag: string) => tag.toLowerCase().includes(query))
        );
    }
  });

  const createClientMutation = useMutation({
    mutationFn: async (client: typeof newClient) => {
      const fullName = `${client.first_name} ${client.last_name}`.trim();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: client.email,
        password: client.password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ 
            phone: client.phone,
            first_name: client.first_name,
            last_name: client.last_name,
            full_name: fullName,
            date_of_birth: client.date_of_birth || null,
            service_address: client.service_address || null,
            service_city: client.service_city || null,
            service_postal_code: client.service_postal_code || null,
            service_province: "QC",
          })
          .eq("user_id", authData.user.id);
        if (profileError) throw profileError;
      }
      return authData;
    },
    onSuccess: async () => {
      const fullName = `${newClient.first_name} ${newClient.last_name}`.trim();
      await queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      await queryClient.refetchQueries({ queryKey: ["admin-clients"] });
      logActivity("create", "client", undefined, { 
        email: newClient.email,
        full_name: fullName
      }, {
        changedField: "profile",
        reason: "Nouveau client créé par admin"
      });
      toast({ 
        title: "Client créé avec succès",
        description: `${fullName} a été ajouté au système`
      });
      setCreateDialogOpen(false);
      setNewClient({ 
        email: "", 
        password: "", 
        first_name: "", 
        last_name: "",
        phone: "",
        date_of_birth: "",
        service_address: "",
        service_city: "",
        service_postal_code: "",
      });
    },
    onError: (error: any) => {
      console.error("Client creation error:", error);
      toast({ title: "Erreur lors de la création", description: error.message, variant: "destructive" });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (client: any) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: client.full_name,
          phone: client.phone,
          internal_notes: client.internal_notes,
          sector_tags: client.sector_tags,
          employer_discount: client.employer_discount,
          balance: client.balance,
          store_credit: client.store_credit,
          account_status: client.account_status,
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      logActivity("update", "client", selectedClient?.id, { 
        full_name: selectedClient?.full_name,
        account_status: selectedClient?.account_status
      }, {
        changedField: "profile",
        reason: "Mise à jour du profil client"
      });
      toast({ title: "Client mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ clientId, field, amount, operation }: { clientId: string; field: 'balance' | 'store_credit'; amount: number; operation: 'add' | 'remove' }) => {
      const { data: current, error: fetchError } = await supabase
        .from("profiles")
        .select(field)
        .eq("id", clientId)
        .single();
      if (fetchError) throw fetchError;
      
      const currentValue = Number(current?.[field] || 0);
      const newValue = operation === 'add' ? currentValue + amount : Math.max(0, currentValue - amount);
      
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: newValue })
        .eq("id", clientId);
      if (error) throw error;
      
      return newValue;
    },
    onSuccess: (newValue, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      setSelectedClient((prev: any) => prev ? { ...prev, [variables.field]: newValue } : prev);
      logActivity("update", "client", selectedClient?.id, { 
        field: variables.field, 
        operation: variables.operation,
        amount: variables.amount
      }, {
        changedField: variables.field,
        oldValue: String(selectedClient?.[variables.field] || 0),
        newValue: String(newValue),
        reason: variables.operation === 'add' ? "Ajout de montant" : "Retrait de montant"
      });
      toast({ title: variables.operation === 'add' ? "Montant ajouté" : "Montant retiré" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la modification", variant: "destructive" });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedClient?.user_id) throw new Error("No client selected");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const documentUrl = `document://${file.name}`;
      const { error } = await supabase.from("client_documents").insert({
        user_id: selectedClient.user_id,
        uploaded_by: user.id,
        document_name: file.name,
        document_type: file.type.includes("pdf") ? "contract" : "general",
        document_url: documentUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents"] });
      logActivity("upload", "document", selectedClient?.id, { 
        document_name: "document" 
      }, {
        changedField: "documents",
        reason: "Document téléversé"
      });
      toast({ title: "Document ajouté" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'upload", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("client_documents").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents"] });
      toast({ title: "Document supprimé" });
    },
  });

  const handleViewDetails = (client: any) => {
    setSelectedClient({ ...client, sector_tags: client.sector_tags || [] });
    setDetailsDialogOpen(true);
  };

  const handleAddTag = (tag: string) => {
    if (!tag.trim()) return;
    const currentTags = selectedClient.sector_tags || [];
    if (!currentTags.includes(tag)) {
      setSelectedClient({ ...selectedClient, sector_tags: [...currentTags, tag] });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedClient({
      ...selectedClient,
      sector_tags: selectedClient.sector_tags.filter((t: string) => t !== tagToRemove),
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadDocumentMutation.mutate(file);
  };

  // Calculate renewal reminders
  const getSubscriptionStatus = (sub: any) => {
    if (!sub.next_billing_date) return null;
    const daysUntil = differenceInDays(new Date(sub.next_billing_date), new Date());
    if (daysUntil < 0) return { status: "overdue", color: "bg-red-500", text: "En retard" };
    if (daysUntil <= 7) return { status: "soon", color: "bg-amber-500", text: `${daysUntil}j` };
    if (daysUntil <= 30) return { status: "upcoming", color: "bg-cyan-500", text: `${daysUntil}j` };
    return { status: "ok", color: "bg-emerald-500", text: `${daysUntil}j` };
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    processing: "bg-cyan-500/20 text-cyan-400",
    completed: "bg-emerald-500/20 text-emerald-400",
    cancelled: "bg-red-500/20 text-red-400",
    paid: "bg-emerald-500/20 text-emerald-400",
    overdue: "bg-red-500/20 text-red-400",
    open: "bg-cyan-500/20 text-cyan-400",
    closed: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/20 text-emerald-400",
    inactive: "bg-muted text-muted-foreground",
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Gérer tous les profils clients</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-cyan-400" />
                  Créer un nouveau client
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prénom *</Label>
                    <Input
                      value={newClient.first_name}
                      onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })}
                      placeholder="Jean"
                    />
                  </div>
                  <div>
                    <Label>Nom de famille *</Label>
                    <Input
                      value={newClient.last_name}
                      onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })}
                      placeholder="Dupont"
                    />
                  </div>
                </div>
                <div>
                  <Label>Courriel *</Label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="jean@exemple.com"
                  />
                </div>
                <div>
                  <Label>Mot de passe temporaire *</Label>
                  <Input
                    type="password"
                    value={newClient.password}
                    onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Téléphone</Label>
                    <Input
                      value={newClient.phone}
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                      placeholder="514-555-1234"
                    />
                  </div>
                  <div>
                    <Label>Date de naissance</Label>
                    <Input
                      type="date"
                      value={newClient.date_of_birth}
                      onChange={(e) => setNewClient({ ...newClient, date_of_birth: e.target.value })}
                    />
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <Label className="text-muted-foreground text-xs uppercase mb-2 block">Adresse de service</Label>
                  <div className="space-y-3">
                    <div>
                      <Label>Adresse</Label>
                      <Input
                        value={newClient.service_address}
                        onChange={(e) => setNewClient({ ...newClient, service_address: e.target.value })}
                        placeholder="123 rue Exemple"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Ville</Label>
                        <Input
                          value={newClient.service_city}
                          onChange={(e) => setNewClient({ ...newClient, service_city: e.target.value })}
                          placeholder="Montréal"
                        />
                      </div>
                      <div>
                        <Label>Code postal</Label>
                        <Input
                          value={newClient.service_postal_code}
                          onChange={(e) => setNewClient({ ...newClient, service_postal_code: e.target.value })}
                          placeholder="H1A 1A1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createClientMutation.mutate(newClient)}
                  disabled={!newClient.email || !newClient.password || !newClient.first_name || !newClient.last_name}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Créer le client
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Enhanced Search bar */}
        <div className="flex gap-2 max-w-xl">
          <Select value={searchFilter} onValueChange={(v: any) => setSearchFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filtrer par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="name">Nom</SelectItem>
              <SelectItem value="email">Courriel</SelectItem>
              <SelectItem value="phone">Téléphone</SelectItem>
              <SelectItem value="tag">Tag service</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                searchFilter === "name" ? "Rechercher par nom..." :
                searchFilter === "email" ? "Rechercher par courriel..." :
                searchFilter === "phone" ? "Rechercher par téléphone..." :
                searchFilter === "tag" ? "Rechercher par tag..." :
                "Rechercher par nom, courriel, téléphone, numéro client..."
              }
              className="pl-10"
            />
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Liste des clients ({filteredClients?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredClients && filteredClients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nom</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Courriel</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Solde</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Crédit</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Inscrit le</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client: any) => (
                      <tr key={client.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-medium">
                          {client.full_name || "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">{client.email || "—"}</td>
                        <td className="py-3 px-4 text-sm">
                          <span className={Number(client.balance || 0) > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                            {Number(client.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={Number(client.store_credit || 0) > 0 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                            {Number(client.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              client.account_status === 'active' ? "bg-emerald-500/20 text-emerald-400" :
                              client.account_status === 'frozen' ? "bg-blue-500/20 text-blue-400" :
                              client.account_status === 'hold' ? "bg-amber-500/20 text-amber-400" :
                              client.account_status === 'deactivated' ? "bg-red-500/20 text-red-400" :
                              "bg-emerald-500/20 text-emerald-400"
                            }
                          >
                            {client.account_status === 'active' || !client.account_status ? 'Actif' :
                             client.account_status === 'frozen' ? 'Gelé' :
                             client.account_status === 'hold' ? 'Attente' : 'Désactivé'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                        </td>
                        <td className="py-3 px-4">
                          <Button size="sm" variant="outline" onClick={() => handleViewDetails(client)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Gérer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Aucun client trouvé" : "Aucun client pour le moment"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Management Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <span className="block">{selectedClient?.full_name || selectedClient?.email}</span>
                  {selectedClient?.client_number && (
                    <span className="text-xs text-muted-foreground font-normal">{selectedClient.client_number}</span>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <Tabs defaultValue="profile" className="mt-4">
                <TabsList className="grid grid-cols-8 w-full">
                  <TabsTrigger value="profile" className="text-xs">Profil</TabsTrigger>
                  <TabsTrigger value="identity" className="text-xs">Identité</TabsTrigger>
                  <TabsTrigger value="services" className="text-xs">Services</TabsTrigger>
                  <TabsTrigger value="equipment" className="text-xs">Équipement</TabsTrigger>
                  <TabsTrigger value="orders" className="text-xs">Commandes</TabsTrigger>
                  <TabsTrigger value="payments" className="text-xs">Paiements</TabsTrigger>
                  <TabsTrigger value="incidents" className="text-xs">Incidents</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4 mt-4">
                  {/* Account Status Banner */}
                  {selectedClient.account_status && selectedClient.account_status !== 'active' && (
                    <div className={`p-4 rounded-lg border ${
                      selectedClient.account_status === 'frozen' ? 'bg-blue-500/10 border-blue-500/30' :
                      selectedClient.account_status === 'hold' ? 'bg-amber-500/10 border-amber-500/30' :
                      'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex items-center gap-2">
                        {selectedClient.account_status === 'frozen' && <Pause className="w-5 h-5 text-blue-500" />}
                        {selectedClient.account_status === 'hold' && <Clock className="w-5 h-5 text-amber-500" />}
                        {selectedClient.account_status === 'deactivated' && <Ban className="w-5 h-5 text-red-500" />}
                        <span className={`font-medium ${
                          selectedClient.account_status === 'frozen' ? 'text-blue-500' :
                          selectedClient.account_status === 'hold' ? 'text-amber-500' : 'text-red-500'
                        }`}>
                          Compte {selectedClient.account_status === 'frozen' ? 'gelé' : 
                                  selectedClient.account_status === 'hold' ? 'en attente' : 'désactivé'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Balance & Credit Management */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Solde dû</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-2xl font-bold text-amber-500">
                          {Number(selectedClient.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant à ajouter au solde:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'balance', amount: Number(amount), operation: 'add' });
                          }
                        }}>
                          <PlusCircle className="w-4 h-4 mr-1" /> Ajouter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant à retirer du solde:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'balance', amount: Number(amount), operation: 'remove' });
                          }
                        }}>
                          <MinusCircle className="w-4 h-4 mr-1" /> Retirer
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Crédit disponible</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-2xl font-bold text-emerald-500">
                          {Number(selectedClient.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant à ajouter au crédit:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'store_credit', amount: Number(amount), operation: 'add' });
                          }
                        }}>
                          <PlusCircle className="w-4 h-4 mr-1" /> Ajouter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const amount = prompt("Montant à retirer du crédit:");
                          if (amount && !isNaN(Number(amount))) {
                            adjustBalanceMutation.mutate({ clientId: selectedClient.id, field: 'store_credit', amount: Number(amount), operation: 'remove' });
                          }
                        }}>
                          <MinusCircle className="w-4 h-4 mr-1" /> Retirer
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Account Status Management */}
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-sm font-medium mb-3 block">Statut du compte</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <Button 
                        size="sm" 
                        variant={selectedClient.account_status === 'active' || !selectedClient.account_status ? 'default' : 'outline'}
                        className={selectedClient.account_status === 'active' || !selectedClient.account_status ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                        onClick={() => setSelectedClient({ ...selectedClient, account_status: 'active' })}
                      >
                        <Play className="w-4 h-4 mr-1" /> Actif
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedClient.account_status === 'frozen' ? 'default' : 'outline'}
                        className={selectedClient.account_status === 'frozen' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                        onClick={() => setSelectedClient({ ...selectedClient, account_status: 'frozen' })}
                      >
                        <Pause className="w-4 h-4 mr-1" /> Gelé
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedClient.account_status === 'hold' ? 'default' : 'outline'}
                        className={selectedClient.account_status === 'hold' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                        onClick={() => setSelectedClient({ ...selectedClient, account_status: 'hold' })}
                      >
                        <Clock className="w-4 h-4 mr-1" /> Attente
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedClient.account_status === 'deactivated' ? 'default' : 'outline'}
                        className={selectedClient.account_status === 'deactivated' ? 'bg-red-500 hover:bg-red-600' : ''}
                        onClick={() => setSelectedClient({ ...selectedClient, account_status: 'deactivated' })}
                      >
                        <Ban className="w-4 h-4 mr-1" /> Désactivé
                      </Button>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nom complet</Label>
                      <Input
                        value={selectedClient.full_name || ""}
                        onChange={(e) => setSelectedClient({ ...selectedClient, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input
                        value={selectedClient.phone || ""}
                        onChange={(e) => setSelectedClient({ ...selectedClient, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Courriel</Label>
                      <Input value={selectedClient.email || ""} disabled className="bg-muted" />
                    </div>
                    <div>
                      <Label>Date de naissance</Label>
                      <Input 
                        type="date" 
                        value={selectedClient.date_of_birth || ""} 
                        onChange={(e) => setSelectedClient({ ...selectedClient, date_of_birth: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  {/* Address */}
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-xs text-muted-foreground uppercase mb-3 block">Adresse de service</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label>Adresse</Label>
                        <Input
                          value={selectedClient.service_address || ""}
                          onChange={(e) => setSelectedClient({ ...selectedClient, service_address: e.target.value })}
                          placeholder="123 rue Exemple"
                        />
                      </div>
                      <div>
                        <Label>Ville</Label>
                        <Input
                          value={selectedClient.service_city || ""}
                          onChange={(e) => setSelectedClient({ ...selectedClient, service_city: e.target.value })}
                          placeholder="Montréal"
                        />
                      </div>
                      <div>
                        <Label>Code postal</Label>
                        <Input
                          value={selectedClient.service_postal_code || ""}
                          onChange={(e) => setSelectedClient({ ...selectedClient, service_postal_code: e.target.value })}
                          placeholder="H1A 1A1"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Tags secteur</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedClient.sector_tags?.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                          {tag} ×
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Ajouter un tag (Entrée pour confirmer)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddTag(e.currentTarget.value);
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>Notes internes (Admin uniquement)</Label>
                    <Textarea
                      value={selectedClient.internal_notes || ""}
                      onChange={(e) => setSelectedClient({ ...selectedClient, internal_notes: e.target.value })}
                      placeholder="Notes privées..."
                      rows={4}
                    />
                  </div>
                  <Button onClick={() => updateClientMutation.mutate(selectedClient)}>
                    Enregistrer les modifications
                  </Button>
                </TabsContent>

                {/* Identity Verification Tab */}
                <TabsContent value="identity" className="space-y-4 mt-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <IdCard className="w-5 h-5 text-cyan-400" />
                        Vérification d'identité gouvernementale
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Type de pièce d'identité</Label>
                          <Select
                            value={selectedClient.id_type || ""}
                            onValueChange={(v) => setSelectedClient({ ...selectedClient, id_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="driver_license">Permis de conduire</SelectItem>
                              <SelectItem value="health_card">Carte d'assurance maladie</SelectItem>
                              <SelectItem value="passport">Passeport</SelectItem>
                              <SelectItem value="other">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Province d'émission</Label>
                          <Select
                            value={selectedClient.id_province || "QC"}
                            onValueChange={(v) => setSelectedClient({ ...selectedClient, id_province: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QC">Québec</SelectItem>
                              <SelectItem value="ON">Ontario</SelectItem>
                              <SelectItem value="BC">Colombie-Britannique</SelectItem>
                              <SelectItem value="AB">Alberta</SelectItem>
                              <SelectItem value="other">Autre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Numéro de pièce d'identité</Label>
                          <Input
                            value={selectedClient.id_number || ""}
                            onChange={(e) => setSelectedClient({ ...selectedClient, id_number: e.target.value })}
                            placeholder="Numéro..."
                          />
                        </div>
                        <div>
                          <Label>Date d'expiration</Label>
                          <Input
                            type="date"
                            value={selectedClient.id_expiration || ""}
                            onChange={(e) => setSelectedClient({ ...selectedClient, id_expiration: e.target.value })}
                          />
                        </div>
                      </div>
                      
                      {/* ID Verification Actions */}
                      <div className="p-4 bg-muted/50 rounded-lg border border-border">
                        <Label className="text-sm font-medium mb-3 block">Statut de vérification</Label>
                        <div className="flex gap-3">
                          <Button 
                            variant="outline" 
                            className="flex-1 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                            onClick={() => {
                              logActivity("approve_id", "client", selectedClient.id, {
                                id_type: selectedClient.id_type,
                                id_number: selectedClient.id_number,
                              }, {
                                changedField: "id_verification",
                                reason: "Identité approuvée par admin"
                              });
                              toast({ title: "Identité approuvée", description: "La vérification a été enregistrée." });
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approuver
                          </Button>
                          <Button 
                            variant="outline" 
                            className="flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10"
                            onClick={() => {
                              const reason = prompt("Raison du rejet:");
                              if (reason) {
                                logActivity("reject_id", "client", selectedClient.id, {
                                  id_type: selectedClient.id_type,
                                  id_number: selectedClient.id_number,
                                  rejection_reason: reason
                                }, {
                                  changedField: "id_verification",
                                  reason: `Identité rejetée: ${reason}`
                                });
                                toast({ title: "Identité rejetée", description: "Le rejet a été enregistré.", variant: "destructive" });
                              }
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Rejeter
                          </Button>
                        </div>
                      </div>
                      
                      <Button onClick={() => updateClientMutation.mutate(selectedClient)}>
                        Enregistrer les informations d'identité
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Services Tab - Shows subscribed plans matching public website */}
                <TabsContent value="services" className="space-y-4 mt-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Package className="w-5 h-5 text-cyan-400" />
                        Services souscrits
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientSubscriptions && clientSubscriptions.length > 0 ? (
                        <div className="space-y-3">
                          {clientSubscriptions.map((sub: any) => {
                            const matchedPlan = allPlans.find(p => 
                              p.name.toLowerCase().includes(sub.plan_name?.toLowerCase() || "") ||
                              sub.plan_name?.toLowerCase().includes(p.name.toLowerCase())
                            );
                            const renewalStatus = getSubscriptionStatus(sub);
                            return (
                              <div key={sub.id} className="p-4 border border-border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    {sub.plan_name?.toLowerCase().includes("mobile") ? (
                                      <Smartphone className="w-6 h-6 text-blue-500" />
                                    ) : sub.plan_name?.toLowerCase().includes("tv") ? (
                                      <Monitor className="w-6 h-6 text-purple-500" />
                                    ) : (
                                      <Router className="w-6 h-6 text-cyan-500" />
                                    )}
                                    <div>
                                      <p className="font-medium text-foreground">{sub.plan_name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/{sub.billing_cycle === "monthly" ? "mois" : "an"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {renewalStatus && (
                                      <Badge variant="outline" className={`${renewalStatus.color.replace('bg-', 'border-').replace('-500', '-500/30')} ${renewalStatus.color.replace('bg-', 'text-')}`}>
                                        <Bell className="w-3 h-3 mr-1" />
                                        {renewalStatus.text}
                                      </Badge>
                                    )}
                                    <Badge className={statusColors[sub.status] || statusColors.active}>
                                      {sub.status === "active" ? "Actif" : sub.status === "paused" ? "Pausé" : "Inactif"}
                                    </Badge>
                                  </div>
                                </div>
                                {matchedPlan && (
                                  <p className="text-xs text-muted-foreground">
                                    Catégorie: {matchedPlan.category}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucun service souscrit</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Available Plans Reference */}
                  <Card className="bg-card/50 border-border">
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">Forfaits disponibles (site public)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="font-medium text-foreground mb-2 flex items-center gap-1">
                            <Router className="w-4 h-4 text-cyan-500" /> Internet
                          </p>
                          {publicPlans.internet.map(p => (
                            <p key={p.id} className="text-muted-foreground">{p.name} - ${p.price}/mois</p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium text-foreground mb-2 flex items-center gap-1">
                            <Smartphone className="w-4 h-4 text-blue-500" /> Mobile
                          </p>
                          {publicPlans.mobile.map(p => (
                            <p key={p.id} className="text-muted-foreground">{p.name} - ${p.price}/30j</p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium text-foreground mb-2 flex items-center gap-1">
                            <Monitor className="w-4 h-4 text-purple-500" /> TV+Internet
                          </p>
                          {publicPlans.tv.slice(0, 5).map(p => (
                            <p key={p.id} className="text-muted-foreground">{p.name} - ${p.price}/mois</p>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Equipment Tab */}
                <TabsContent value="equipment" className="space-y-4 mt-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Router className="w-5 h-5 text-cyan-400" />
                        Équipement attribué
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientOrders && clientOrders.some((o: any) => o.equipment_details || o.equipment_id) ? (
                        <div className="space-y-3">
                          {clientOrders.filter((o: any) => o.equipment_details || o.equipment_id).map((order: any) => {
                            const equipmentDetails = order.equipment_details || [];
                            return (
                              <div key={order.id} className="p-4 border border-border rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm text-muted-foreground">Commande: {order.order_number}</span>
                                  <Badge className={statusColors[order.status] || statusColors.pending}>
                                    {order.status}
                                  </Badge>
                                </div>
                                
                                {/* Nivra Born Wifi Router */}
                                {(order.service_type?.toLowerCase().includes("internet") || order.service_type?.toLowerCase().includes("tv")) && (
                                  <div className="p-3 bg-muted/50 rounded-lg mb-2">
                                    <div className="flex items-center gap-3">
                                      <Router className="w-5 h-5 text-cyan-500" />
                                      <div className="flex-1">
                                        <p className="font-medium text-sm">Nivra Born Wifi Router</p>
                                        <p className="text-xs text-muted-foreground">Frais unique: 60$</p>
                                      </div>
                                      {order.serial_number && (
                                        <div className="text-right">
                                          <p className="text-xs text-muted-foreground">S/N: {order.serial_number}</p>
                                          <Badge variant="outline" className="text-xs">Garantie 1 an</Badge>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Nivra 4K Smart Terminal */}
                                {order.service_type?.toLowerCase().includes("tv") && (
                                  <div className="p-3 bg-muted/50 rounded-lg mb-2">
                                    <div className="flex items-center gap-3">
                                      <Monitor className="w-5 h-5 text-purple-500" />
                                      <div className="flex-1">
                                        <p className="font-medium text-sm">Nivra 4K Smart Terminal</p>
                                        <p className="text-xs text-muted-foreground">
                                          Frais: 50$/terminal × {order.terminal_count || 1}
                                        </p>
                                      </div>
                                      {order.equipment_id && (
                                        <div className="text-right">
                                          <p className="text-xs text-muted-foreground">ID: {order.equipment_id}</p>
                                          {order.imei_number && (
                                            <p className="text-xs text-muted-foreground">IMEI: {order.imei_number}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* SIM for Mobile */}
                                {order.service_type?.toLowerCase().includes("mobile") && order.sim_number && (
                                  <div className="p-3 bg-muted/50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                      <Smartphone className="w-5 h-5 text-blue-500" />
                                      <div className="flex-1">
                                        <p className="font-medium text-sm">Carte SIM</p>
                                        <p className="text-xs text-muted-foreground">Frais unique: 60$</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-muted-foreground">SIM: {order.sim_number}</p>
                                        {order.imei_number && (
                                          <p className="text-xs text-muted-foreground">IMEI: {order.imei_number}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Router className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucun équipement attribué</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Orders Tab */}
                <TabsContent value="orders" className="mt-4">
                  <div className="space-y-3">
                    {clientOrders && clientOrders.length > 0 ? (
                      clientOrders.map((order: any) => (
                        <div key={order.id} className="p-4 border border-border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Package className="w-8 h-8 text-cyan-400" />
                              <div>
                                <p className="font-medium text-foreground">{order.order_number || order.service_type}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                                </p>
                                {order.technician_id && (
                                  <p className="text-xs text-cyan-500">Technicien assigné</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {order.total_amount && (
                                <span className="font-medium">{Number(order.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                              )}
                              <Badge className={statusColors[order.status] || statusColors.pending}>
                                {order.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Aucune commande</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Payments Tab */}
                <TabsContent value="payments" className="space-y-4 mt-4">
                  {/* Payment History with Reference Numbers */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CreditCard className="w-5 h-5 text-cyan-400" />
                        Historique des paiements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientPayments && clientPayments.length > 0 ? (
                        <div className="space-y-3">
                          {clientPayments.map((payment: any) => (
                            <div key={payment.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                              <div className="flex items-center gap-4">
                                <DollarSign className="w-8 h-8 text-emerald-400" />
                                <div>
                                  <p className="font-medium text-foreground">
                                    {payment.payment_reference || payment.reference_number}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(payment.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {payment.payment_method} {payment.card_last_four && `•••• ${payment.card_last_four}`}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-lg text-emerald-500">
                                  {Number(payment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </span>
                                <Badge className={statusColors[payment.status] || "bg-emerald-500/20 text-emerald-400"}>
                                  {payment.status === "completed" ? "Complété" : payment.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucun paiement</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Billing/Invoices */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        Factures
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {clientBilling && clientBilling.length > 0 ? (
                        <div className="space-y-3">
                          {clientBilling.map((bill: any) => (
                            <div key={bill.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                              <div className="flex items-center gap-4">
                                <FileText className="w-6 h-6 text-cyan-400" />
                                <div>
                                  <p className="font-medium text-foreground">
                                    {bill.invoice_number || `Facture #${bill.id.slice(0, 8)}`}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(bill.created_at), "d MMM yyyy", { locale: fr })}
                                    {bill.due_date && ` • Échéance: ${format(new Date(bill.due_date), "d MMM", { locale: fr })}`}
                                  </p>
                                  {bill.payment_reference && (
                                    <p className="text-xs text-cyan-500">Réf: {bill.payment_reference}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-medium">{Number(bill.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                                <Badge className={statusColors[bill.status] || statusColors.pending}>
                                  {bill.status === "paid" ? "Payé" : bill.status === "overdue" ? "En retard" : "En attente"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-muted-foreground">Aucune facture</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Incidents Tab */}
                <TabsContent value="incidents" className="space-y-4 mt-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        Signalements et incidents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Enregistrez les incidents signalés par le client. Ces informations sont visibles uniquement aux administrateurs.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          variant="outline" 
                          className="justify-start border-red-500/30 text-red-500 hover:bg-red-500/10"
                          onClick={() => {
                            const details = prompt("Détails du signalement SIM volée/perdue:");
                            if (details) {
                              logActivity("incident_sim_lost", "client", selectedClient.id, {
                                type: "sim_stolen_lost",
                                details,
                                fee: 60
                              }, {
                                changedField: "incident",
                                reason: `SIM volée/perdue: ${details}`
                              });
                              toast({ title: "Incident enregistré", description: "SIM volée/perdue - Frais 60$ applicable pour remplacement" });
                            }
                          }}
                        >
                          <Smartphone className="w-4 h-4 mr-2" />
                          SIM volée/perdue (60$)
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          className="justify-start border-red-500/30 text-red-500 hover:bg-red-500/10"
                          onClick={() => {
                            const details = prompt("Détails du signalement téléphone perdu:");
                            if (details) {
                              logActivity("incident_phone_lost", "client", selectedClient.id, {
                                type: "phone_lost",
                                details
                              }, {
                                changedField: "incident",
                                reason: `Téléphone perdu: ${details}`
                              });
                              toast({ title: "Incident enregistré", description: "Téléphone perdu enregistré" });
                            }
                          }}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Téléphone perdu
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          className="justify-start border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                          onClick={() => {
                            const equipment = prompt("Quel équipement? (Router, Terminal, etc.)");
                            const issue = prompt("Type de problème? (Défaut, Endommagé, Volé)");
                            if (equipment && issue) {
                              logActivity("incident_equipment", "client", selectedClient.id, {
                                type: "equipment_issue",
                                equipment,
                                issue
                              }, {
                                changedField: "incident",
                                reason: `Équipement ${equipment}: ${issue}`
                              });
                              toast({ title: "Incident enregistré", description: `${equipment} - ${issue}` });
                            }
                          }}
                        >
                          <Wrench className="w-4 h-4 mr-2" />
                          Problème équipement
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          className="justify-start border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                          onClick={() => {
                            const reason = prompt("Raison de la pause:");
                            if (reason) {
                              logActivity("service_pause_request", "client", selectedClient.id, {
                                type: "service_pause",
                                reason,
                                note: "Frais mensuels continuent"
                              }, {
                                changedField: "service",
                                reason: `Pause service demandée: ${reason} (frais continuent)`
                              });
                              toast({ title: "Demande enregistrée", description: "Pause service - Les frais mensuels continuent" });
                            }
                          }}
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          Pause service (frais continuent)
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          className="justify-start col-span-2 border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/10"
                          onClick={() => {
                            const simType = prompt("Type? (SIM physique ou eSIM)");
                            if (simType) {
                              logActivity("sim_replacement_request", "client", selectedClient.id, {
                                type: "sim_replacement",
                                sim_type: simType,
                                fee: 60
                              }, {
                                changedField: "order",
                                reason: `Nouvelle ${simType} demandée - Frais 60$ à la caisse`
                              });
                              toast({ title: "Demande enregistrée", description: `Nouvelle ${simType} - 60$ sera facturé à la caisse` });
                            }
                          }}
                        >
                          <Hash className="w-4 h-4 mr-2" />
                          Nouvelle SIM/eSIM (60$ à la caisse)
                        </Button>
                      </div>

                      {/* Recent Incidents from Tickets */}
                      <div className="mt-6">
                        <Label className="text-sm font-medium mb-3 block">Tickets de support récents</Label>
                        {clientTickets && clientTickets.length > 0 ? (
                          <div className="space-y-2">
                            {clientTickets.slice(0, 5).map((ticket: any) => (
                              <div key={ticket.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Ticket className="w-5 h-5 text-cyan-400" />
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{ticket.subject}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {ticket.ticket_number} • {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                                    </p>
                                  </div>
                                </div>
                                <Badge className={statusColors[ticket.status] || statusColors.open}>
                                  {ticket.status === "open" ? "Ouvert" : ticket.status === "in_progress" ? "En cours" : "Fermé"}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Aucun ticket récent</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      />
                      <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        Téléverser un document
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {clientDocuments && clientDocuments.length > 0 ? (
                        clientDocuments.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-cyan-400" />
                              <div>
                                <p className="text-sm font-medium text-foreground">{doc.document_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(doc.created_at), "d MMM yyyy", { locale: fr })}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm("Supprimer ce document ?")) {
                                  deleteDocumentMutation.mutate(doc.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Aucun document</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminClients;
