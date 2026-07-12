import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { portalClient as supabase } from "@/integrations/backend";
import { useQueryClient } from "@tanstack/react-query";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, MapPin, Loader2, CheckCircle2, AlertCircle, User } from "lucide-react";
import { format, addDays, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import InstallSlotPicker from "@/components/shared/InstallSlotPicker";

interface Appointment {
  id: string;
  title: string;
  scheduled_at: string;
  service_type: string;
  service_address: string;
  service_city: string;
  service_postal_code: string;
  technician_id: string | null;
  status: string;
  appointment_number: string;
}

// Parse "HH:MM-HH:MM" from the canonical RPC into a start time.
const parseSlotStart = (timeSlot: string): { h: number; m: number } | null => {
  const match = timeSlot.match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  return { h: Number(match[1]), m: Number(match[2]) };
};

const ClientRescheduleAppointment = () => {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
  const { data: canonicalData, isLoading: canonicalLoading } = useCanonicalClientData(user?.id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const appointmentId = searchParams.get("id");
  const appointmentNumber = searchParams.get("ref");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Canonical slot selection { date: "YYYY-MM-DD", time_slot: "HH:MM-HH:MM" }
  const [pickedSlot, setPickedSlot] = useState<{ date: string; time_slot: string } | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    loadAppointment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, appointmentNumber, user?.id, canonicalLoading, canonicalData?.projection?.lastRefreshedAt]);

  const loadAppointment = async () => {
    try {
      if (!user) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        navigate(`/portal/auth?redirect=${returnUrl}`);
        return;
      }

      if (canonicalLoading) return;
      const appointments = (canonicalData?.appointments || []).filter((row: any) =>
        ["scheduled", "confirmed", "rescheduled"].includes(String(row?.status || "").toLowerCase())
      );

      const data = appointments.find((row: any) =>
        (appointmentId && row.id === appointmentId) ||
        (appointmentNumber && row.appointment_number === appointmentNumber)
      );

      if (!appointmentId && !appointmentNumber) {
        setError("Aucun rendez-vous spécifié.");
        setLoading(false);
        return;
      }

      if (!data) {
        setError("Ce rendez-vous n'existe pas ou n'est plus modifiable.");
        setLoading(false);
        return;
      }

      const appointmentDate = new Date(data.scheduled_at);
      const minRescheduleTime = addDays(new Date(), 1);
      if (isBefore(appointmentDate, minRescheduleTime)) {
        setError("Ce rendez-vous ne peut plus être modifié (moins de 24h avant).");
        setLoading(false);
        return;
      }

      setAppointment(data);
    } catch (err) {
      console.error("Error loading appointment:", err);
      setError("Une erreur est survenue lors du chargement du rendez-vous.");
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!pickedSlot || !appointment) return;
    const parsed = parseSlotStart(pickedSlot.time_slot);
    if (!parsed) {
      toast({ title: "Créneau invalide", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Compose the new local datetime (client tz) then store as ISO.
      const [y, mo, d] = pickedSlot.date.split("-").map(Number);
      const newDateTime = new Date(y, mo - 1, d, parsed.h, parsed.m, 0, 0);

      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          scheduled_at: newDateTime.toISOString(),
          status: "rescheduled",
          description: pickedSlot.time_slot,
          internal_notes: reason ? `Replanifié par le client: ${reason}` : "Replanifié par le client",
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["installation-slots"] });
      setSuccess(true);
      toast({
        title: "Rendez-vous replanifié",
        description: `Nouveau créneau : ${format(newDateTime, "d MMMM yyyy 'à' HH'h'mm", { locale: fr })}`,
      });
    } catch (err) {
      console.error("Reschedule error:", err);
      toast({
        title: "Erreur",
        description: "Impossible de replanifier le rendez-vous.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement du rendez-vous...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle>Impossible de replanifier</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/portal/appointments")}>Voir mes rendez-vous</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-2" />
            <CardTitle className="text-2xl">Rendez-vous replanifié!</CardTitle>
            <CardDescription>Votre demande a été enregistrée.</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {pickedSlot && (
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="font-medium">Nouveau créneau :</p>
                <p className="text-lg text-primary">
                  {format(new Date(pickedSlot.date + "T12:00:00"), "EEEE d MMMM yyyy", { locale: fr })}
                </p>
                <p className="text-muted-foreground">{pickedSlot.time_slot}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Vous recevrez une confirmation par courriel dès que notre équipe validera le rendez-vous.
            </p>
            <Button onClick={() => navigate("/portal/appointments")} className="w-full">
              Voir mes rendez-vous
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!appointment) return null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <img src="/icons/nivra-192.png" alt="Nivra Telecom" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Replanifier mon rendez-vous</h1>
          <p className="text-muted-foreground mt-1">Choisissez une nouvelle date et un créneau disponible.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" /> Rendez-vous actuel
            </CardTitle>
            <CardDescription>#{appointment.appointment_number}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="line-through text-muted-foreground">
                {format(new Date(appointment.scheduled_at), "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{appointment.service_type}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span>
                {appointment.service_address}, {appointment.service_city} {appointment.service_postal_code}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouveau créneau</CardTitle>
            <CardDescription>
              Disponibilités en temps réel — synchronisées avec le calendrier Nivra.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InstallSlotPicker value={pickedSlot} onChange={setPickedSlot} variant="full" />

            <div className="space-y-2">
              <Label>Raison (optionnel)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Pourquoi souhaitez-vous replanifier?"
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" onClick={handleReschedule} disabled={!pickedSlot || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Replanification en cours...
                </>
              ) : (
                "Confirmer la nouvelle date"
              )}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/portal/appointments")}>
              Annuler
            </Button>
          </CardFooter>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Besoin d'aide? Contactez-nous à support@nivra-telecom.ca</p>
        </div>
      </div>
    </div>
  );
};

export default ClientRescheduleAppointment;
