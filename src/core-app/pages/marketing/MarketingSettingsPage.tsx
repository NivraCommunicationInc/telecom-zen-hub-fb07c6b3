/**
 * MarketingSettingsPage — OpenPhone + AI configuration (Nivra dark theme).
 * Backend logic preserved: marketing_settings table + OpenPhone discover/test edge functions.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, CheckCircle2, XCircle, Phone, Key, ExternalLink,
  Search, Copy, Check, Bot, Webhook, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";
import { cn } from "@/lib/utils";

const SETTING_PHONE_ID = "openphone_phone_number_id";
const SETTING_AI_INTERVAL = "ai_response_interval_seconds";
const SETTING_AI_HUMAN_DELAY = "ai_human_takeover_delay_minutes";

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
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
};

const MarketingSettingsPage = () => {
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [aiInterval, setAiInterval] = useState("2");
  const [aiHumanDelay, setAiHumanDelay] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
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
      .select("setting_key, setting_value")
      .in("setting_key", [SETTING_PHONE_ID, SETTING_AI_INTERVAL, SETTING_AI_HUMAN_DELAY]);
    const map = new Map((data ?? []).map((r: any) => [r.setting_key, r.setting_value]));
    setPhoneNumberId(map.get(SETTING_PHONE_ID) ?? "");
    setAiInterval(map.get(SETTING_AI_INTERVAL) ?? "2");
    setAiHumanDelay(map.get(SETTING_AI_HUMAN_DELAY) ?? "10");
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const persistSetting = async (key: string, value: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("marketing_settings")
      .upsert(
        { setting_key: key, setting_value: value, updated_by: user?.id, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" }
      );
    if (error) throw error;
  };

  const handleSave = async () => {
    setSaving(true);
    try { await persistSetting(SETTING_PHONE_ID, phoneNumberId.trim()); toast.success("Numéro enregistré"); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setSaving(false); }
  };

  const handleSaveAi = async () => {
    setSavingAi(true);
    try {
      await persistSetting(SETTING_AI_INTERVAL, aiInterval.trim());
      await persistSetting(SETTING_AI_HUMAN_DELAY, aiHumanDelay.trim());
      toast.success("Configuration IA enregistrée");
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setSavingAi(false); }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("openphone-webhook", {
        body: { __test_connection: true, phone_number_id: phoneNumberId.trim() || null },
      });
      if (error) throw error;
      if (data?.ok) setTestResult({ ok: true, message: data.message || "Connexion OpenPhone valide" });
      else setTestResult({ ok: false, message: data?.error || "Échec de la connexion" });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || "Erreur" });
    } finally { setTesting(false); }
  };

  const handleDiscover = async () => {
    setDiscovering(true); setDiscovered(null); setDiscoverError(null);
    try {
      const { data, error } = await supabase.functions.invoke("openphone-phone-numbers", { body: {} });
      if (error) throw error;
      if (data?.success && Array.isArray(data.phoneNumbers)) {
        setDiscovered(data.phoneNumbers);
        if (data.phoneNumbers.length === 0) setDiscoverError("Aucun numéro trouvé sur ce compte");
      } else setDiscoverError(data?.error || "Échec de la découverte");
    } catch (e: any) {
      setDiscoverError(e.message || "Erreur");
    } finally { setDiscovering(false); }
  };

  const handleSelect = async (id: string) => {
    try { await persistSetting(SETTING_PHONE_ID, id); setPhoneNumberId(id); toast.success("Numéro sélectionné"); }
    catch (e: any) { toast.error(e.message || "Erreur"); }
  };

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      toast.success("URL copiée");
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch { toast.error("Impossible de copier"); }
  };

  const inputCls = "bg-[#1E1E2E] border-[#1E1E2E] text-white placeholder:text-[#888] rounded-[10px]";
  const btnPrimary = "rounded-[10px] text-white border-0 hover:opacity-90";
  const btnSecondary = "rounded-[10px] border-[#1E1E2E] bg-transparent text-white hover:bg-[#1E1E2E]";

  return (
    <MKPage title="Paramètres" subtitle="Configuration des intégrations Marketing Hub">
      {/* OpenPhone */}
      <MKCard>
        <MKCardHeader title="OpenPhone — SMS sortants" />
        <div className="p-5 space-y-5">
          {/* API key info */}
          <div className="rounded-[10px] border border-[#1E1E2E] bg-[#1E1E2E]/40 p-4 flex gap-3">
            <Key className="h-4 w-4 text-[#7C3AED] mt-0.5 shrink-0" />
            <div className="text-sm text-white">
              <div className="font-medium mb-1">Clé API (sécurisée)</div>
              <p className="text-[#888] text-xs">
                <code className="text-[#7C3AED]">OPENPHONE_API_KEY</code> est stockée dans les secrets backend. Pour la mettre à jour, utilisez la gestion des secrets Nivra Cloud.{" "}
                <a href="https://www.openphone.com/app/settings/api" target="_blank" rel="noreferrer"
                  className="text-[#7C3AED] hover:underline inline-flex items-center gap-1">
                  Obtenir une clé <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </div>

          {/* Phone Number ID */}
          <div>
            <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">
              Phone Number ID
            </label>
            <div className="flex gap-2">
              <Input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="PNxxxxxxxxxxxxxxxxxxxxxx"
                disabled={loading}
                className={cn(inputCls, "font-mono text-sm")}
              />
              <Button onClick={handleSave} disabled={saving || loading}
                className={btnPrimary} style={{ background: "#7C3AED" }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDiscover} disabled={discovering}
              className={btnPrimary} style={{ background: "#7C3AED" }}>
              {discovering ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Search className="h-4 w-4 mr-1.5" />}
              Découvrir mes numéros
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing} className={btnSecondary}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Zap className="h-4 w-4 mr-1.5" />}
              Tester la connexion
            </Button>
          </div>

          {/* Test result */}
          {testResult && (
            <div className="rounded-[10px] p-3 flex items-start gap-2 text-sm"
              style={testResult.ok
                ? { background: "#10B98122", color: "#10B981" }
                : { background: "#EF444422", color: "#EF4444" }}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {discoverError && (
            <div className="rounded-[10px] p-3 flex items-start gap-2 text-sm" style={{ background: "#EF444422", color: "#EF4444" }}>
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" /> {discoverError}
            </div>
          )}

          {/* Discovered list */}
          {discovered && discovered.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[2px] text-[#888] mb-2">
                Numéros trouvés · {discovered.length}
              </p>
              <div className="rounded-[10px] border border-[#1E1E2E] divide-y divide-[#1E1E2E]">
                {discovered.map((n) => {
                  const isActive = n.id === phoneNumberId.trim();
                  return (
                    <div key={n.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-[#7C3AED]" />
                          <span className="font-medium text-white">
                            {formatPhone(n.phoneNumber || n.formattedNumber)}
                          </span>
                          {n.name && <span className="text-xs text-[#888]">· {n.name}</span>}
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider"
                              style={{ background: "#10B98122", color: "#10B981" }}>
                              Actif
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#888] font-mono mt-0.5 truncate">{n.id}</p>
                      </div>
                      <Button size="sm" onClick={() => handleSelect(n.id)} disabled={isActive}
                        className={isActive ? btnSecondary : btnPrimary}
                        style={isActive ? undefined : { background: "#7C3AED" }}>
                        {isActive ? "Sélectionné" : "Sélectionner"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </MKCard>

      {/* Webhook */}
      <MKCard>
        <MKCardHeader title="Webhook OpenPhone" />
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-[#7C3AED]" />
            <span className="text-sm text-white">URL à configurer dans OpenPhone pour recevoir SMS et appels en temps réel</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-[#1E1E2E] p-3 rounded-[10px] text-xs break-all text-[#7C3AED] font-mono">
              {webhookUrl}
            </code>
            <Button onClick={handleCopyWebhook} className={cn(btnPrimary, "shrink-0")} style={{ background: "#7C3AED" }}>
              {copiedWebhook ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="rounded-[10px] border border-[#1E1E2E] bg-[#1E1E2E]/40 p-4 text-xs text-[#888] space-y-1">
            <p className="font-medium text-white text-sm mb-1.5">Configuration dans OpenPhone :</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Ouvrir <a href="https://my.openphone.com/settings/integrations/webhooks" target="_blank" rel="noreferrer" className="text-[#7C3AED] hover:underline inline-flex items-center gap-1">Settings → Integrations → Webhooks <ExternalLink className="h-3 w-3" /></a></li>
              <li>Cliquer sur « Add webhook » et coller l'URL ci-dessus</li>
              <li>Événements : <code className="text-[#7C3AED]">message.received</code>, <code className="text-[#7C3AED]">message.created</code>, <code className="text-[#7C3AED]">call.completed</code></li>
              <li>Sauvegarder — les SMS apparaîtront dans Conversations en temps réel</li>
            </ol>
          </div>
        </div>
      </MKCard>

      {/* AI Configuration */}
      <MKCard>
        <MKCardHeader title="Agent IA — Comportement" />
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">
                Intervalle entre messages (secondes)
              </label>
              <Input
                type="number" min="1" max="60"
                value={aiInterval} onChange={(e) => setAiInterval(e.target.value)}
                className={inputCls}
              />
              <p className="text-[11px] text-[#888] mt-1">
                Délai avant que l'IA réponde (humanise la conversation)
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">
                Délai avant reprise humaine (minutes)
              </label>
              <Input
                type="number" min="1" max="120"
                value={aiHumanDelay} onChange={(e) => setAiHumanDelay(e.target.value)}
                className={inputCls}
              />
              <p className="text-[11px] text-[#888] mt-1">
                Si l'IA n'arrive pas à conclure, alerte un humain après ce délai
              </p>
            </div>
          </div>
          <Button onClick={handleSaveAi} disabled={savingAi}
            className={btnPrimary} style={{ background: "#7C3AED" }}>
            {savingAi ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Bot className="h-4 w-4 mr-1.5" />}
            Enregistrer la config IA
          </Button>
        </div>
      </MKCard>
    </MKPage>
  );
};

export default MarketingSettingsPage;
