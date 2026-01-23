import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, MapPin, Loader2, CheckCircle2, AlertCircle, User } from "lucide-react";
import { format, addDays, isBefore, isWeekend, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

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

const TIME_SLOTS = [
  { value: "08:00", label: "08h00 - 10h00" },
  { value: "10:00", label: "10h00 - 12h00" },
  { value: "13:00", label: "13h00 - 15h00" },
  { value: "15:00", label: "15h00 - 17h00" },
];

const ClientRescheduleAppointment = () => {
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

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    loadAppointment();
  }, [appointmentId, appointmentNumber]);

  const loadAppointment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        navigate(`/portal/auth?redirect=${returnUrl}`);
        return;
      }

      let query = supabase
        .from("appointments")
        .select("*")
        .eq("client_id", user.id)
        .in("status", ["scheduled", "confirmed"]);

      if (appointmentId) {
        query = query.eq("id", appointmentId);
      } else if (appointmentNumber) {
        query = query.eq("appointment_number", appointmentNumber);
      } else {
        setError("Aucun rendez-vous spécifié.");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError || !data) {
        setError("Ce rendez-vous n'existe pas ou n'est plus modifiable.");
        setLoading(false);
        return;
      }

      // Check if appointment is at least 24h away
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
    if (!selectedDate || !selectedTime || !appointment) return;

    setSubmitting(true);

    try {
      // Combine date and time
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(hours, minutes, 0, 0);

      // Update the appointment
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          scheduled_at: newDateTime.toISOString(),
          status: "scheduled", // Reset to scheduled for admin confirmation
          internal_notes: reason ? `Replanifié par le client: ${reason}` : "Replanifié par le client"
        })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      setSuccess(true);
      toast({
        title: "Rendez-vous replanifié",
        description: `Votre rendez-vous a été déplacé au ${format(newDateTime, "d MMMM yyyy 'à' HH'h'mm", { locale: fr })}`
      });
    } catch (err: any) {
      console.error("Reschedule error:", err);
      toast({
        title: "Erreur",
        description: "Impossible de replanifier le rendez-vous.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isDateDisabled = (date: Date) => {
    const today = startOfDay(new Date());
    const minDate = addDays(today, 2); // At least 2 days from now
    const maxDate = addDays(today, 30); // Maximum 30 days ahead
    
    return (
      isBefore(date, minDate) ||
      isBefore(maxDate, date) ||
      isWeekend(date)
    );
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
            <Button onClick={() => navigate("/portal/appointments")}>
              Voir mes rendez-vous
            </Button>
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
            <CardDescription>
              Votre demande de replanification a été enregistrée.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-left">
              <p className="font-medium">Nouvelle date proposée:</p>
              <p className="text-lg text-primary">
                {selectedDate && format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
              </p>
              <p className="text-muted-foreground">
                {TIME_SLOTS.find(t => t.value === selectedTime)?.label}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Vous recevrez une confirmation par email une fois le rendez-vous confirmé par notre équipe.
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
        {/* Header */}
        <div className="text-center">
          <img 
            src="/lovable-uploads/3c596b71-aa59-43f0-ac7e-8b87a060ad02.png" 
            alt="Nivra Telecom" 
            className="h-10 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold">Replanifier mon rendez-vous</h1>
          <p className="text-muted-foreground mt-1">
            Choisissez une nouvelle date et heure
          </p>
        </div>

        {/* Current Appointment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Rendez-vous actuel
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

        {/* New Date Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle date</CardTitle>
            <CardDescription>
              Sélectionnez une date disponible (du lundi au vendredi)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={isDateDisabled}
                locale={fr}
                className="rounded-md border"
              />
            </div>

            {selectedDate && (
              <div className="space-y-2">
                <Label>Créneau horaire</Label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un créneau" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(slot => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
            <Button 
              className="w-full" 
              onClick={handleReschedule}
              disabled={!selectedDate || !selectedTime || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Replanification en cours...
                </>
              ) : (
                "Confirmer la nouvelle date"
              )}
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate("/portal/appointments")}
            >
              Annuler
            </Button>
          </CardFooter>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Besoin d'aide? Contactez-nous à support@nivratelecom.ca</p>
        </div>
      </div>
    </div>
  );
};

export default ClientRescheduleAppointment;
