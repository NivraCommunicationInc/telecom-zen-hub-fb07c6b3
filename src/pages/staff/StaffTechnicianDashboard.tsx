import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Wrench, LogOut, Loader2, Calendar, MapPin, Clock,
  CheckCircle, Phone, RefreshCw, AlertTriangle, Clock3
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { TechnicianSidebar } from "@/components/staff/TechnicianSidebar";

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

interface StaffInfo {
  name: string;
  email: string;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "teal" | "orange" | "pink" | "yellow" | "blue" | "green";
}

const StatCard = ({ label, value, icon, color }: StatCardProps) => {
  const colorClasses = {
    teal: "from-teal-500 to-cyan-500 text-teal-400",
    orange: "from-orange-500 to-amber-500 text-orange-400",
    pink: "from-pink-500 to-rose-500 text-pink-400",
    yellow: "from-yellow-500 to-amber-400 text-yellow-400",
    blue: "from-blue-500 to-indigo-500 text-blue-400",
    green: "from-green-500 to-emerald-500 text-green-400",
  };

  return (
    <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colorClasses[color].split(" ")[0]} ${colorClasses[color].split(" ")[1]} shadow-lg`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function StaffTechnicianDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<"today" | "tomorrow" | "all">("today");

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchStaffInfo(), fetchAppointments()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const fetchStaffInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        setStaffInfo({
          name: profile?.full_name || session.user.email?.split("@")[0] || "Technicien",
          email: session.user.email || "",
        });
      }
    } catch (error) {
      console.error("Error fetching staff info:", error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

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

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
      scheduled: { label: "Planifié", icon: <Clock3 className="h-3 w-3" />, className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      confirmed: { label: "Confirmé", icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-500/20 text-green-400 border-green-500/30" },
      in_progress: { label: "En cours", icon: <RefreshCw className="h-3 w-3" />, className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      completed: { label: "Terminé", icon: <CheckCircle className="h-3 w-3" />, className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
      cancelled: { label: "Annulé", icon: <AlertTriangle className="h-3 w-3" />, className: "bg-red-500/20 text-red-400 border-red-500/30" },
    };
    return configs[status] || { label: status, icon: null, className: "bg-slate-500/20 text-slate-400" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <Loader2 className="h-10 w-10 animate-spin text-teal-400 z-10" />
      </div>
    );
  }

  const filteredAppointments = getFilteredAppointments();
  const todayCount = appointments.filter((a) => isToday(parseISO(a.scheduled_at))).length;
  const tomorrowCount = appointments.filter((a) => isTomorrow(parseISO(a.scheduled_at))).length;
  const inProgressCount = appointments.filter((a) => a.status === "in_progress").length;

  return (
    <div className="min-h-screen relative flex">
      <StaffBackground />
      
      {/* Sidebar */}
      <TechnicianSidebar 
        onSignOut={handleLogout}
        userEmail={staffInfo?.email}
        userName={staffInfo?.name}
      />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header for mobile */}
        <header className="lg:hidden sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg shadow-teal-500/20">
                  <Wrench className="h-6 w-6 text-slate-900" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Portail Technicien</h1>
                  <p className="text-sm text-slate-400">Bienvenue, {staffInfo?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fetchAppointments()}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 relative z-10 space-y-6 overflow-auto">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              label="Aujourd'hui" 
              value={todayCount} 
              icon={<Calendar className="h-5 w-5 text-white" />}
              color="teal"
            />
            <StatCard 
              label="Demain" 
              value={tomorrowCount} 
              icon={<Clock className="h-5 w-5 text-white" />}
              color="blue"
            />
            <StatCard 
              label="En cours" 
              value={inProgressCount} 
              icon={<RefreshCw className="h-5 w-5 text-white" />}
              color="orange"
            />
            <StatCard 
              label="Total" 
              value={appointments.length} 
              icon={<Wrench className="h-5 w-5 text-white" />}
              color="green"
            />
          </div>

          {/* Date Filter */}
          <div className="flex gap-3">
            {[
              { key: "today", label: "Aujourd'hui", count: todayCount },
              { key: "tomorrow", label: "Demain", count: tomorrowCount },
              { key: "all", label: "Tous", count: appointments.length },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setSelectedDate(filter.key as typeof selectedDate)}
                className={`flex-1 p-4 rounded-xl border transition-all ${
                  selectedDate === filter.key
                    ? "border-teal-500 bg-teal-500/20 text-white shadow-lg shadow-teal-500/10"
                    : "border-slate-700/50 bg-slate-900/60 text-slate-300 hover:bg-slate-800/50"
                }`}
              >
                <div className="text-sm opacity-75">{filter.label}</div>
                <div className="text-2xl font-bold">{filter.count}</div>
              </button>
            ))}
          </div>

          {/* Appointments List */}
          <div className="space-y-4">
            {filteredAppointments.length === 0 ? (
              <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">
                    Aucun rendez-vous {selectedDate === "today" ? "aujourd'hui" : selectedDate === "tomorrow" ? "demain" : ""}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredAppointments.map((apt) => {
                const status = getStatusConfig(apt.status);
                return (
                  <Card key={apt.id} className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-800">
                            <Wrench className="h-4 w-4 text-teal-400" />
                          </div>
                          <div>
                            <CardTitle className="text-white text-lg">{apt.title}</CardTitle>
                            <p className="text-sm text-slate-400">{apt.appointment_number}</p>
                          </div>
                        </div>
                        <Badge className={`${status.className} flex items-center gap-1 border`}>
                          {status.icon}
                          {status.label}
                        </Badge>
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
                          className="flex items-center gap-3 text-teal-400 hover:text-teal-300 transition-colors"
                        >
                          <Phone className="h-4 w-4" />
                          <span>{apt.client_phone}</span>
                        </a>
                      )}

                      {/* Description */}
                      {apt.description && (
                        <p className="text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg">
                          {apt.description}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3 pt-2">
                        {(apt.status === "scheduled" || apt.status === "confirmed") && (
                          <Button
                            onClick={() => updateAppointmentStatus(apt.id, "in_progress")}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                          >
                            Commencer
                          </Button>
                        )}
                        {apt.status === "in_progress" && (
                          <Button
                            onClick={() => updateAppointmentStatus(apt.id, "completed")}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Terminer
                          </Button>
                        )}
                        {apt.service_address && (
                          <Button
                            variant="outline"
                            onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(`${apt.service_address}, ${apt.service_city} ${apt.service_postal_code}`)}`, "_blank")}
                            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            Itinéraire
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
