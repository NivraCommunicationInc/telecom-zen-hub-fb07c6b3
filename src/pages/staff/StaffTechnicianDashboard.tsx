import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Wrench, LogOut, Loader2, Calendar, MapPin, Clock,
  CheckCircle, Phone, User, RefreshCw, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Appointment {
  id: string;
  appointment_number: string;
  title: string;
  scheduled_at: string;
  status: string;
  service_address: string;
  service_city: string;
  service_postal_code: string;
  client_email: string;
  client_phone: string;
  service_type: string;
  description: string;
  installation_method: string;
}

export default function StaffTechnicianDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<"today" | "tomorrow" | "all">("today");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/staff");
        return;
      }

      const { data: hasRole } = await supabase.rpc("has_staff_role", {
        _user_id: session.user.id,
        _role: "technician",
      });

      if (!hasRole) {
        toast.error("Accès non autorisé");
        navigate("/staff");
        return;
      }

      await fetchAppointments();
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const fetchAppointments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Fetch appointments assigned to this technician or all if not assigned
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .or(`technician_id.eq.${session.user.id},technician_id.is.null`)
        .in("status", ["scheduled", "confirmed", "in_progress"])
        .order("scheduled_at", { ascending: true });

      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/staff");
  };

  const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Statut mis à jour");
      await fetchAppointments();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const getFilteredAppointments = () => {
    return appointments.filter((apt) => {
      const date = parseISO(apt.scheduled_at);
      if (selectedDate === "today") return isToday(date);
      if (selectedDate === "tomorrow") return isTomorrow(date);
      return true;
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      scheduled: { label: "Planifié", className: "bg-blue-500" },
      confirmed: { label: "Confirmé", className: "bg-green-500" },
      in_progress: { label: "En cours", className: "bg-orange-500" },
      completed: { label: "Terminé", className: "bg-slate-500" },
      cancelled: { label: "Annulé", className: "bg-red-500" },
    };
    const c = config[status] || { label: status, className: "bg-slate-500" };
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const getServiceIcon = (serviceType: string) => {
    return <Wrench className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  const filteredAppointments = getFilteredAppointments();
  const todayCount = appointments.filter((a) => isToday(parseISO(a.scheduled_at))).length;
  const tomorrowCount = appointments.filter((a) => isTomorrow(parseISO(a.scheduled_at))).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Technicien</h1>
              <p className="text-sm text-slate-400">Nivra Telecom</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => fetchAppointments()}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Date Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedDate("today")}
            className={`flex-1 p-4 rounded-lg border transition-colors ${
              selectedDate === "today"
                ? "border-green-500 bg-green-500/20 text-white"
                : "border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <div className="text-sm opacity-75">Aujourd'hui</div>
            <div className="text-2xl font-bold">{todayCount}</div>
          </button>
          <button
            onClick={() => setSelectedDate("tomorrow")}
            className={`flex-1 p-4 rounded-lg border transition-colors ${
              selectedDate === "tomorrow"
                ? "border-green-500 bg-green-500/20 text-white"
                : "border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <div className="text-sm opacity-75">Demain</div>
            <div className="text-2xl font-bold">{tomorrowCount}</div>
          </button>
          <button
            onClick={() => setSelectedDate("all")}
            className={`flex-1 p-4 rounded-lg border transition-colors ${
              selectedDate === "all"
                ? "border-green-500 bg-green-500/20 text-white"
                : "border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <div className="text-sm opacity-75">Tous</div>
            <div className="text-2xl font-bold">{appointments.length}</div>
          </button>
        </div>

        {/* Appointments List */}
        <div className="space-y-4">
          {filteredAppointments.length === 0 ? (
            <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">Aucun rendez-vous {selectedDate === "today" ? "aujourd'hui" : selectedDate === "tomorrow" ? "demain" : ""}</p>
              </CardContent>
            </Card>
          ) : (
            filteredAppointments.map((apt) => (
              <Card key={apt.id} className="border-slate-700 bg-slate-800/50 backdrop-blur overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-700">
                        {getServiceIcon(apt.service_type || "")}
                      </div>
                      <div>
                        <CardTitle className="text-white text-lg">{apt.title}</CardTitle>
                        <p className="text-sm text-slate-400">{apt.appointment_number}</p>
                      </div>
                    </div>
                    {getStatusBadge(apt.status || "scheduled")}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Time */}
                  <div className="flex items-center gap-3 text-slate-300">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span>
                      {format(parseISO(apt.scheduled_at), "EEEE d MMMM 'à' HH:mm", { locale: fr })}
                    </span>
                  </div>

                  {/* Address */}
                  {apt.service_address && (
                    <div className="flex items-start gap-3 text-slate-300">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div>
                        <p>{apt.service_address}</p>
                        <p className="text-sm text-slate-400">
                          {apt.service_city} {apt.service_postal_code}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Contact */}
                  {apt.client_phone && (
                    <a
                      href={`tel:${apt.client_phone}`}
                      className="flex items-center gap-3 text-green-400 hover:text-green-300"
                    >
                      <Phone className="h-4 w-4" />
                      <span>{apt.client_phone}</span>
                    </a>
                  )}

                  {/* Description */}
                  {apt.description && (
                    <p className="text-sm text-slate-400 bg-slate-700/50 p-3 rounded-lg">
                      {apt.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {apt.status === "scheduled" && (
                      <Button
                        onClick={() => updateAppointmentStatus(apt.id, "in_progress")}
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                      >
                        Commencer
                      </Button>
                    )}
                    {apt.status === "confirmed" && (
                      <Button
                        onClick={() => updateAppointmentStatus(apt.id, "in_progress")}
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                      >
                        Commencer
                      </Button>
                    )}
                    {apt.status === "in_progress" && (
                      <Button
                        onClick={() => updateAppointmentStatus(apt.id, "completed")}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Terminer
                      </Button>
                    )}
                    {apt.service_address && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(`${apt.service_address}, ${apt.service_city} ${apt.service_postal_code}`)}`, "_blank")}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Itinéraire
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
