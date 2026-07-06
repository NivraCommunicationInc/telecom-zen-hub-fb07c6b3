/**
 * MarketingAIConfigPage — Configure the global AI sales agent.
 *
 * - Toggle ON/OFF (writes to marketing_ai_config.is_enabled — the openphone-webhook
 *   reads this on every inbound SMS).
 * - Pick model from supported Lovable AI Gateway models.
 * - Edit the system prompt — controls language behavior, discount escalation, tone.
 * - View the discount strategy (read-only — enforced via the prompt).
 * - Inspect the last 20 AI responses (success / failure).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Bot, Languages, Tag, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { MKPage } from "./_marketing-ui";
import MarketingNav from "./MarketingNav";

type Cfg = {
  id: string;
  is_enabled: boolean;
  model: string;
  system_prompt: string;
};

type Reply = {
  id: string;
  inbound_message: string;
  ai_response: string;
  model: string;
  detected_language: string | null;
  sent_via_openphone: boolean;
  error: string | null;
  created_at: string;
};

const MODELS = [
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Recommandé — meilleur raisonnement" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Plus rapide, moins coûteux" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", desc: "Aperçu nouvelle génération" },
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", desc: "Aperçu raisonnement avancé" },
  { value: "openai/gpt-5", label: "GPT-5", desc: "Tout-terrain robuste" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", desc: "Équilibre performance/coût" },
];

const SUPPORTED_LANGUAGES = [
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "en", flag: "🇬🇧", label: "Anglais" },
  { code: "ht", flag: "🇭🇹", label: "Créole haïtien" },
  { code: "es", flag: "🇪🇸", label: "Espagnol" },
  { code: "it", flag: "🇮🇹", label: "Italien" },
  { code: "pt", flag: "🇵🇹", label: "Portugais" },
];

const DISCOUNT_STRATEGY = [
  { step: 1, rule: "Aucun rabais", desc: "Discussion d'abord, valeur du produit en avant" },
  { step: 2, rule: "5 $/mois × 24 mois", desc: "Si hésitation après 2-3 messages (économie 120 $)" },
  { step: 3, rule: "10 $/mois × 24 mois", desc: "Si encore réticent (économie 240 $)" },
  { step: 4, rule: "Installation gratuite", desc: "Dernier recours uniquement" },
];

export default function MarketingAIConfigPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("marketing_ai_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      setCfg(data as Cfg);
      const { data: r } = await supabase
        .from("marketing_ai_replies")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setReplies((r || []) as Reply[]);
      setLoading(false);
    })();

    // Live updates when new AI replies happen
    const channel = supabase
      .channel("marketing-ai-replies-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "marketing_ai_replies" },
        (payload: any) => {
          setReplies((prev) => [payload.new as Reply, ...prev].slice(0, 20));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase
      .from("marketing_ai_config")
      .update({
        is_enabled: cfg.is_enabled,
        model: cfg.model,
        system_prompt: cfg.system_prompt,
      })
      .eq("id", cfg.id);
    setSaving(false);
    if (error) return toast.error("Erreur de sauvegarde");
    toast.success("Configuration sauvegardée");
  };

  if (loading || !cfg) {
    return (
      <MKPage title="IA" subtitle="Configuration de l'agent marketing">
        <MarketingNav />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
        </div>
      </MKPage>
    );
  }

  const successCount = replies.filter((r) => r.sent_via_openphone && !r.error).length;
  const failCount = replies.length - successCount;

  return (
    <MKPage title="IA" subtitle="Configuration de l'agent marketing qui répond aux SMS entrants.">
      <MarketingNav />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black tracking-normal">Agent IA — Ventes</h2>
          <p className="text-sm text-muted-foreground">Activation, modèle, prompt, rabais et dernières réponses.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={cfg.is_enabled ? "default" : "secondary"}>
            {cfg.is_enabled ? "🟢 ACTIF" : "⚫ INACTIF"}
          </Badge>
        </div>
      </div>

      {/* ── Main config card ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" /> Configuration globale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md border border-border bg-secondary/30">
            <div>
              <Label className="font-medium">Agent IA activé</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Si désactivé, toutes les conversations passent en attente humaine.
              </p>
            </div>
            <Switch
              checked={cfg.is_enabled}
              onCheckedChange={(v) => setCfg({ ...cfg, is_enabled: v })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Modèle IA</Label>
            <Select value={cfg.model} onValueChange={(v) => setCfg({ ...cfg, model: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground"> — {m.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Via Nivra AI Gateway — aucune clé API requise.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Prompt système</Label>
            <Textarea
              value={cfg.system_prompt}
              onChange={(e) => setCfg({ ...cfg, system_prompt: e.target.value })}
              rows={20}
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              {cfg.system_prompt.length} caractères. Définit langues, ton, règles de rabais et persona.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder la configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Discount strategy + supported languages side-by-side ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" /> Stratégie de rabais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DISCOUNT_STRATEGY.map((s) => (
              <div key={s.step} className="flex gap-3 p-2.5 rounded-md border border-border">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {s.step}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{s.rule}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-2.5 mt-3">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                Maximum <strong>1 rabais par client</strong>. Jamais de combinaison. Règles appliquées via le
                prompt système ci-dessus.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Languages className="h-4 w-4" /> Langues supportées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Détection automatique selon le contenu du SMS entrant. L'IA répond toujours dans la langue
              détectée.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_LANGUAGES.map((l) => (
                <div
                  key={l.code}
                  className="flex items-center gap-2 p-2 rounded-md border border-border bg-secondary/30"
                >
                  <span className="text-lg">{l.flag}</span>
                  <div>
                    <div className="text-sm font-medium">{l.label}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{l.code}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent AI replies ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Dernières réponses IA
            </CardTitle>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {successCount} envoyés
              </span>
              {failCount > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {failCount} échecs
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {replies.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Aucune réponse IA encore. Les SMS entrants déclencheront automatiquement l'agent.
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {replies.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {(r.detected_language || "?").toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground font-mono text-[10px]">{r.model}</span>
                    </div>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(r.created_at).toLocaleString("fr-CA", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Client :</span>{" "}
                    <span className="text-muted-foreground">{r.inbound_message}</span>
                  </div>
                  <Separator />
                  <div>
                    <span className="font-medium">IA :</span> {r.ai_response}
                  </div>
                  {r.error ? (
                    <div className="text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Erreur : {r.error}
                    </div>
                  ) : (
                    <div
                      className={
                        r.sent_via_openphone
                          ? "text-emerald-600 flex items-center gap-1"
                          : "text-amber-600 flex items-center gap-1"
                      }
                    >
                      {r.sent_via_openphone ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Envoyé via OpenPhone
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3" /> Non envoyé
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </MKPage>
  );
}
