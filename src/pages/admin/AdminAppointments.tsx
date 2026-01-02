import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, Phone, Check, Clock, User, Wrench, AlertTriangle, Edit, X, 
  MessageSquare, History, UserCheck, Package, RefreshCw, ChevronDown, 
  ChevronUp, Search, Filter, Plus, MapPin, Truck, Router, Tv, Wifi,
  Shield, Hash, FileText, Save, UserPlus, KeyRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, isFuture, isToday, differenceInHours, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useAuth } from "@/hooks/useAuth";

// Quebec cities for validation
const QUEBEC_CITIES = [
  "Montréal", "Laval", "Longueuil", "Brossard", "Saint-Laurent", "Verdun",
  "LaSalle", "Côte-Saint-Luc", "Dollard-des-Ormeaux", "Pointe-Claire",
  "Dorval", "Saint-Léonard", "Anjou", "Rivière-des-Prairies", "Pierrefonds",
  "Kirkland", "Beaconsfield", "Sainte-Anne-de-Bellevue", "Terrebonne", "Repentigny",
  "Blainville", "Saint-Jérôme", "Mirabel", "Boisbriand", "Sainte-Thérèse",
  "Châteauguay", "Saint-Jean-sur-Richelieu", "Granby", "Saint-Hyacinthe",
  "Drummondville", "Sherbrooke", "Trois-Rivières", "Québec", "Lévis", "Gatineau"
];

// Status configuration
const STATUS_CONFIG = {
  scheduled: { label: "Planifié", color: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30", icon: Clock },
  modified: { label: "Modifié", color: "bg-purple-500/20 text-purple-500 border-purple-500/30", icon: Edit },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-500 border-red-500/30", icon: X },
  completed: { label: "Terminé", color: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30", icon: Check },
  technician_assigned: { label: "Technicien assigné", color: "bg-blue-500/20 text-blue-500 border-blue-500/30", icon: UserCheck },
  pending_verification: { label: "Vérification en attente", color: "bg-amber-500/20 text-amber-500 border-amber-500/30", icon: AlertTriangle },
  pending_payment: { label: "Paiement en attente", color: "bg-orange-500/20 text-orange-500 border-orange-500/30", icon: Package },
  in_progress: { label: "En cours", color: "bg-indigo-500/20 text-indigo-500 border-indigo-500/30", icon: Wrench },
};

const TIME_SLOTS = [
  "08h00 - 10h00",
  "10h00 - 12h00",
  "12h00 - 14h00",
  "14h00 - 16h00",
  "16h00 - 18h00",
];

const SERVICE_TYPES = [
  { value: "internet", label: "Internet", icon: Wifi },
  { value: "tv_internet", label: "TV + Internet", icon: Tv },
  { value: "giga_tv", label: "GIGA + TV Bundle", icon: Package },
  { value: "mobile", label: "Mobile", icon: Phone },
  { value: "streaming", label: "Streaming", icon: Tv },
  { value: "accessories", label: "Accessoires", icon: Package },
  { value: "security", label: "Sécurité", icon: Shield },
];

const INSTALLATION_METHODS = [
  { value: "auto", label: "Auto-installation" },
  { value: "technician", label: "Installation technicien" },
];

const AdminAppointments = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isEmployee, isTechnician, permissions } = useRoleAccess();
  
  // State
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [assignTechDialogOpen, setAssignTechDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [createTechDialogOpen, setCreateTechDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);
  
  // Form state
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [internalNote, setInternalNote] = useState("");

  // New appointment form
  const [appointmentForm, setAppointmentForm] = useState({
    title: "",
    client_id: "",
    client_email: "",
    client_phone: "",
    service_address: "",
    service_city: "",
    service_postal_code: "",
    service_type: "",
    installation_method: "auto",
    scheduled_date: "",
    scheduled_time: "",
    order_id: "",
    technician_id: "",
    delivery_fee: 30,
    installation_fee: 0,
    description: "",
  });

  // New client form
  const [clientForm, setClientForm] = useState({
    email: "",
    full_name: "",
    phone: "",
    service_address: "",
    service_city: "",
    service_postal_code: "",
  });

  // New technician form
  const [techForm, setTechForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    specializations: [] as string[],
    access_code: "",
  });

  // Fetch appointments with profiles and technicians
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["admin-appointments-full"],
    queryFn: async () => {
      const { data: appointmentsData, error } = await supabase
        .from("appointments")
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      
      if (appointmentsData && appointmentsData.length > 0) {
        const clientIds = [...new Set(appointmentsData.filter(a => a.client_id).map(a => a.client_id))];
        
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone, client_number, service_address, service_city, service_postal_code");
        
        // Fetch technicians
        const { data: techsData } = await supabase
          .from("technicians")
          .select("id, full_name, phone, email, specializations");
        
        // Fetch linked orders
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, order_number, service_type, status, user_id, technician_id, appointment_date");
        
        return appointmentsData.map((apt: any) => ({
          ...apt,
          profiles: profilesData?.find(p => p.user_id === apt.client_id) || 
                   (apt.client_email ? { email: apt.client_email, full_name: apt.client_email.split('@')[0] } : null),
          technician: techsData?.find(t => t.id === apt.technician_id),
          linkedOrder: apt.order_id ? ordersData?.find(o => o.id === apt.order_id) :
                       ordersData?.find(o => o.user_id === apt.client_id && 
                         (o.appointment_date === apt.scheduled_at || o.service_type?.toLowerCase().includes('internet') || o.service_type?.toLowerCase().includes('tv')))
        }));
      }
      
      return appointmentsData || [];
    },
  });

  // Fetch all profiles for selection
  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone, client_number, service_address, service_city")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch technicians
  const { data: technicians } = useQuery({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch orders for linking
  const { data: orders } = useQuery({
    queryKey: ["orders-for-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, service_type, user_id, client_email")
        .in("status", ["pending", "confirmed", "processing"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-appointments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Create appointment mutation with enhanced error handling
  const createAppointmentMutation = useMutation({
    mutationFn: async (formData: typeof appointmentForm) => {
      try {
        // Validate required fields with fallbacks
        if (!formData.scheduled_time || !formData.scheduled_date || !formData.service_type) {
          throw new Error("Champs requis manquants");
        }

        // Safely parse time slot
        const timeSlotParts = (formData.scheduled_time || "08h00 - 10h00").split(' - ');
        const startTime = timeSlotParts[0] || "08h00";
        const hoursPart = startTime.replace('h', ':').split(':')[0] || "08";
        const hours = parseInt(hoursPart, 10) || 8;
        
        const scheduledDate = new Date(formData.scheduled_date);
        if (isNaN(scheduledDate.getTime())) {
          throw new Error("Date invalide");
        }
        scheduledDate.setHours(hours, 0, 0, 0);

        // Prepare payload with safe fallbacks
        const payload = {
          title: formData.title || `Installation ${SERVICE_TYPES.find(s => s.value === formData.service_type)?.label || 'Service'}`,
          client_id: formData.client_id || null,
          client_email: formData.client_email || "",
          client_phone: formData.client_phone || "",
          service_address: formData.service_address || "",
          service_city: formData.service_city || "",
          service_postal_code: formData.service_postal_code || "",
          service_type: formData.service_type || "internet",
          installation_method: formData.installation_method || "auto",
          scheduled_at: scheduledDate.toISOString(),
          order_id: formData.order_id || null,
          technician_id: formData.technician_id || null,
          delivery_fee: formData.installation_method === 'auto' ? (formData.delivery_fee ?? 30) : 0,
          installation_fee: formData.installation_method === 'technician' ? (formData.installation_fee ?? 50) : 0,
          description: formData.description || "",
          status: formData.technician_id ? "technician_assigned" : "scheduled",
          created_by: user?.id || null,
        };

        const { data, error } = await supabase
          .from("appointments")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        if (!data) throw new Error("Aucune donnée retournée");

        // Log activity (non-blocking)
        if (user?.id) {
          try {
            await supabase.from("activity_logs").insert({
              user_id: user.id,
              entity_type: "appointment",
              entity_id: data.id,
              action: "create",
              new_value: JSON.stringify(data),
              reason: "Nouveau rendez-vous créé manuellement",
              actor_email: user.email || "",
              actor_role: isAdmin ? "admin" : "employee",
            });
          } catch (logError) {
            console.error("Activity log error:", logError);
          }
        }

        return data;
      } catch (err: any) {
        console.error("Appointment creation error:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      // Invalidate all appointment queries for instant visibility
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["technician-appointments"] });
      toast.success(`Rendez-vous créé: ${data?.appointment_number || 'ID généré'}`);
      setCreateDialogOpen(false);
      resetAppointmentForm();
    },
    onError: (error: any) => {
      console.error("Mutation error:", error);
      toast.error("Erreur lors de la création: " + (error?.message || "Erreur inconnue"));
    },
  });

  // Create client mutation - uses server-side edge function for security
  const createClientMutation = useMutation({
    mutationFn: async (formData: typeof clientForm) => {
      // Use server-side edge function for secure user creation
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          service_address: formData.service_address,
          service_city: formData.service_city,
          service_postal_code: formData.service_postal_code,
          service_province: "QC",
          generate_password: true, // Let server generate secure password
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      toast.success("Profil client créé avec succès");
      setCreateClientDialogOpen(false);
      setClientForm({ email: "", full_name: "", phone: "", service_address: "", service_city: "", service_postal_code: "" });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Create technician mutation
  const createTechMutation = useMutation({
    mutationFn: async (formData: typeof techForm) => {
      // Generate 4-digit access code if not provided
      const accessCode = formData.access_code || String(Math.floor(1000 + Math.random() * 9000));

      const { data, error } = await supabase
        .from("technicians")
        .insert({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          specializations: formData.specializations,
          access_code: accessCode,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      if (user?.id) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          entity_type: "technician",
          entity_id: data.id,
          action: "create",
          new_value: JSON.stringify({ ...data, access_code: "****" }),
          reason: "Nouveau technicien créé",
          actor_email: user.email,
          actor_role: "admin",
        });
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["technicians-list"] });
      toast.success(`Technicien créé: ${data.full_name} (Code: ${data.access_code})`);
      setCreateTechDialogOpen(false);
      setTechForm({ full_name: "", email: "", phone: "", specializations: [], access_code: "" });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, updates, reason }: { id: string; updates: any; reason?: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ ...updates, updated_by: user?.id })
        .eq("id", id);
      if (error) throw error;

      // Log activity
      if (user?.id && reason) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          entity_type: "appointment",
          entity_id: id,
          action: "update",
          changed_field: Object.keys(updates).join(", "),
          old_value: JSON.stringify(selectedAppointment),
          new_value: JSON.stringify(updates),
          reason: reason,
          actor_email: user.email,
          actor_role: isAdmin ? "admin" : isEmployee ? "employee" : "technician",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["technician-appointments"] });
      toast.success("Rendez-vous mis à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, newScheduledAt }: { id: string; newScheduledAt: Date }) => {
      const oldDate = selectedAppointment?.scheduled_at;
      
      const { error } = await supabase
        .from("appointments")
        .update({ 
          scheduled_at: newScheduledAt.toISOString(),
          status: "modified",
          updated_by: user?.id,
        })
        .eq("id", id);
      if (error) throw error;

      // Log activity
      if (user?.id) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          entity_type: "appointment",
          entity_id: id,
          action: "reschedule",
          changed_field: "scheduled_at",
          old_value: oldDate,
          new_value: newScheduledAt.toISOString(),
          reason: "Date modifiée par l'administrateur",
          actor_email: user.email,
          actor_role: isAdmin ? "admin" : "employee",
        });
      }

      // Send notification
      if (selectedAppointment?.client_email || selectedAppointment?.profiles?.email) {
        try {
          await supabase.functions.invoke("send-appointment-notification", {
            body: {
              email: selectedAppointment.client_email || selectedAppointment.profiles?.email,
              name: selectedAppointment.profiles?.full_name || "Client",
              appointmentTitle: selectedAppointment.title,
              appointmentDate: newScheduledAt.toISOString(),
              status: "rescheduled",
            },
          });
        } catch (e) {
          console.error("Notification error:", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["technician-appointments"] });
      toast.success("Rendez-vous reprogrammé");
      setRescheduleDialogOpen(false);
      setNewDate("");
      setNewTime("");
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          status: "cancelled",
          cancellation_reason: reason,
          updated_by: user?.id,
        })
        .eq("id", id);
      if (error) throw error;

      // Log activity
      if (user?.id) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          entity_type: "appointment",
          entity_id: id,
          action: "cancel",
          changed_field: "status",
          old_value: selectedAppointment?.status,
          new_value: "cancelled",
          reason: reason,
          actor_email: user.email,
          actor_role: isAdmin ? "admin" : "employee",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["technician-appointments"] });
      toast.success("Rendez-vous annulé");
      setCancelDialogOpen(false);
      setCancelReason("");
    },
  });

  // Assign technician mutation - now creates work_order for technician portal
  const assignTechMutation = useMutation({
    mutationFn: async ({ appointmentId, technicianId, orderId }: { appointmentId: string; technicianId: string; orderId?: string }) => {
      const appointment = appointments?.find(a => a.id === appointmentId);
      const tech = technicians?.find(t => t.id === technicianId);
      
      // Update appointment
      const { error: aptError } = await supabase
        .from("appointments")
        .update({ 
          status: "technician_assigned",
          technician_id: technicianId,
          updated_by: user?.id,
        })
        .eq("id", appointmentId);
      if (aptError) throw aptError;

      // Update order if linked
      if (orderId) {
        const { error: orderError } = await supabase
          .from("orders")
          .update({ technician_id: technicianId })
          .eq("id", orderId);
        if (orderError) throw orderError;
      }

      // Create work order for technician portal (single source of truth)
      const { createWorkOrder } = await import("@/hooks/useWorkOrderCreation");
      const workOrderResult = await createWorkOrder({
        type: "installation",
        linkedAppointmentId: appointmentId,
        linkedOrderId: orderId || appointment?.order_id || undefined,
        clientId: appointment?.client_id || undefined,
        clientName: appointment?.profiles?.full_name || undefined,
        clientEmail: appointment?.client_email || appointment?.profiles?.email || undefined,
        clientPhone: appointment?.client_phone || appointment?.profiles?.phone || undefined,
        serviceAddress: appointment?.service_address || appointment?.profiles?.service_address || undefined,
        serviceCity: appointment?.service_city || appointment?.profiles?.service_city || undefined,
        servicePostalCode: appointment?.service_postal_code || appointment?.profiles?.service_postal_code || undefined,
        scheduledStart: appointment?.scheduled_at || undefined,
        assignedTechnicianId: technicianId,
        assignedBy: user?.id || undefined,
        serviceType: appointment?.service_type || undefined,
        notes: appointment?.description || undefined,
        equipmentDetails: Array.isArray(appointment?.equipment_details) ? appointment.equipment_details : [],
      });

      if (!workOrderResult.success) {
        console.error("Failed to create work order:", workOrderResult.error);
      }

      // Log activity
      if (user?.id) {
        await supabase.from("activity_logs").insert({
          user_id: user.id,
          entity_type: "appointment",
          entity_id: appointmentId,
          action: "assign_technician",
          changed_field: "technician_id",
          new_value: tech?.full_name || technicianId,
          reason: "Technicien assigné",
          actor_email: user.email,
          actor_role: "admin",
          details: { work_order_number: workOrderResult.workOrderNumber },
        });
      }

      return { technicianName: tech?.full_name, workOrderNumber: workOrderResult.workOrderNumber };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["technician-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["technician-work-orders"] });
      toast.success(`Technicien assigné${data?.workOrderNumber ? ` - ${data.workOrderNumber}` : ""}`);
      setAssignTechDialogOpen(false);
      setSelectedTechnician("");
    },
  });

  // Add internal note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm");
      const currentNotes = selectedAppointment?.internal_notes || "";
      const newNotes = `${currentNotes}\n[${timestamp} - ${user?.email}] ${note}`.trim();
      
      const { error } = await supabase
        .from("appointments")
        .update({ 
          internal_notes: newNotes,
          updated_by: user?.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      toast.success("Note ajoutée");
      setNotesDialogOpen(false);
      setInternalNote("");
    },
  });

  const resetAppointmentForm = () => {
    setAppointmentForm({
      title: "",
      client_id: "",
      client_email: "",
      client_phone: "",
      service_address: "",
      service_city: "",
      service_postal_code: "",
      service_type: "",
      installation_method: "auto",
      scheduled_date: "",
      scheduled_time: "",
      order_id: "",
      technician_id: "",
      delivery_fee: 30,
      installation_fee: 0,
      description: "",
    });
  };

  // Auto-fill client info when selected
  const handleClientSelect = (clientId: string) => {
    const client = allProfiles?.find(p => p.user_id === clientId);
    if (client) {
      setAppointmentForm(prev => ({
        ...prev,
        client_id: clientId,
        client_email: client.email || "",
        client_phone: client.phone || "",
        service_address: client.service_address || "",
        service_city: client.service_city || "",
      }));
    }
  };

  // Filter appointments
  const filteredAppointments = appointments?.filter((apt: any) => {
    const matchesSearch = !searchQuery || 
      apt.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.appointment_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.profiles?.client_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
    
    // Technicians only see their assigned appointments
    if (isTechnician) {
      const techRecord = technicians?.find(t => t.user_id === user?.id);
      if (techRecord && apt.technician_id !== techRecord.id) {
        return false;
      }
    }
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Group appointments
  const upcomingAppointments = filteredAppointments.filter((apt: any) => 
    (isFuture(new Date(apt.scheduled_at)) || isToday(new Date(apt.scheduled_at))) && apt.status !== "cancelled"
  );
  const pastAppointments = filteredAppointments.filter((apt: any) => 
    isPast(new Date(apt.scheduled_at)) && !isToday(new Date(apt.scheduled_at))
  );
  const cancelledAppointments = filteredAppointments.filter((apt: any) => apt.status === "cancelled");

  // Stats
  const stats = {
    total: appointments?.length || 0,
    upcoming: upcomingAppointments.length,
    completed: appointments?.filter((a: any) => a.status === "completed").length || 0,
    pending: appointments?.filter((a: any) => ["scheduled", "pending_verification", "pending_payment"].includes(a.status)).length || 0,
    withTechnician: appointments?.filter((a: any) => a.status === "technician_assigned").length || 0,
  };

  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 30; i++) {
      const date = addDays(today, i);
      dates.push({
        value: format(date, "yyyy-MM-dd"),
        label: format(date, "EEEE d MMMM", { locale: fr }),
      });
    }
    return dates;
  };

  const handleRescheduleSubmit = () => {
    if (!newDate || !newTime || !selectedAppointment) {
      toast.error("Veuillez sélectionner une date et une heure");
      return;
    }
    const [startTime] = newTime.split(' - ');
    const [hours] = startTime.replace('h', ':').split(':');
    const scheduledDate = new Date(newDate);
    scheduledDate.setHours(parseInt(hours), 0, 0, 0);
    rescheduleMutation.mutate({ id: selectedAppointment.id, newScheduledAt: scheduledDate });
  };

  const canManageAppointment = (apt: any) => {
    if (isAdmin) return true;
    if (isEmployee) return apt.status !== "completed";
    if (isTechnician) return apt.status === "technician_assigned" || apt.status === "in_progress";
    return false;
  };

  // Check if client can modify (24h rule)
  const canClientModify = (apt: any) => {
    const hoursUntil = differenceInHours(new Date(apt.scheduled_at), new Date());
    return hoursUntil >= 24;
  };

  const renderAppointmentCard = (apt: any, showActions: boolean = true) => {
    const status = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.scheduled;
    const StatusIcon = status.icon;
    const isExpanded = expandedAppointment === apt.id;
    const hoursUntil = differenceInHours(new Date(apt.scheduled_at), new Date());

    return (
      <div key={apt.id} className="border border-border rounded-lg overflow-hidden bg-card hover:border-cyan-500/50 transition-colors">
        {/* Main Row */}
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Date Box */}
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex flex-col items-center justify-center flex-shrink-0 border border-cyan-500/30">
              <span className="text-lg font-bold text-cyan-500">{format(new Date(apt.scheduled_at), "d")}</span>
              <span className="text-[10px] text-cyan-400 uppercase">{format(new Date(apt.scheduled_at), "MMM", { locale: fr })}</span>
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/30">
                  {apt.appointment_number || `#${apt.id.slice(0, 8).toUpperCase()}`}
                </Badge>
                <Badge className={`${status.color} text-[10px] px-2 py-0.5`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
              <h3 className="font-medium text-foreground truncate mt-1">{apt.title}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {apt.profiles?.full_name || apt.client_email || "Client"} 
                {apt.profiles?.client_number && <span className="text-cyan-500 ml-1">#{apt.profiles.client_number}</span>}
              </p>
              <p className="text-xs text-cyan-400">
                {format(new Date(apt.scheduled_at), "EEEE 'à' HH:mm", { locale: fr })}
                {hoursUntil > 0 && hoursUntil < 48 && (
                  <span className="text-amber-500 ml-2">({hoursUntil}h)</span>
                )}
              </p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {apt.linkedOrder?.order_number && (
              <Badge variant="outline" className="text-[10px] hidden sm:flex">
                {apt.linkedOrder.order_number}
              </Badge>
            )}
            
            {apt.technician && (
              <Badge variant="outline" className="text-[10px] hidden md:flex bg-blue-500/10 text-blue-400 border-blue-500/30">
                <Wrench className="w-3 h-3 mr-1" />
                {apt.technician.full_name}
              </Badge>
            )}
            
            <Button size="sm" variant="ghost" onClick={() => setExpandedAppointment(isExpanded ? null : apt.id)}>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {apt.profiles?.phone && (
              <Button size="sm" variant="outline" onClick={() => window.open(`tel:${apt.profiles.phone}`)}>
                <Phone className="w-4 h-4" />
              </Button>
            )}
            
            {showActions && canManageAppointment(apt) && apt.status !== "completed" && apt.status !== "cancelled" && (
              <>
                {(isAdmin || isEmployee) && (
                  <Button size="sm" variant="outline" onClick={() => { setSelectedAppointment(apt); setRescheduleDialogOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
                {isAdmin && !apt.technician_id && (
                  <Button size="sm" variant="outline" className="text-blue-500" onClick={() => { setSelectedAppointment(apt); setAssignTechDialogOpen(true); }}>
                    <UserCheck className="w-4 h-4" />
                  </Button>
                )}
                {(isAdmin || isTechnician) && apt.status === "technician_assigned" && (
                  <Button size="sm" variant="outline" className="text-indigo-500" onClick={() => updateAppointmentMutation.mutate({ id: apt.id, updates: { status: "in_progress" }, reason: "Installation en cours" })}>
                    <Wrench className="w-4 h-4" />
                  </Button>
                )}
                {(isAdmin || isTechnician) && (apt.status === "technician_assigned" || apt.status === "in_progress") && (
                  <Button size="sm" variant="hero" onClick={() => updateAppointmentMutation.mutate({ id: apt.id, updates: { status: "completed" }, reason: "Installation terminée" })}>
                    <Check className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-border bg-muted/30 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Client Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <User className="w-3 h-3" /> Client
                </h4>
                <p className="text-sm">{apt.profiles?.full_name || "N/A"}</p>
                <p className="text-xs text-muted-foreground">{apt.profiles?.email || apt.client_email}</p>
                <p className="text-xs text-muted-foreground">{apt.client_phone || apt.profiles?.phone || "—"}</p>
                {(apt.service_address || apt.profiles?.service_address) && (
                  <p className="text-xs text-cyan-500 flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {apt.service_address || apt.profiles?.service_address}, {apt.service_city || apt.profiles?.service_city}
                  </p>
                )}
              </div>
              
              {/* Appointment Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Rendez-vous
                </h4>
                <p className="text-sm font-medium">{apt.appointment_number}</p>
                <p className="text-xs text-muted-foreground">Créé: {format(new Date(apt.created_at), "dd/MM/yyyy HH:mm")}</p>
                {apt.service_type && (
                  <p className="text-xs">Service: <span className="text-cyan-400">{SERVICE_TYPES.find(s => s.value === apt.service_type)?.label || apt.service_type}</span></p>
                )}
                {apt.installation_method && (
                  <p className="text-xs">Méthode: <span className="text-purple-400">{INSTALLATION_METHODS.find(m => m.value === apt.installation_method)?.label}</span></p>
                )}
                {apt.linkedOrder && (
                  <p className="text-xs text-cyan-500">Commande: {apt.linkedOrder.order_number}</p>
                )}
              </div>

              {/* Technician & Fees - Admin Only */}
              {(isAdmin || isEmployee) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Technique & Frais
                  </h4>
                  {apt.technician ? (
                    <div className="text-sm">
                      <p className="font-medium text-blue-400">{apt.technician.full_name}</p>
                      <p className="text-xs text-muted-foreground">{apt.technician.email}</p>
                      {apt.technician.phone && <p className="text-xs text-muted-foreground">{apt.technician.phone}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun technicien</p>
                  )}
                  <div className="text-xs space-y-1 pt-2">
                    {apt.delivery_fee > 0 && <p>Livraison: <span className="text-emerald-400">${apt.delivery_fee}</span></p>}
                    {apt.installation_fee > 0 && <p>Installation: <span className="text-emerald-400">${apt.installation_fee}</span></p>}
                  </div>
                </div>
              )}
            </div>

            {/* Equipment Details - Admin Only */}
            {(isAdmin || isEmployee) && apt.equipment_details && Array.isArray(apt.equipment_details) && apt.equipment_details.length > 0 && (
              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Équipement (Admin privé)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {apt.equipment_details.map((eq: any, idx: number) => (
                    <div key={idx} className="bg-background p-2 rounded text-xs">
                      <p className="font-medium">{eq.name}</p>
                      {eq.serial_number && <p className="text-muted-foreground">S/N: {eq.serial_number}</p>}
                      {eq.tracking_number && <p className="text-cyan-400">Tracking: {eq.tracking_number}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="border-t border-border pt-3">
              <div className="flex flex-wrap gap-2">
                {(isAdmin || isEmployee) && (
                  <Button size="sm" variant="outline" onClick={() => { setSelectedAppointment(apt); setNotesDialogOpen(true); }}>
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Note interne
                  </Button>
                )}
                {(isAdmin || isEmployee) && apt.status !== "cancelled" && apt.status !== "completed" && (
                  <Button size="sm" variant="outline" className="text-red-500" onClick={() => { setSelectedAppointment(apt); setCancelDialogOpen(true); }}>
                    <X className="w-3 h-3 mr-1" />
                    Annuler
                  </Button>
                )}
              </div>
            </div>

            {/* Internal Notes - Admin Only */}
            {(isAdmin || isEmployee) && apt.internal_notes && (
              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Notes internes (Admin privé)
                </h4>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-background p-2 rounded">{apt.internal_notes}</pre>
              </div>
            )}

            {/* Description */}
            {apt.description && (
              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Description</h4>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-background p-2 rounded">{apt.description}</pre>
              </div>
            )}

            {/* Cancellation reason */}
            {apt.cancellation_reason && (
              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-bold text-red-400 uppercase mb-2">Raison d'annulation</h4>
                <p className="text-xs text-muted-foreground bg-red-500/10 p-2 rounded">{apt.cancellation_reason}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Rendez-vous</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? "Gestion complète des rendez-vous" : 
               isEmployee ? "Gestion des rendez-vous clients" : 
               "Vos rendez-vous assignés"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] })}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            
            {(isAdmin || isEmployee) && (
              <>
                <Button variant="outline" size="sm" onClick={() => setCreateClientDialogOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Nouveau client
                </Button>
                
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setCreateTechDialogOpen(true)}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Nouveau technicien
                  </Button>
                )}
                
                <Button variant="hero" size="sm" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau rendez-vous
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">À venir</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Terminés</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.withTechnician}</p>
                <p className="text-xs text-muted-foreground">Avec technicien</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par nom, email, numéro RDV..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Tabs */}
        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upcoming" className="gap-2">
              <Clock className="w-4 h-4" />
              À venir ({upcomingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="gap-2">
              <History className="w-4 h-4" />
              Passés ({pastAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="gap-2">
              <X className="w-4 h-4" />
              Annulés ({cancelledAppointments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-cyan-400" />
                  Rendez-vous à venir
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
                  </div>
                ) : upcomingAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingAppointments.map((apt: any) => renderAppointmentCard(apt))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun rendez-vous à venir</p>
                    {(isAdmin || isEmployee) && (
                      <Button variant="hero" className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Créer un rendez-vous
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="past">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-muted-foreground" />
                  Rendez-vous passés
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pastAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {pastAppointments.map((apt: any) => renderAppointmentCard(apt, false))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun historique</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cancelled">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <X className="w-5 h-5 text-red-500" />
                  Rendez-vous annulés
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cancelledAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {cancelledAppointments.map((apt: any) => renderAppointmentCard(apt, false))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <X className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucune annulation</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Appointment Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                Nouveau rendez-vous
              </DialogTitle>
              <DialogDescription>
                Créer manuellement un rendez-vous d'installation
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Client Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <User className="w-4 h-4" /> Client
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Client existant</Label>
                    <Select 
                      value={appointmentForm.client_id} 
                      onValueChange={handleClientSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {allProfiles?.map(p => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.full_name || p.email} {p.client_number && `(${p.client_number})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={appointmentForm.client_email}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, client_email: e.target.value }))}
                      placeholder="client@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input 
                      value={appointmentForm.client_phone}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, client_phone: e.target.value }))}
                      placeholder="514-XXX-XXXX"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Service Address */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Adresse de service
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Adresse</Label>
                    <Input 
                      value={appointmentForm.service_address}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, service_address: e.target.value }))}
                      placeholder="123 rue Exemple"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ville (Québec)</Label>
                    <Select 
                      value={appointmentForm.service_city}
                      onValueChange={(v) => setAppointmentForm(prev => ({ ...prev, service_city: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une ville" />
                      </SelectTrigger>
                      <SelectContent>
                        {QUEBEC_CITIES.map(city => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Code postal</Label>
                    <Input 
                      value={appointmentForm.service_postal_code}
                      onChange={(e) => setAppointmentForm(prev => ({ ...prev, service_postal_code: e.target.value.toUpperCase() }))}
                      placeholder="H1A 1A1"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Service Type & Method */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Wifi className="w-4 h-4" /> Service
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type de service</Label>
                    <Select 
                      value={appointmentForm.service_type}
                      onValueChange={(v) => setAppointmentForm(prev => ({ ...prev, service_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un service" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Méthode d'installation</Label>
                    <Select 
                      value={appointmentForm.installation_method}
                      onValueChange={(v) => setAppointmentForm(prev => ({ 
                        ...prev, 
                        installation_method: v,
                        delivery_fee: v === 'auto' ? 30 : 0,
                        installation_fee: v === 'technician' ? 50 : 0,
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INSTALLATION_METHODS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lier à une commande (optionnel)</Label>
                    <Select 
                      value={appointmentForm.order_id || "__none__"}
                      onValueChange={(v) => setAppointmentForm(prev => ({ ...prev, order_id: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une commande" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {orders?.map(o => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.order_number} — {o.service_type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Technicien (optionnel)</Label>
                    <Select 
                      value={appointmentForm.technician_id || "__none__"}
                      onValueChange={(v) => setAppointmentForm(prev => ({ ...prev, technician_id: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Assigner un technicien" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Non assigné</SelectItem>
                        {technicians?.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.full_name} — {t.specializations?.join(", ") || "Général"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Schedule */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Planification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Select 
                      value={appointmentForm.scheduled_date}
                      onValueChange={(v) => setAppointmentForm(prev => ({ ...prev, scheduled_date: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une date" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableDates().map(d => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Créneau horaire</Label>
                    <Select 
                      value={appointmentForm.scheduled_time}
                      onValueChange={(v) => setAppointmentForm(prev => ({ ...prev, scheduled_time: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un créneau" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Fees Summary */}
              <div className="bg-accent/50 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Frais applicables</h4>
                <div className="text-sm space-y-1">
                  {appointmentForm.installation_method === 'auto' && (
                    <p>Frais de livraison: <span className="text-emerald-400">${appointmentForm.delivery_fee}</span></p>
                  )}
                  {appointmentForm.installation_method === 'technician' && (
                    <p>Frais d'installation: <span className="text-emerald-400">${appointmentForm.installation_fee}</span></p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes / Description</Label>
                <Textarea 
                  value={appointmentForm.description}
                  onChange={(e) => setAppointmentForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Notes supplémentaires..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetAppointmentForm(); }}>
                Annuler
              </Button>
              <Button 
                variant="hero" 
                onClick={async () => {
                  try {
                    if (!appointmentForm.scheduled_date || !appointmentForm.scheduled_time || !appointmentForm.service_type) {
                      toast.error("Veuillez remplir tous les champs requis");
                      return;
                    }
                    createAppointmentMutation.mutate(appointmentForm);
                  } catch (err: any) {
                    console.error("Submit error:", err);
                    toast.error("Erreur lors de la soumission");
                  }
                }}
                disabled={!appointmentForm.scheduled_date || !appointmentForm.scheduled_time || !appointmentForm.service_type || createAppointmentMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {createAppointmentMutation.isPending ? "Création..." : "Créer le rendez-vous"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Client Dialog */}
        <Dialog open={createClientDialogOpen} onOpenChange={setCreateClientDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                Nouveau profil client
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input 
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="client@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input 
                  value={clientForm.full_name}
                  onChange={(e) => setClientForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input 
                  value={clientForm.phone}
                  onChange={(e) => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="514-XXX-XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Adresse de service</Label>
                <Input 
                  value={clientForm.service_address}
                  onChange={(e) => setClientForm(prev => ({ ...prev, service_address: e.target.value }))}
                  placeholder="123 rue Exemple"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Select 
                    value={clientForm.service_city}
                    onValueChange={(v) => setClientForm(prev => ({ ...prev, service_city: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ville" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUEBEC_CITIES.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input 
                    value={clientForm.service_postal_code}
                    onChange={(e) => setClientForm(prev => ({ ...prev, service_postal_code: e.target.value.toUpperCase() }))}
                    placeholder="H1A 1A1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateClientDialogOpen(false)}>Annuler</Button>
              <Button 
                variant="hero" 
                onClick={() => createClientMutation.mutate(clientForm)}
                disabled={!clientForm.email || !clientForm.full_name || createClientMutation.isPending}
              >
                Créer le client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Technician Dialog */}
        <Dialog open={createTechDialogOpen} onOpenChange={setCreateTechDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-cyan-400" />
                Nouveau technicien
              </DialogTitle>
              <DialogDescription>
                Le code d'accès à 4 chiffres sera généré automatiquement
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input 
                  value={techForm.full_name}
                  onChange={(e) => setTechForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Marc Technicien"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input 
                  type="email"
                  value={techForm.email}
                  onChange={(e) => setTechForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="tech@nivra.ca"
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input 
                  value={techForm.phone}
                  onChange={(e) => setTechForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="514-XXX-XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Code d'accès (4 chiffres, optionnel)</Label>
                <Input 
                  value={techForm.access_code}
                  onChange={(e) => setTechForm(prev => ({ ...prev, access_code: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  placeholder="Auto-généré si vide"
                  maxLength={4}
                />
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-400">
                <Shield className="w-4 h-4 inline mr-1" />
                Le code d'accès est stocké de façon sécurisée et utilisé pour l'authentification technicien
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateTechDialogOpen(false)}>Annuler</Button>
              <Button 
                variant="hero" 
                onClick={() => createTechMutation.mutate(techForm)}
                disabled={!techForm.full_name || !techForm.email || createTechMutation.isPending}
              >
                Créer le technicien
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reschedule Dialog */}
        <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reprogrammer le rendez-vous</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nouvelle date</Label>
                <Select value={newDate} onValueChange={setNewDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une date" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableDates().map(date => (
                      <SelectItem key={date.value} value={date.value}>{date.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Créneau horaire</Label>
                <Select value={newTime} onValueChange={setNewTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un créneau" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(slot => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleRescheduleSubmit} disabled={rescheduleMutation.isPending}>
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler ce rendez-vous?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action notifiera le client de l'annulation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label>Raison de l'annulation</Label>
              <Textarea 
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Indiquez la raison..."
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Retour</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => selectedAppointment && cancelMutation.mutate({ id: selectedAppointment.id, reason: cancelReason })}
                className="bg-red-500 hover:bg-red-600"
              >
                Confirmer l'annulation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Assign Technician Dialog */}
        <Dialog open={assignTechDialogOpen} onOpenChange={setAssignTechDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assigner un technicien</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Technicien</Label>
                <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un technicien" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians?.map(tech => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.full_name} — {tech.specializations?.join(", ") || "Général"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedAppointment?.linkedOrder && (
                <p className="text-sm text-muted-foreground">
                  Ce technicien sera également assigné à la commande {selectedAppointment.linkedOrder.order_number}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignTechDialogOpen(false)}>Annuler</Button>
              <Button 
                onClick={() => selectedAppointment && selectedTechnician && assignTechMutation.mutate({
                  appointmentId: selectedAppointment.id,
                  technicianId: selectedTechnician,
                  orderId: selectedAppointment.linkedOrder?.id,
                })}
                disabled={!selectedTechnician || assignTechMutation.isPending}
              >
                Assigner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Note Dialog */}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une note interne</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea 
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Note visible uniquement par les administrateurs..."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Annuler</Button>
              <Button 
                onClick={() => selectedAppointment && addNoteMutation.mutate({ id: selectedAppointment.id, note: internalNote })}
                disabled={!internalNote.trim() || addNoteMutation.isPending}
              >
                Ajouter la note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminAppointments;
