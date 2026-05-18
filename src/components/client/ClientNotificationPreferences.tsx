/**
 * ClientNotificationPreferences - SMS/Email notification preferences
 * Allows clients to choose how they receive notifications
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail, MessageSquare, Loader2, Save, CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { toast } from "sonner";

interface ClientNotificationPreferencesProps {
  userId: string;
}

interface NotificationPrefs {
  // Email preferences
  marketing_emails: boolean;
  promotional_emails: boolean;
  newsletter: boolean;
  service_updates: boolean;
  billing_notifications: boolean;
  // SMS preferences
  sms_reminders: boolean;
  sms_invoices: boolean;
  sms_service_updates: boolean;
  preferred_contact_method: "email" | "sms" | "both";
}

const defaultPrefs: NotificationPrefs = {
  marketing_emails: true,
  promotional_emails: true,
  newsletter: true,
  service_updates: true,
  billing_notifications: true,
  sms_reminders: false,
  sms_invoices: false,
  sms_service_updates: false,
  preferred_contact_method: "email",
};

const ClientNotificationPreferences = ({ userId }: ClientNotificationPreferencesProps) => {
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current preferences
  const { data: currentPrefs, isLoading } = useQuery({
    queryKey: ["notification-preferences", userId],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("client_email_preferences")
        .select("*")
        .eq("client_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (currentPrefs) {
      setPrefs({
        marketing_emails: currentPrefs.marketing_emails ?? true,
        promotional_emails: currentPrefs.promotional_emails ?? true,
        newsletter: currentPrefs.newsletter ?? true,
        service_updates: currentPrefs.service_updates ?? true,
        billing_notifications: currentPrefs.billing_notifications ?? true,
        sms_reminders: currentPrefs.sms_reminders ?? false,
        sms_invoices: currentPrefs.sms_invoices ?? false,
        sms_service_updates: currentPrefs.sms_service_updates ?? false,
        preferred_contact_method: currentPrefs.preferred_contact_method ?? "email",
      });
    }
  }, [currentPrefs]);

  // Save preferences
  const saveMutation = useMutation({
    mutationFn: async (newPrefs: NotificationPrefs) => {
      const { error } = await portalSupabase
        .from("client_email_preferences")
        .upsert({
          client_id: userId,
          ...newPrefs,
          consent_given_at: new Date().toISOString(),
          consent_source: "client_portal",
          updated_at: new Date().toISOString(),
        }, { onConflict: "client_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      setHasChanges(false);
      toast.success("Préférences de notification enregistrées");
    },
    onError: () => {
      toast.error("Erreur lors de l'enregistrement");
    },
  });

  const updatePref = (key: keyof NotificationPrefs, value: boolean | string) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ClientSmsMasterToggle userId={userId} />
      <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-cyan-400" />
          Préférences de notification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preferred Contact Method */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Méthode de contact préférée</Label>
          <div className="flex gap-2">
            {(["email", "sms", "both"] as const).map((method) => (
              <Button
                key={method}
                variant={prefs.preferred_contact_method === method ? "default" : "outline"}
                size="sm"
                onClick={() => updatePref("preferred_contact_method", method)}
                className={prefs.preferred_contact_method === method ? "bg-cyan-500 hover:bg-cyan-600" : ""}
              >
                {method === "email" && <Mail className="w-4 h-4 mr-1" />}
                {method === "sms" && <MessageSquare className="w-4 h-4 mr-1" />}
                {method === "both" && <Bell className="w-4 h-4 mr-1" />}
                {method === "email" ? "Email" : method === "sms" ? "SMS" : "Les deux"}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Email Notifications */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <Label className="text-base font-medium">Notifications par email</Label>
          </div>

          <div className="space-y-3 ml-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Mises à jour de service</Label>
                <p className="text-xs text-muted-foreground">Alertes sur vos services actifs</p>
              </div>
              <Switch
                checked={prefs.service_updates}
                onCheckedChange={(checked) => updatePref("service_updates", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Notifications de facturation</Label>
                <p className="text-xs text-muted-foreground">Factures, rappels de paiement</p>
              </div>
              <Switch
                checked={prefs.billing_notifications}
                onCheckedChange={(checked) => updatePref("billing_notifications", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Infolettre</Label>
                <p className="text-xs text-muted-foreground">Nouvelles et conseils mensuels</p>
              </div>
              <Switch
                checked={prefs.newsletter}
                onCheckedChange={(checked) => updatePref("newsletter", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Emails marketing</Label>
                <p className="text-xs text-muted-foreground">Offres spéciales et promotions</p>
              </div>
              <Switch
                checked={prefs.marketing_emails}
                onCheckedChange={(checked) => updatePref("marketing_emails", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Emails promotionnels</Label>
                <p className="text-xs text-muted-foreground">Nouveaux produits et services</p>
              </div>
              <Switch
                checked={prefs.promotional_emails}
                onCheckedChange={(checked) => updatePref("promotional_emails", checked)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* SMS Notifications */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <Label className="text-base font-medium">Notifications par SMS</Label>
            <Badge variant="outline" className="text-xs">Nouveau</Badge>
          </div>

          <div className="space-y-3 ml-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Rappels de rendez-vous</Label>
                <p className="text-xs text-muted-foreground">SMS avant vos rendez-vous</p>
              </div>
              <Switch
                checked={prefs.sms_reminders}
                onCheckedChange={(checked) => updatePref("sms_reminders", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Rappels de factures</Label>
                <p className="text-xs text-muted-foreground">SMS pour les échéances</p>
              </div>
              <Switch
                checked={prefs.sms_invoices}
                onCheckedChange={(checked) => updatePref("sms_invoices", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Alertes de service</Label>
                <p className="text-xs text-muted-foreground">Interruptions et maintenance</p>
              </div>
              <Switch
                checked={prefs.sms_service_updates}
                onCheckedChange={(checked) => updatePref("sms_service_updates", checked)}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <Button
            variant="hero"
            className="w-full"
            onClick={() => saveMutation.mutate(prefs)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer les préférences
          </Button>
        )}

        {!hasChanges && currentPrefs && (
          <div className="flex items-center justify-center gap-2 text-emerald-500 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Préférences à jour
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
};

export default ClientNotificationPreferences;
