/**
 * StaffAppointmentDetail - Appointment detail page for staff portal
 * Completely isolated from admin - stays within /staff namespace
 */
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Calendar, User, MapPin, Clock, Phone, Mail, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function StaffAppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["staff-appointment-detail", id],
    queryFn: async () => {
      const { data: appointmentData, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch client profile separately
      let clientProfile = null;
      if (appointmentData?.client_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", appointmentData.client_id)
          .maybeSingle();
        clientProfile = profile;
      }

      // Fetch technician separately
      let technicianData = null;
      if (appointmentData?.technician_id) {
        const { data: tech } = await supabase
          .from("technicians")
          .select("full_name, phone")
          .eq("id", appointmentData.technician_id)
          .maybeSingle();
        technicianData = tech;
      }

      return { 
        ...appointmentData, 
        clientProfile, 
        technician: technicianData 
      };
    },
    enabled: !!id,
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="animate-pulse text-slate-400">Chargement...</div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="text-center">
          <p className="text-slate-400 mb-4">Rendez-vous non trouvé</p>
          <Button onClick={() => navigate("/staff/appointments")} variant="outline">
            Retour aux rendez-vous
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex relative">
      <StaffBackground />
      <StaffSidebar onSignOut={handleSignOut} />
      
      <main className="flex-1 p-6 overflow-auto z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/staff/appointments")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Calendar className="h-6 w-6 text-teal-400" />
              {appointment.appointment_number || "Rendez-vous"}
            </h1>
            <p className="text-slate-400">{appointment.title}</p>
          </div>
          <Badge className={statusColors[appointment.status || "scheduled"]}>
            {appointment.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Appointment Info */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-400" />
                Date et heure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span className="text-slate-300">
                  {format(new Date(appointment.scheduled_at), "EEEE d MMMM yyyy", { locale: fr })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className="text-slate-300">
                  {format(new Date(appointment.scheduled_at), "HH:mm", { locale: fr })}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-slate-500 mt-1" />
                <div className="text-slate-300">
                  <p>{appointment.service_address || "Adresse non spécifiée"}</p>
                  {appointment.service_city && (
                    <p>{appointment.service_city}, {appointment.service_postal_code}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Info */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5 text-teal-400" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-slate-300">
                  {appointment.clientProfile?.full_name || "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-slate-300">
                  {appointment.clientProfile?.email || appointment.client_email || "N/A"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-slate-500" />
                <span className="text-slate-300">
                  {appointment.clientProfile?.phone || appointment.client_phone || "N/A"}
                </span>
              </div>
              {appointment.client_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/staff/clients/${appointment.client_id}`)}
                  className="w-full mt-4"
                >
                  Voir le profil client
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Technician */}
          {appointment.technician && (
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <User className="h-5 w-5 text-teal-400" />
                  Technicien assigné
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-slate-300">{appointment.technician.full_name}</span>
                </div>
                {appointment.technician.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-300">{appointment.technician.phone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Description & Notes */}
          {(appointment.description || appointment.internal_notes) && (
            <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-teal-400" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {appointment.description && (
                  <div>
                    <p className="text-slate-500 text-sm mb-1">Description</p>
                    <p className="text-slate-300">{appointment.description}</p>
                  </div>
                )}
                {appointment.internal_notes && (
                  <div>
                    <p className="text-slate-500 text-sm mb-1">Notes internes</p>
                    <p className="text-slate-300">{appointment.internal_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
