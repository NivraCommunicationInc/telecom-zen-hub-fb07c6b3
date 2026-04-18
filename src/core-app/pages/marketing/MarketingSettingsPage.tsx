/**
 * MarketingSettingsPage — Configuration for Marketing Hub integrations.
 * OpenPhone API key is stored in Supabase Secrets (managed externally).
 * This page lets admins discover phone numbers, save the active one, and test the connection.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Phone, Key, ExternalLink, Search, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const SETTING_PHONE_ID = "openphone_phone_number_id";

type OpenPhoneNumber = {
  id: string;
  phoneNumber?: string;
  name?: string;
  formattedNumber?: string;
};

const formatPhone = (raw?: string) => {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
};

const MarketingSettingsPage = () => {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<OpenPhoneNumber[] | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openphone-webhook`;

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

  const persistPhoneId = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("marketing_settings")
      .upsert(
        { setting_key: SETTING_PHONE_ID, setting_value: id, updated_by: user?.id, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" }
      );
    if (error) throw error;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistPhoneId(phoneNumberId.trim());
      toast.success("Paramètres enregistrés");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
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

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscovered(null);
    setDiscoverError(null);
    try {
      const { data, error } = await supabase.functions.invoke("openphone-phone-numbers", {
        body: {},
      });
      if (error) throw error;
      if (data?.success && Array.isArray(data.phoneNumbers)) {
        setDiscovered(data.phoneNumbers);
        if (data.phoneNumbers.length === 0) {
          setDiscoverError("Aucun numéro trouvé sur ce compte OpenPhone");
        }
      } else {
        setDiscoverError(data?.error || "Échec de la découverte");
      }
    } catch (e: any) {
      setDiscoverError(e.message || "Erreur");
    } finally {
      setDiscovering(false);
    }
  };

  const handleSelect = async (id: string) => {
    try {
      await persistPhoneId(id);
      setPhoneNumberId(id);
      toast.success("Numéro OpenPhone sélectionné et enregistré");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      toast.success("URL copiée");
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      toast.error("Impossible de copier");
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

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Enregistrer
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Tester la connexion
            </Button>
            <Button variant="secondary" onClick={handleDiscover} disabled={discovering}>
              {discovering ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Search className="h-4 w-4 mr-1" />
              )}
              Découvrir mes numéros OpenPhone
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

          {discoverError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{discoverError}</AlertDescription>
            </Alert>
          )}

          {discovered && discovered.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Numéros trouvés ({discovered.length})
              </p>
              <div className="border rounded-md divide-y">
                {discovered.map((n) => {
                  const isActive = n.id === phoneNumberId.trim();
                  return (
                    <div
                      key={n.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📞</span>
                          <span className="font-medium">
                            {formatPhone(n.phoneNumber || n.formattedNumber)}
                          </span>
                          {n.name && (
                            <span className="text-xs text-muted-foreground">
                              {n.name}
                            </span>
                          )}
                          {isActive && (
                            <Badge variant="secondary" className="ml-1">Actif</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                          ID: {n.id}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={isActive ? "outline" : "default"}
                        onClick={() => handleSelect(n.id)}
                        disabled={isActive}
                      >
                        {isActive ? "Sélectionné" : "Sélectionner"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook OpenPhone</CardTitle>
          <CardDescription>
            URL à configurer dans le dashboard OpenPhone pour recevoir les SMS et appels entrants en temps réel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted p-3 rounded text-xs break-all">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyWebhook}
              className="shrink-0"
            >
              {copiedWebhook ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <Alert>
            <AlertDescription className="text-sm space-y-2">
              <p className="font-medium">Configuration dans OpenPhone :</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Ouvrir <a href="https://my.openphone.com/settings/integrations/webhooks" target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">Settings → Integrations → Webhooks <ExternalLink className="h-3 w-3" /></a></li>
                <li>Cliquer sur « Add webhook » et coller l'URL ci-dessus</li>
                <li>Sélectionner les événements : <code>message.received</code>, <code>message.created</code>, <code>call.completed</code>, <code>call.ringing</code></li>
                <li>Sauvegarder — les SMS entrants apparaîtront dans la page Conversations en temps réel</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingSettingsPage;
