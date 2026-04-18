/**
 * MarketingAIConfigPage — Configure global AI agent: enable, model, prompt, discount rules.
 * Also shows recent AI replies log.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Bot } from "lucide-react";
import { toast } from "sonner";

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
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (recommandé)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (rapide)" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview)" },
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)" },
  { value: "openai/gpt-5", label: "GPT-5" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
];

export default function MarketingAIConfigPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("marketing_ai_config").select("*").limit(1).maybeSingle();
      setCfg(data as Cfg);
      const { data: r } = await supabase.from("marketing_ai_replies")
        .select("*").order("created_at", { ascending: false }).limit(20);
      setReplies((r || []) as Reply[]);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const { error } = await supabase.from("marketing_ai_config")
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
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…</div>;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent IA — Ventes</h1>
        <p className="text-sm text-muted-foreground">Configuration de l'agent IA qui répond automatiquement aux SMS.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" /> Configuration globale</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md border border-border">
            <div>
              <Label className="font-medium">Agent IA activé</Label>
              <p className="text-xs text-muted-foreground">Désactiver met toutes les conversations en attente humaine.</p>
            </div>
            <Switch checked={cfg.is_enabled} onCheckedChange={(v) => setCfg({ ...cfg, is_enabled: v })} />
          </div>

          <div className="space-y-1.5">
            <Label>Modèle IA</Label>
            <Select value={cfg.model} onValueChange={(v) => setCfg({ ...cfg, model: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Via Lovable AI Gateway — aucune clé requise.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Prompt système</Label>
            <Textarea
              value={cfg.system_prompt}
              onChange={(e) => setCfg({ ...cfg, system_prompt: e.target.value })}
              rows={20}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">{cfg.system_prompt.length} caractères. Définit les règles de l'agent (langues, rabais, ton).</p>
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Sauvegarder
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Stratégie de rabais (lecture seule)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1 text-muted-foreground">
          <div>1. Aucun rabais → discussion d'abord</div>
          <div>2. Si hésitation → 5 $/mois × 24 mois (120 $)</div>
          <div>3. Si encore réticent → 10 $/mois × 24 mois (240 $)</div>
          <div>4. Dernier recours → installation gratuite</div>
          <div className="pt-2 text-xs">⚠️ Maximum 1 rabais par client. Jamais de combinaison.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dernières réponses IA</CardTitle></CardHeader>
        <CardContent>
          {replies.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">Aucune réponse encore</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {replies.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.detected_language?.toUpperCase() || "?"} · {r.model}</span>
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-CA")}</span>
                  </div>
                  <div className="text-muted-foreground"><span className="font-medium text-foreground">Client:</span> {r.inbound_message}</div>
                  <div><span className="font-medium">IA:</span> {r.ai_response}</div>
                  {r.error ? (
                    <div className="text-destructive">Erreur: {r.error}</div>
                  ) : (
                    <div className={r.sent_via_openphone ? "text-emerald-600" : "text-amber-600"}>
                      {r.sent_via_openphone ? "✓ Envoyé via OpenPhone" : "⚠️ Non envoyé"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
