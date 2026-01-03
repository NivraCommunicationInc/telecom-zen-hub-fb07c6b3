import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wrench,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  RefreshCw,
  Search,
  Calendar,
  Eye,
  Package,
  Truck,
  MapPin,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  History,
  Hash,
  User,
  Activity,
  FileText,
  Wifi,
  Router,
  Tv,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isFuture, isToday, differenceInHours, addHours } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";

// Status configuration
const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  active: { color: "bg-emerald-500/20 text-emerald-500", label: "Actif", icon: CheckCircle },
  inactive: { color: "bg-gray-500/20 text-gray-400", label: "Inactif", icon: XCircle },
  on_leave: { color: "bg-amber-500/20 text-amber-500", label: "En congé", icon: Clock },
};

const orderStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente" },
  confirmed: { color: "bg-blue-500/20 text-blue-500", label: "Confirmé" },
  processing: { color: "bg-indigo-500/20 text-indigo-500", label: "En cours" },
  shipped: { color: "bg-cyan-500/20 text-cyan-400", label: "Expédié" },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminé" },
  cancelled: { color: "bg-red-500/20 text-red-500", label: "Annulé" },
};

const appointmentStatusConfig: Record<string, { color: string; label: string }> = {
  scheduled: { color: "bg-cyan-500/20 text-cyan-500", label: "Planifié" },
  technician_assigned: { color: "bg-blue-500/20 text-blue-500", label: "Assigné" },
  in_progress: { color: "bg-indigo-500/20 text-indigo-500", label: "En cours" },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminé" },
  cancelled: { color: "bg-red-500/20 text-red-500", label: "Annulé" },
};

// Quebec service regions
const SERVICE_REGIONS = [
  "Montréal Centre",
  "Montréal Nord",
  "Montréal Est",
  "Montréal Ouest",
  "Laval",
  "Longueuil",
  "Rive-Sud",
  "Rive-Nord",
  "Laurentides",
  "Lanaudière",
  "Montérégie",
  "Québec Métro",
  "Gatineau",
];

const AdminTechnicians = () => {
  const { user } = useAuth();
  const { isAdmin, isEmployee, maskCardNumber } = useRoleAccess();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [appointmentDetailsOpen, setAppointmentDetailsOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [cancelAppointmentDialogOpen, setCancelAppointmentDialogOpen] = useState(false);
  
  // Selection states
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTech, setEditingTech] = useState<any>(null);
  const [selectedTech, setSelectedTech] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [transferTargetTech, setTransferTargetTech] = useState("");
  const [unassignReason, setUnassignReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    status: "active",
    specializations: [] as string[],
    service_regions: [] as string[],
    notes: "",
    access_code: "",
  });

  // Fetch technicians with performance metrics
  const { data: technicians, isLoading, refetch } = useQuery({
    queryKey: ["admin-technicians-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all orders assigned to technicians
  const { data: techOrders } = useQuery({
    queryKey: ["tech-orders-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .not("technician_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Fetch client profiles for orders
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(o => o.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone, service_address, service_city");
        
        return data.map(order => ({
          ...order,
          client: profiles?.find(p => p.user_id === order.user_id),
        }));
      }
      
      return data || [];
    },
  });

  // Fetch all appointments assigned to technicians
  const { data: techAppointments } = useQuery({
    queryKey: ["tech-appointments-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .not("technician_id", "is", null)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      
      // Fetch client profiles
      if (data && data.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, phone");
        
        return data.map(apt => ({
          ...apt,
          client: profiles?.find(p => p.user_id === apt.client_id) || 
                  { email: apt.client_email, full_name: apt.client_email?.split('@')[0] },
        }));
      }
      
      return data || [];
    },
  });

  // Fetch activity logs for technicians (Admin only)
  const { data: techActivityLogs } = useQuery({
    queryKey: ["tech-activity-logs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .or("entity_type.eq.technician,actor_role.eq.technician")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-technicians-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "technicians" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-technicians-full"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tech-orders-full"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tech-appointments-full"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter technicians
  const filteredTechnicians = technicians?.filter((tech: any) =>
    tech.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tech.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tech.access_code?.includes(searchTerm)
  );

  // Get assignments for a specific technician
  const getOrdersForTech = (techId: string) => techOrders?.filter((o: any) => o.technician_id === techId) || [];
  const getAppointmentsForTech = (techId: string) => techAppointments?.filter((a: any) => a.technician_id === techId) || [];

  // Calculate performance metrics
  const getPerformanceMetrics = (techId: string) => {
    const orders = getOrdersForTech(techId);
    const appointments = getAppointmentsForTech(techId);
    
    const completedInstallations = orders.filter((o: any) => 
      o.status === "completed" || o.status === "completed_installation"
    ).length;
    
    const cancelledOrders = orders.filter((o: any) => o.status === "cancelled").length;
    
    const completedAppointments = appointments.filter((a: any) => a.status === "completed").length;
    const cancelledAppointments = appointments.filter((a: any) => a.status === "cancelled").length;
    
    const allActivities = [...orders, ...appointments];
    const lastActivity = allActivities.length > 0 
      ? allActivities.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())[0]
      : null;
    
    return {
      totalOrders: orders.length,
      totalAppointments: appointments.length,
      completedInstallations,
      cancelledOrders,
      completedAppointments,
      cancelledAppointments,
      successRate: orders.length > 0 ? Math.round((completedInstallations / orders.length) * 100) : 0,
      lastActivity: lastActivity ? new Date(lastActivity.updated_at || lastActivity.created_at) : null,
    };
  };

  // Log activity helper
  const logActivity = async (action: string, entityType: string, entityId: string, details: any, reason?: string) => {
    if (!user?.id) return;
    
    try {
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        reason,
        actor_email: user.email,
        actor_role: isAdmin ? "admin" : "employee",
      });
    } catch (error) {
      console.error("Activity log error:", error);
    }
  };

  // Create technician mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.access_code || data.access_code.length !== 4 || !/^\d{4}$/.test(data.access_code)) {
        throw new Error("Le code d'accès doit contenir exactement 4 chiffres.");
      }

      // Check if access code is unique
      const { data: existingTech } = await supabase
        .from("technicians")
        .select("id")
        .eq("access_code", data.access_code)
        .maybeSingle();
      
      if (existingTech) {
        throw new Error("Ce code d'accès est déjà utilisé par un autre technicien.");
      }

      const { data: newTech, error } = await supabase.from("technicians").insert({
        full_name: data.full_name,
        email: data.email.toLowerCase().trim(),
        phone: data.phone,
        status: data.status,
        specializations: data.specializations,
        notes: data.notes,
        access_code: data.access_code,
      }).select().single();
      
      if (error) throw error;
      
      await logActivity("create", "technician", newTech.id, { 
        full_name: data.full_name,
        email: data.email,
      }, "Nouveau technicien créé");
      
      return newTech;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-full"] });
      toast.success("Technicien créé avec succès");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Update technician mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      if (data.access_code && (data.access_code.length !== 4 || !/^\d{4}$/.test(data.access_code))) {
        throw new Error("Le code d'accès doit contenir exactement 4 chiffres.");
      }

      // Check if new access code is unique
      if (data.access_code) {
        const { data: existingTech } = await supabase
          .from("technicians")
          .select("id")
          .eq("access_code", data.access_code)
          .neq("id", id)
          .maybeSingle();
        
        if (existingTech) {
          throw new Error("Ce code d'accès est déjà utilisé par un autre technicien.");
        }
      }

      const updateData: any = {
        full_name: data.full_name,
        email: data.email.toLowerCase().trim(),
        phone: data.phone,
        status: data.status,
        specializations: data.specializations,
        notes: data.notes,
        updated_at: new Date().toISOString(),
      };

      if (data.access_code) {
        updateData.access_code = data.access_code;
      }

      const { error } = await supabase
        .from("technicians")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
      
      await logActivity("update", "technician", id, updateData, "Profil technicien modifié");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-full"] });
      toast.success("Technicien mis à jour");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete technician mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First unassign all orders and appointments
      await supabase.from("orders").update({ technician_id: null }).eq("technician_id", id);
      await supabase.from("appointments").update({ technician_id: null, status: "scheduled" }).eq("technician_id", id);
      
      const { error } = await supabase.from("technicians").delete().eq("id", id);
      if (error) throw error;
      
      await logActivity("delete", "technician", id, {}, "Technicien supprimé");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-technicians-full"] });
      queryClient.invalidateQueries({ queryKey: ["tech-orders-full"] });
      queryClient.invalidateQueries({ queryKey: ["tech-appointments-full"] });
      toast.success("Technicien supprimé");
    },
  });

  // Unassign order mutation
  const unassignOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ technician_id: null, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
      
      await logActivity("unassign_order", "order", orderId, { 
        previous_technician: selectedTech?.full_name,
      }, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-orders-full"] });
      toast.success("Commande désassignée");
      setUnassignDialogOpen(false);
      setSelectedOrder(null);
      setUnassignReason("");
    },
  });

  // Unassign appointment mutation
  const unassignAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          technician_id: null, 
          status: "scheduled",
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq("id", appointmentId);
      if (error) throw error;
      
      await logActivity("unassign_appointment", "appointment", appointmentId, { 
        previous_technician: selectedTech?.full_name,
      }, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-appointments-full"] });
      toast.success("Rendez-vous désassigné");
      setUnassignDialogOpen(false);
      setSelectedAppointment(null);
      setUnassignReason("");
    },
  });

  // Transfer appointment mutation - also updates work_order
  const transferAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, newTechId }: { appointmentId: string; newTechId: string }) => {
      const newTech = technicians?.find((t: any) => t.id === newTechId);
      const appointment = techAppointments?.find((a: any) => a.id === appointmentId);
      
      const { error } = await supabase
        .from("appointments")
        .update({ 
          technician_id: newTechId,
          status: "technician_assigned",
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq("id", appointmentId);
      if (error) throw error;
      
      // Update or create work order for new technician
      const { createWorkOrder } = await import("@/hooks/useWorkOrderCreation");
      const workOrderResult = await createWorkOrder({
        type: "installation",
        linkedAppointmentId: appointmentId,
        linkedOrderId: (appointment as any)?.order_id || undefined,
        clientId: appointment?.client_id || undefined,
        clientName: (appointment as any)?.profiles?.full_name || undefined,
        clientEmail: appointment?.client_email || (appointment as any)?.profiles?.email || undefined,
        clientPhone: appointment?.client_phone || (appointment as any)?.profiles?.phone || undefined,
        serviceAddress: appointment?.service_address || undefined,
        serviceCity: appointment?.service_city || undefined,
        servicePostalCode: appointment?.service_postal_code || undefined,
        scheduledStart: appointment?.scheduled_at || undefined,
        assignedTechnicianId: newTechId,
        assignedBy: user?.id || undefined,
        serviceType: appointment?.service_type || undefined,
      });
      
      await logActivity("transfer_appointment", "appointment", appointmentId, { 
        from_technician: selectedTech?.full_name,
        to_technician: newTech?.full_name,
        work_order_number: workOrderResult.workOrderNumber,
      }, "Transfert de rendez-vous");

      return { workOrderNumber: workOrderResult.workOrderNumber };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-appointments-full"] });
      queryClient.invalidateQueries({ queryKey: ["technician-work-orders"] });
      toast.success("Rendez-vous transféré");
      setTransferDialogOpen(false);
      setTransferTargetTech("");
    },
  });

  // Cancel appointment mutation (24h+ rule)
  const cancelAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          status: "cancelled",
          cancellation_reason: reason,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq("id", appointmentId);
      if (error) throw error;
      
      await logActivity("cancel_appointment", "appointment", appointmentId, { 
        technician: selectedTech?.full_name,
      }, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tech-appointments-full"] });
      toast.success("Rendez-vous annulé");
      setCancelAppointmentDialogOpen(false);
      setCancelReason("");
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      status: "active",
      specializations: [],
      service_regions: [],
      notes: "",
      access_code: "",
    });
    setEditingTech(null);
  };

  const handleEdit = (tech: any) => {
    setEditingTech(tech);
    setFormData({
      full_name: tech.full_name || "",
      email: tech.email || "",
      phone: tech.phone || "",
      status: tech.status || "active",
      specializations: tech.specializations || [],
      service_regions: [],
      notes: tech.notes || "",
      access_code: "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingTech) {
      updateMutation.mutate({ id: editingTech.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleViewDetails = (tech: any) => {
    setSelectedTech(tech);
    setDetailsDialogOpen(true);
  };

  const canCancelAppointment = (apt: any) => {
    if (!apt.scheduled_at) return false;
    const hoursUntil = differenceInHours(new Date(apt.scheduled_at), new Date());
    return hoursUntil >= 24;
  };

  // Parse equipment from order
  const parseEquipment = (order: any) => {
    const equipment: any[] = [];
    const details = Array.isArray(order?.equipment_details) ? order.equipment_details : [];
    
    if (order?.serial_number) {
      equipment.push({ type: "Router", serial: order.serial_number, warranty: "24 mois" });
    }
    
    details.forEach((item: any) => {
      equipment.push({
        type: item.type || "Équipement",
        serial: item.serial || "N/A",
        imei: item.imei,
        warranty: item.warranty || "12 mois",
      });
    });
    
    if (order?.sim_number) {
      equipment.push({ type: "SIM", serial: order.sim_number, imei: order.imei_number });
    }
    
    return equipment;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Centralized notice */}
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Wrench className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Gestion centralisée</h3>
                  <p className="text-sm text-muted-foreground">
                    La gestion des techniciens est maintenant centralisée dans "Utilisateurs & Accès"
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/admin/users-access">
                  Ouvrir Utilisateurs & Accès
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Techniciens</h1>
            <p className="text-muted-foreground mt-1">Gestion avancée des techniciens (assignations, commandes)</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau technicien
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-cyan-400" />
                    {editingTech ? "Modifier le technicien" : "Créer un technicien"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Nom complet *</Label>
                      <Input
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="Jean Tremblay"
                      />
                    </div>
                    <div>
                      <Label>Courriel *</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="jean@nivra.ca"
                      />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="514-555-0000"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Statut</Label>
                      <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Actif</SelectItem>
                          <SelectItem value="inactive">Inactif</SelectItem>
                          <SelectItem value="on_leave">En congé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Code d'accès (4 chiffres) *</Label>
                      <Input
                        type="text"
                        maxLength={4}
                        value={formData.access_code}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setFormData({ ...formData, access_code: value });
                        }}
                        placeholder={editingTech ? "••••" : "1234"}
                        className="font-mono text-center text-lg tracking-widest"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-400">
                    <Shield className="w-4 h-4 inline mr-1" />
                    Le code d'accès à 4 chiffres est requis pour la connexion au portail technicien.
                    {editingTech && " Laissez vide pour conserver le code actuel."}
                  </div>
                  
                  <div>
                    <Label>Notes internes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notes internes (Admin uniquement)..."
                      rows={3}
                    />
                  </div>
                  
                  <Button
                    className="w-full"
                    variant="hero"
                    onClick={handleSubmit}
                    disabled={!formData.full_name || !formData.email || (!editingTech && formData.access_code.length !== 4)}
                  >
                    {editingTech ? "Mettre à jour" : "Créer le technicien"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Wrench className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold">{technicians?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Techniciens</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{technicians?.filter((t: any) => t.status === "active").length || 0}</p>
              <p className="text-xs text-muted-foreground">Actifs</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{techOrders?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Commandes assignées</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <Calendar className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{techAppointments?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Rendez-vous</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, courriel ou code d'accès..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Technicians Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-6">
                  <div className="h-32 bg-muted animate-pulse rounded-lg" />
                </CardContent>
              </Card>
            ))
          ) : filteredTechnicians?.length ? (
            filteredTechnicians.map((tech: any) => {
              const orders = getOrdersForTech(tech.id);
              const appointments = getAppointmentsForTech(tech.id);
              const metrics = getPerformanceMetrics(tech.id);
              const statusInfo = statusConfig[tech.status] || statusConfig.active;
              const StatusIcon = statusInfo.icon;
              
              return (
                <Card key={tech.id} className="bg-card border-border hover:border-cyan-500/30 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 flex items-center justify-center">
                          <Wrench className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {tech.full_name}
                            {isAdmin && tech.access_code && (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                #{tech.access_code}
                              </Badge>
                            )}
                          </CardTitle>
                          <Badge className={`${statusInfo.color} text-xs`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleViewDetails(tech)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(tech)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(tech.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Contact Info */}
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{tech.email}</span>
                      </div>
                      {tech.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          {tech.phone}
                        </div>
                      )}
                    </div>
                    
                    {/* Performance Metrics */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                      <div className="text-center">
                        <p className="text-lg font-bold text-emerald-500">{metrics.completedInstallations}</p>
                        <p className="text-[10px] text-muted-foreground">Complétées</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-blue-500">{metrics.totalOrders}</p>
                        <p className="text-[10px] text-muted-foreground">Commandes</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-purple-500">{metrics.totalAppointments}</p>
                        <p className="text-[10px] text-muted-foreground">RDV</p>
                      </div>
                    </div>
                    
                    {/* Assignments Preview */}
                    {(orders.length > 0 || appointments.length > 0) && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Activity className="w-3 h-3" />
                          Affectations actives
                        </div>
                        <div className="space-y-1">
                          {orders.slice(0, 2).map((o: any) => (
                            <div key={o.id} className="text-xs p-2 bg-muted/50 rounded flex justify-between items-center">
                              <span className="font-mono text-cyan-400">{o.order_number}</span>
                              <Badge className={`${orderStatusConfig[o.status]?.color || "bg-muted"} text-[10px]`}>
                                {orderStatusConfig[o.status]?.label || o.status}
                              </Badge>
                            </div>
                          ))}
                          {(orders.length > 2 || appointments.length > 0) && (
                            <p className="text-[10px] text-muted-foreground text-center">
                              +{Math.max(0, orders.length - 2) + appointments.length} autre(s)
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Last Activity */}
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {metrics.lastActivity 
                        ? `Dernière activité: ${format(metrics.lastActivity, "d MMM HH:mm", { locale: fr })}`
                        : `Créé le ${format(new Date(tech.created_at), "d MMM yyyy", { locale: fr })}`
                      }
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="col-span-full bg-card border-border">
              <CardContent className="text-center py-12">
                <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun technicien trouvé</p>
                <Button variant="hero" className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un technicien
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Technician Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-cyan-400" />
                {selectedTech?.full_name}
                {isAdmin && selectedTech?.access_code && (
                  <Badge variant="outline" className="font-mono ml-2">#{selectedTech.access_code}</Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                Détails complets, affectations et métriques de performance
              </DialogDescription>
            </DialogHeader>
            
            {selectedTech && (
              <Tabs defaultValue="orders" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="orders" className="gap-2">
                    <Package className="w-4 h-4" />
                    Commandes ({getOrdersForTech(selectedTech.id).length})
                  </TabsTrigger>
                  <TabsTrigger value="appointments" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    Rendez-vous ({getAppointmentsForTech(selectedTech.id).length})
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="gap-2">
                    <Activity className="w-4 h-4" />
                    Métriques
                  </TabsTrigger>
                  {isAdmin && (
                    <TabsTrigger value="logs" className="gap-2">
                      <History className="w-4 h-4" />
                      Historique
                    </TabsTrigger>
                  )}
                </TabsList>
                
                <ScrollArea className="flex-1 mt-4">
                  {/* Orders Tab */}
                  <TabsContent value="orders" className="m-0">
                    <div className="space-y-3">
                      {getOrdersForTech(selectedTech.id).length > 0 ? (
                        getOrdersForTech(selectedTech.id).map((order: any) => {
                          const isExpanded = expandedOrder === order.id;
                          const equipment = parseEquipment(order);
                          
                          return (
                            <Card key={order.id} className="bg-accent/30">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="font-mono text-cyan-400">
                                        {order.order_number}
                                      </Badge>
                                      <Badge className={orderStatusConfig[order.status]?.color || "bg-muted"}>
                                        {orderStatusConfig[order.status]?.label || order.status}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {order.service_type}
                                      </span>
                                    </div>
                                    
                                    {order.client && (
                                      <div className="text-sm space-y-1">
                                        <p className="flex items-center gap-2">
                                          <User className="w-4 h-4 text-muted-foreground" />
                                          {order.client.full_name || order.client_email}
                                        </p>
                                        {order.client.service_address && (
                                          <p className="flex items-center gap-2 text-muted-foreground">
                                            <MapPin className="w-4 h-4" />
                                            {order.client.service_address}, {order.client.service_city}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    
                                    {order.appointment_date && (
                                      <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {format(new Date(order.appointment_date), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                      </p>
                                    )}
                                  </div>
                                  
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                    >
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedOrder(order);
                                        setUnassignDialogOpen(true);
                                      }}
                                    >
                                      Désassigner
                                    </Button>
                                  </div>
                                </div>
                                
                                {/* Expanded Details */}
                                {isExpanded && (
                                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                                    {/* Equipment */}
                                    {equipment.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                          <Router className="w-4 h-4" />
                                          Équipement
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                          {equipment.map((eq, idx) => (
                                            <div key={idx} className="text-xs p-2 bg-muted rounded">
                                              <p className="font-medium">{eq.type}</p>
                                              <p className="text-muted-foreground">S/N: {eq.serial}</p>
                                              {eq.imei && <p className="text-muted-foreground">IMEI: {eq.imei}</p>}
                                              {eq.warranty && (
                                                <Badge variant="outline" className="text-[10px] mt-1">
                                                  Garantie: {eq.warranty}
                                                </Badge>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Tracking */}
                                    {order.tracking_number && (
                                      <div>
                                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                          <Truck className="w-4 h-4" />
                                          Suivi de livraison
                                        </h4>
                                        <p className="text-sm font-mono">{order.tracking_number}</p>
                                        {order.tracking_url && (
                                          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline">
                                            Suivre le colis →
                                          </a>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Payment Info (Admin only) */}
                                    {isAdmin && order.payment_reference && (
                                      <div>
                                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                          <CreditCard className="w-4 h-4" />
                                          Paiement
                                        </h4>
                                        <p className="text-sm font-mono">{order.payment_reference}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          Aucune commande assignée
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  {/* Appointments Tab */}
                  <TabsContent value="appointments" className="m-0">
                    <div className="space-y-3">
                      {getAppointmentsForTech(selectedTech.id).length > 0 ? (
                        getAppointmentsForTech(selectedTech.id).map((apt: any) => {
                          const isPastAppointment = isPast(new Date(apt.scheduled_at)) && !isToday(new Date(apt.scheduled_at));
                          const canCancel = canCancelAppointment(apt);
                          
                          return (
                            <Card key={apt.id} className={`bg-accent/30 ${isPastAppointment ? "opacity-60" : ""}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="font-mono text-cyan-400">
                                        {apt.appointment_number || `#${apt.id.slice(0, 8)}`}
                                      </Badge>
                                      <Badge className={appointmentStatusConfig[apt.status]?.color || "bg-muted"}>
                                        {appointmentStatusConfig[apt.status]?.label || apt.status}
                                      </Badge>
                                      {isPastAppointment && (
                                        <Badge variant="outline" className="text-muted-foreground">Passé</Badge>
                                      )}
                                    </div>
                                    
                                    <p className="font-medium">{apt.title}</p>
                                    
                                    {apt.client && (
                                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                        <User className="w-4 h-4" />
                                        {apt.client.full_name || apt.client_email}
                                      </p>
                                    )}
                                    
                                    {apt.service_address && (
                                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <MapPin className="w-4 h-4" />
                                        {apt.service_address}, {apt.service_city}
                                      </p>
                                    )}
                                    
                                    <p className="text-sm mt-2 flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-cyan-400" />
                                      {format(new Date(apt.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                    </p>
                                  </div>
                                  
                                  <div className="flex flex-col gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedAppointment(apt);
                                        setTransferDialogOpen(true);
                                      }}
                                      disabled={isPastAppointment || apt.status === "completed" || apt.status === "cancelled"}
                                    >
                                      <ArrowRightLeft className="w-4 h-4 mr-1" />
                                      Transférer
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedAppointment(apt);
                                        setUnassignDialogOpen(true);
                                      }}
                                      disabled={apt.status === "completed" || apt.status === "cancelled"}
                                    >
                                      Désassigner
                                    </Button>
                                    {canCancel && apt.status !== "cancelled" && apt.status !== "completed" && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                          setSelectedAppointment(apt);
                                          setCancelAppointmentDialogOpen(true);
                                        }}
                                      >
                                        Annuler
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          Aucun rendez-vous assigné
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  {/* Metrics Tab */}
                  <TabsContent value="metrics" className="m-0">
                    {(() => {
                      const metrics = getPerformanceMetrics(selectedTech.id);
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <Card className="bg-emerald-500/10 border-emerald-500/30">
                            <CardContent className="p-4 text-center">
                              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                              <p className="text-3xl font-bold text-emerald-500">{metrics.completedInstallations}</p>
                              <p className="text-sm text-muted-foreground">Installations complétées</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-blue-500/10 border-blue-500/30">
                            <CardContent className="p-4 text-center">
                              <Package className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                              <p className="text-3xl font-bold text-blue-500">{metrics.totalOrders}</p>
                              <p className="text-sm text-muted-foreground">Commandes totales</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-purple-500/10 border-purple-500/30">
                            <CardContent className="p-4 text-center">
                              <Calendar className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                              <p className="text-3xl font-bold text-purple-500">{metrics.totalAppointments}</p>
                              <p className="text-sm text-muted-foreground">Rendez-vous totaux</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-cyan-500/10 border-cyan-500/30">
                            <CardContent className="p-4 text-center">
                              <Activity className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                              <p className="text-3xl font-bold text-cyan-500">{metrics.successRate}%</p>
                              <p className="text-sm text-muted-foreground">Taux de réussite</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-red-500/10 border-red-500/30">
                            <CardContent className="p-4 text-center">
                              <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                              <p className="text-3xl font-bold text-red-500">{metrics.cancelledOrders + metrics.cancelledAppointments}</p>
                              <p className="text-sm text-muted-foreground">Annulations</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-muted/50 border-border">
                            <CardContent className="p-4 text-center">
                              <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm font-medium">
                                {metrics.lastActivity 
                                  ? format(metrics.lastActivity, "d MMM yyyy HH:mm", { locale: fr })
                                  : "Aucune"
                                }
                              </p>
                              <p className="text-sm text-muted-foreground">Dernière activité</p>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })()}
                  </TabsContent>
                  
                  {/* Activity Logs Tab (Admin only) */}
                  {isAdmin && (
                    <TabsContent value="logs" className="m-0">
                      <div className="space-y-2">
                        {techActivityLogs?.filter((log: any) => 
                          log.entity_id === selectedTech.id || 
                          log.details?.technician_id === selectedTech.id
                        ).slice(0, 20).map((log: any) => (
                          <Card key={log.id} className="bg-muted/30">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-sm font-medium">{log.action}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {log.actor_email} ({log.actor_role})
                                  </p>
                                  {log.reason && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Raison: {log.reason}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(log.created_at), "d MMM HH:mm", { locale: fr })}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        )) || (
                          <div className="text-center py-8 text-muted-foreground">
                            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            Aucun historique disponible
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  )}
                </ScrollArea>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Transfer Appointment Dialog */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transférer le rendez-vous</DialogTitle>
              <DialogDescription>
                Sélectionnez le technicien qui prendra en charge ce rendez-vous.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium">{selectedAppointment?.title}</p>
                <p className="text-muted-foreground">
                  {selectedAppointment?.scheduled_at && format(new Date(selectedAppointment.scheduled_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </p>
              </div>
              
              <div>
                <Label>Nouveau technicien</Label>
                <Select value={transferTargetTech} onValueChange={setTransferTargetTech}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un technicien" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians?.filter((t: any) => t.id !== selectedTech?.id && t.status === "active").map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Annuler</Button>
              <Button
                variant="hero"
                onClick={() => {
                  if (selectedAppointment && transferTargetTech) {
                    transferAppointmentMutation.mutate({
                      appointmentId: selectedAppointment.id,
                      newTechId: transferTargetTech,
                    });
                  }
                }}
                disabled={!transferTargetTech || transferAppointmentMutation.isPending}
              >
                Transférer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unassign Dialog */}
        <AlertDialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Désassigner</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir retirer cette affectation du technicien?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label>Raison (optionnel)</Label>
              <Textarea
                value={unassignReason}
                onChange={(e) => setUnassignReason(e.target.value)}
                placeholder="Raison de la désassignation..."
                rows={2}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedOrder) {
                    unassignOrderMutation.mutate({ orderId: selectedOrder.id, reason: unassignReason });
                  } else if (selectedAppointment) {
                    unassignAppointmentMutation.mutate({ appointmentId: selectedAppointment.id, reason: unassignReason });
                  }
                }}
              >
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Appointment Dialog */}
        <AlertDialog open={cancelAppointmentDialogOpen} onOpenChange={setCancelAppointmentDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler le rendez-vous</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action annulera définitivement le rendez-vous. Le client sera notifié.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label>Raison de l'annulation *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Raison de l'annulation..."
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Retour</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (selectedAppointment && cancelReason) {
                    cancelAppointmentMutation.mutate({ 
                      appointmentId: selectedAppointment.id, 
                      reason: cancelReason,
                    });
                  }
                }}
                disabled={!cancelReason}
              >
                Annuler le RDV
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminTechnicians;