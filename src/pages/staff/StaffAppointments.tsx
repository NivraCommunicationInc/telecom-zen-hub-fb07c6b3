/**
 * StaffAppointments - Employee portal appointments view
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar, Search, Loader2, RefreshCw, Clock, 
  CheckCircle, MapPin, User, Phone, ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";

export default function StaffAppointments() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ["staff-appointments", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("*")
        .order("scheduled_at", { ascending: true })
        .limit(100);
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filteredAppointments = appointments?.filter(apt => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      apt.appointment_number?.toLowerCase().includes(q) ||
      apt.title?.toLowerCase().includes(q) ||
      apt.client_email?.toLowerCase().includes(q) ||
      apt.service_address?.toLowerCase().includes(q)
    );
  });

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      scheduled: { label: "Planifié", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      confirmed: { label: "Confirmé", className: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
      in_progress: { label: "En cours", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
      completed: { label: "Terminé", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      cancelled: { label: "Annulé", className: "bg-red-500/20 text-red-400 border-red-500/30" },
      rescheduled: { label: "Replanifié", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    };
    return configs[status] || { label: status, className: "bg-slate-500/20 text-slate-400" };
  };

  return (
    <div className="min-h-screen relative">
      <StaffBackground />
      
      <div className="relative z-10 p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/staff/dashboard")}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg">
              <Calendar className="h-6 w-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Rendez-vous</h1>
              <p className="text-slate-400">Gérer les rendez-vous et installations</p>
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

        {/* Filters */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par numéro, titre, email ou adresse..."
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="scheduled">Planifié</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Rendez-vous ({filteredAppointments?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
              </div>
            ) : !filteredAppointments?.length ? (
              <p className="text-slate-400 text-center py-8">Aucun rendez-vous trouvé</p>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-3">
                  {filteredAppointments.map((apt) => {
                    const status = getStatusConfig(apt.status || "scheduled");
                    const scheduledDate = new Date(apt.scheduled_at);
                    const isPast = scheduledDate < new Date();
                    
                    return (
                      <Link
                        key={apt.id}
                        to={`/staff/appointments/${apt.id}`}
                        className={`block p-4 rounded-lg border bg-slate-800/30 hover:bg-slate-800/50 transition-all ${
                          isPast ? "border-slate-700/50 opacity-75" : "border-slate-700 hover:border-teal-500/50"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-sm text-slate-500">{apt.appointment_number}</span>
                              <Badge className={status.className}>{status.label}</Badge>
                            </div>
                            <p className="font-semibold text-white">{apt.title}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-teal-400">
                              {format(scheduledDate, "d MMM", { locale: fr })}
                            </p>
                            <p className="text-sm text-slate-400">
                              {format(scheduledDate, "HH:mm", { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                          {apt.client_email && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {apt.client_email}
                            </span>
                          )}
                          {apt.client_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {apt.client_phone}
                            </span>
                          )}
                          {apt.service_address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {apt.service_address}
                              {apt.service_city && `, ${apt.service_city}`}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
