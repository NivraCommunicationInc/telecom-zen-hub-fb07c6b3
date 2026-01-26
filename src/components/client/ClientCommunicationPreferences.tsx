/**
 * ClientCommunicationPreferences - Marketing & Newsletter opt-in/out
 * Manages client_email_preferences for marketing communications
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Megaphone, Mail, Newspaper, Gift, Loader2, Save, CheckCircle2, Info } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ClientCommunicationPreferencesProps {
  userId: string;
}

interface CommunicationPrefs {
  marketing_emails: boolean;
  promotional_emails: boolean;
  newsletter: boolean;
  consent_given_at: string | null;
}

const ClientCommunicationPreferences = ({ userId }: ClientCommunicationPreferencesProps) => {
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<CommunicationPrefs>({
    marketing_emails: false,
    promotional_emails: false,
    newsletter: false,
    consent_given_at: null,
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current preferences
  const { data: currentPrefs, isLoading } = useQuery({
    queryKey: ["communication-preferences", userId],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("client_email_preferences")
        .select("marketing_emails, promotional_emails, newsletter, consent_given_at")
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
        marketing_emails: currentPrefs.marketing_emails ?? false,
        promotional_emails: currentPrefs.promotional_emails ?? false,
        newsletter: currentPrefs.newsletter ?? false,
        consent_given_at: currentPrefs.consent_given_at,
      });
    }
  }, [currentPrefs]);

  // Save preferences
  const saveMutation = useMutation({
    mutationFn: async (newPrefs: Omit<CommunicationPrefs, "consent_given_at">) => {
      const { error } = await portalSupabase
        .from("client_email_preferences")
        .upsert({
          client_id: userId,
          ...newPrefs,
          consent_given_at: new Date().toISOString(),
          consent_source: "client_portal_communication",
          updated_at: new Date().toISOString(),
        }, { onConflict: "client_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-preferences"] });
      setHasChanges(false);
      toast.success("Préférences de communication enregistrées");
    },
    onError: () => {
      toast.error("Erreur lors de l'enregistrement");
    },
  });

  const updatePref = (key: keyof Omit<CommunicationPrefs, "consent_given_at">, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Quick actions
  const optInAll = () => {
    setPrefs((prev) => ({
      ...prev,
      marketing_emails: true,
      promotional_emails: true,
      newsletter: true,
    }));
    setHasChanges(true);
  };

  const optOutAll = () => {
    setPrefs((prev) => ({
      ...prev,
      marketing_emails: false,
      promotional_emails: false,
      newsletter: false,
    }));
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

  const hasAnyOptIn = prefs.marketing_emails || prefs.promotional_emails || prefs.newsletter;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-cyan-400" />
          Préférences de communication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={optInAll}>
            Tout activer
          </Button>
          <Button variant="outline" size="sm" onClick={optOutAll}>
            Tout désactiver
          </Button>
        </div>

        {/* Preference Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <Label className="font-medium">Emails marketing</Label>
                <p className="text-sm text-muted-foreground">
                  Offres spéciales et promotions exclusives
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.marketing_emails}
              onCheckedChange={(checked) => updatePref("marketing_emails", checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                <Gift className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <Label className="font-medium">Offres promotionnelles</Label>
                <p className="text-sm text-muted-foreground">
                  Nouveaux produits et réductions
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.promotional_emails}
              onCheckedChange={(checked) => updatePref("promotional_emails", checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Newspaper className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <Label className="font-medium">Infolettre mensuelle</Label>
                <p className="text-sm text-muted-foreground">
                  Actualités, conseils et astuces
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.newsletter}
              onCheckedChange={(checked) => updatePref("newsletter", checked)}
            />
          </div>
        </div>

        {/* Consent Info */}
        {prefs.consent_given_at && (
          <Alert className="border-cyan-500/30 bg-cyan-500/10">
            <Info className="w-4 h-4 text-cyan-500" />
            <AlertDescription className="text-sm">
              Consentement enregistré le {format(new Date(prefs.consent_given_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </AlertDescription>
          </Alert>
        )}

        {/* Status Badge */}
        <div className="flex items-center justify-center">
          <Badge 
            variant="outline" 
            className={hasAnyOptIn ? "text-emerald-500 border-emerald-500/30" : "text-muted-foreground"}
          >
            {hasAnyOptIn ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Inscrit aux communications
              </>
            ) : (
              "Aucune communication marketing"
            )}
          </Badge>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <Button
            variant="hero"
            className="w-full"
            onClick={() => saveMutation.mutate({
              marketing_emails: prefs.marketing_emails,
              promotional_emails: prefs.promotional_emails,
              newsletter: prefs.newsletter,
            })}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer mes préférences
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientCommunicationPreferences;
