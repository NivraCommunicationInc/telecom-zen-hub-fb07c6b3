/**
 * MarketingSettingsPage — Configuration for Marketing Hub integrations.
 * OpenPhone API key is stored in Supabase Secrets (managed externally).
 * This page lets admins update the phone number ID and test the connection.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Phone, Key, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const SETTING_PHONE_ID = "openphone_phone_number_id";

const MarketingSettingsPage = () => {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("marketing_settings")
      .select("setting_value")
      .eq("setting_key", SETTING_PHONE_ID)
      .maybeSingle();
    setPhoneNumberId(data?.setting_value ?? "");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("marketing_settings")
      .upsert(
        { setting_key: SETTING_PHONE_ID, setting_value: phoneNumberId.trim(), updated_by: user?.id, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" }
      );
    if (error) toast.error(error.message);
    else toast.success("Paramètres enregistrés");
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("openphone-webhook", {
        body: { __test_connection: true, phone_number_id: phoneNumberId.trim() || null },
      });
      if (error) throw error;
      if (data?.ok) {
        setTestResult({ ok: true, message: data.message || "Connexion OpenPhone valide" });
      } else {
        setTestResult({ ok: false, message: data?.error || "Échec de la connexion" });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || "Erreur" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres Marketing Hub</h1>
        <p className="text-sm text-muted-foreground">
          Configuration des intégrations (OpenPhone, etc.)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4" /> OpenPhone
          </CardTitle>
          <CardDescription>
            Intégration SMS pour les conversations marketing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription className="text-sm">
              La clé API OpenPhone (<code className="text-xs">OPENPHONE_API_KEY</code>) est stockée
              de manière sécurisée dans les secrets backend. Elle ne peut pas être affichée ici
              pour des raisons de sécurité. Pour la mettre à jour, utilisez l'outil de gestion
              des secrets dans Lovable Cloud.{" "}
              <a
                href="https://www.openphone.com/app/settings/api"
                target="_blank"
                rel="noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                Obtenir une clé <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="phone-id">OpenPhone Phone Number ID</Label>
            <Input
              id="phone-id"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="PNxxxxxxxxxxxxxxxxxxxxxx"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              ID du numéro OpenPhone qui sera utilisé pour envoyer les SMS sortants
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Enregistrer
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Tester la connexion
            </Button>
          </div>

          {testResult && (
            <Alert variant={testResult.ok ? "default" : "destructive"}>
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {testResult.message}
                {testResult.ok && (
                  <Badge variant="secondary" className="ml-2">Connecté</Badge>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook OpenPhone</CardTitle>
          <CardDescription>
            URL à configurer dans le dashboard OpenPhone pour recevoir les SMS entrants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block bg-muted p-3 rounded text-xs break-all">
            {import.meta.env.VITE_SUPABASE_URL}/functions/v1/openphone-webhook
          </code>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingSettingsPage;
