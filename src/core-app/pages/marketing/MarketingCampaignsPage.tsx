/**
 * MarketingCampaignsPage — Liste + création de campagnes email (mkt_campaigns).
 * Wizard 4 étapes: Nom → Audience → Template/Contenu → Sujet+Envoi.
 * Envoi via edge function `marketing-send` (Resend).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";
import MarketingNav from "./MarketingNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Loader2, Send, Eye, TestTube2, Users, CheckCircle2, Clock, CalendarClock,
  SplitSquareHorizontal, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MARKETING_EMAIL_SNIPPETS, OFFICIAL_MARKETING_BODY, normalizeOfficialMarketingBody, renderOfficialMarketingEmail } from "./officialMarketingEmail";

interface Campaign {
  id: string;
  name: string;
  status: string;
  subject: string | null;
  html_content: string | null;
  channel: string;
  audience_id: string | null;
  scheduled_at: string | null;
  ab_config: any;
  total_recipients: number;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  created_at: string;
  completed_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[#1E1E2E] text-[#888]",
  scheduled: "bg-[#F59E0B]/20 text-[#F59E0B]",
  sending: "bg-[#7C3AED]/20 text-[#7C3AED]",
  sent: "bg-[#10B981]/20 text-[#10B981]",
  failed: "bg-[#EF4444]/20 text-[#EF4444]",
};

export default function MarketingCampaignsPage() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("mkt_campaigns")
      .select("*").order("created_at", { ascending: false }).limit(100);
    setRows((data ?? []) as Campaign[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <MKPage
      title="Campagnes"
      subtitle="Builder avancé: audience, contenu, aperçu WYSIWYG, A/B testing, test et planification."
      actions={
        <Button size="sm" onClick={() => setWizardOpen(true)} className="rounded-full font-black">
          <Plus className="h-4 w-4 mr-1" /> Nouvelle campagne
        </Button>
      }
    >
      <MarketingNav />

      <MKCard>
        <MKCardHeader title={`${rows.length} campagnes`} />
        {loading ? (
          <div className="p-8 text-center text-[#888]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[#888]">
            <Send className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Aucune campagne. Crée ta première pour envoyer.
          </div>
        ) : (
          <div className="divide-y divide-[#1E1E2E]">
            {rows.map(c => {
              const openRate = c.sent_count > 0 ? Math.round((c.opened_count / c.sent_count) * 100) : 0;
              const clickRate = c.sent_count > 0 ? Math.round((c.clicked_count / c.sent_count) * 100) : 0;
              return (
                <div key={c.id} className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto,auto,auto] gap-3 px-5 py-4 items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={STATUS_STYLES[c.status] ?? ""}>{c.status}</Badge>
                      <Badge variant="outline" className="rounded-full capitalize">{c.channel ?? "email"}</Badge>
                      {c.ab_config?.enabled && <Badge variant="outline" className="rounded-full"><SplitSquareHorizontal className="mr-1 h-3 w-3" />A/B</Badge>}
                      {c.scheduled_at && <Badge variant="outline" className="rounded-full"><CalendarClock className="mr-1 h-3 w-3" />{format(new Date(c.scheduled_at), "d MMM HH:mm", { locale: fr })}</Badge>}
                      <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                    </div>
                    <div className="text-xs text-[#888] mt-1 truncate">{c.subject}</div>
                    <div className="text-[10px] text-[#666] mt-1">
                      {format(new Date(c.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </div>
                  </div>
                  <Stat icon={Users} value={c.total_recipients} label="Cibles" />
                  <Stat icon={Send} value={c.sent_count} label="Envoyés" />
                  <Stat icon={Eye} value={`${openRate}%`} label={`${c.opened_count} ouverts`} />
                  <Stat icon={CheckCircle2} value={`${clickRate}%`} label={`${c.clicked_count} clics`} />
                </div>
              );
            })}
          </div>
        )}
      </MKCard>

      {wizardOpen && (
        <CampaignWizard onClose={() => setWizardOpen(false)} onDone={() => { setWizardOpen(false); load(); }} />
      )}
    </MKPage>
  );
}

function Stat({ icon: Icon, value, label }: any) {
  return (
    <div className="text-center min-w-[70px]">
      <div className="text-sm font-bold text-white flex items-center justify-center gap-1">
        <Icon className="h-3 w-3 text-[#7C3AED]" /> {value}
      </div>
      <div className="text-[10px] text-[#888]">{label}</div>
    </div>
  );
}

// ─── Wizard ─────────────────────────────────────────────────────────────────

function CampaignWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [audiences, setAudiences] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [testEmail, setTestEmail] = useState("");

  const [f, setF] = useState({
    name: "",
    channel: "email",
    audience_id: "",
    template_id: "",
    subject: "",
    subject_b: "",
    ab_enabled: false,
    ab_split: "50",
    scheduled_at: "",
    preheader: "",
    html_content: OFFICIAL_MARKETING_BODY,
    from_name: "Nivra",
    from_email: "marketing@nivra-telecom.ca",
  });

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: t }] = await Promise.all([
        supabase.from("mkt_audiences").select("id,name,member_count").eq("is_archived", false),
        supabase.from("mkt_templates").select("id,name,html").eq("is_archived", false),
      ]);
      setAudiences(a ?? []);
      setTemplates(t ?? []);
    })();
  }, []);

  const pickTemplate = (id: string) => {
    const t = templates.find(x => x.id === id);
    setF({ ...f, template_id: id, html_content: normalizeOfficialMarketingBody(t?.html ?? OFFICIAL_MARKETING_BODY) });
  };

  const saveDraft = async (status: "draft" | "scheduled" = "draft"): Promise<string | null> => {
    if (!f.name.trim()) { toast.error("Nom requis"); return null; }
    setSaving(true);
    const { data, error } = await supabase.from("mkt_campaigns").insert({
      name: f.name.trim(),
      channel: f.channel,
      audience_id: f.audience_id || null,
      template_id: f.template_id || null,
      subject: f.subject.trim() || null,
      preheader: f.preheader.trim() || null,
      html_content: normalizeOfficialMarketingBody(f.html_content) || null,
      scheduled_at: f.scheduled_at || null,
      ab_config: f.ab_enabled ? {
        enabled: true,
        split: Number(f.ab_split) || 50,
        variants: [
          { key: "A", subject: f.subject.trim() },
          { key: "B", subject: f.subject_b.trim() || f.subject.trim() },
        ],
        winner_metric: "click_rate",
      } : null,
      from_name: f.from_name,
      from_email: f.from_email,
      status,
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return null; }
    toast.success(status === "scheduled" ? "Campagne planifiée" : "Brouillon sauvegardé");
    return data.id;
  };

  const sendTest = async () => {
    if (f.channel !== "email") { toast.info("Le test direct est disponible pour les emails."); return; }
    if (!testEmail.trim()) { toast.error("Email test requis"); return; }
    if (!f.subject || !f.html_content) { toast.error("Sujet et contenu requis"); return; }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("marketing-send", {
      body: {
        mode: "test", test_email: testEmail.trim(),
        subject: f.subject, html: normalizeOfficialMarketingBody(f.html_content),
        preheader: f.preheader,
        from_name: f.from_name, from_email: f.from_email,
      },
    });
    setTesting(false);
    if (error || !data?.ok) toast.error(`Échec: ${data?.error ?? error?.message ?? "inconnu"}`);
    else toast.success("Email test envoyé ✓");
  };

  const launch = async () => {
    if (f.channel !== "email") {
      const id = await saveDraft(f.scheduled_at ? "scheduled" : "draft");
      if (id) {
        toast.success(f.channel === "push" ? "Campagne push préparée" : "Campagne sauvegardée");
        onDone();
      }
      return;
    }
    const id = await saveDraft();
    if (!id) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("marketing-send", {
      body: { mode: "campaign", campaign_id: id },
    });
    setSending(false);
    if (error || !data?.ok) {
      toast.error(`Échec: ${data?.error ?? error?.message ?? "inconnu"}`);
      return;
    }
    toast.success(`Campagne envoyée · ${data.sent}/${data.total} livrés`);
    onDone();
  };

  const schedule = async () => {
    if (!f.scheduled_at) { toast.error("Date de planification requise"); return; }
    const id = await saveDraft("scheduled");
    if (id) onDone();
  };

  return (
    <MKCard className="overflow-hidden">
      <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-black leading-tight text-foreground">Nouvelle campagne — étape {step}/4</h2>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={`h-1 flex-1 rounded ${n <= step ? "bg-[#7C3AED]" : "bg-[#1E1E2E]"}`} />
            ))}
          </div>
      </div>

      <div className="space-y-4 p-5">
          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { value: "email", label: "Email", icon: Send, desc: "Envoi Resend" },
                  { value: "push", label: "Push web", icon: Smartphone, desc: "Notification navigateur" },
                ].map((ch) => (
                  <button key={ch.value} type="button" onClick={() => setF({ ...f, channel: ch.value })}
                    className={`rounded-2xl border p-4 text-left transition-colors ${f.channel === ch.value ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"}`}>
                    <ch.icon className="mb-3 h-5 w-5 text-primary" />
                    <div className="text-sm font-black text-foreground">{ch.label}</div>
                    <div className="text-xs text-muted-foreground">{ch.desc}</div>
                  </button>
                ))}
              </div>
              <div>
                <Label>Nom interne de la campagne *</Label>
                <Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })}
                  placeholder="Ex: Promo Hiver 2026 — Prospects Montréal" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Expéditeur (nom)</Label>
                  <Input value={f.from_name} onChange={e => setF({ ...f, from_name: e.target.value })} />
                </div>
                <div>
                  <Label>Expéditeur (email)</Label>
                  <Input value={f.from_email} onChange={e => setF({ ...f, from_email: e.target.value })} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Le domaine Resend doit être actif pour que l'envoi réel passe; les brouillons, previews et planifications restent disponibles.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Label>Audience *</Label>
              {audiences.length === 0 ? (
                <div className="text-sm text-[#888]">Aucune audience — créez-en une d'abord dans l'onglet Audiences.</div>
              ) : (
                <div className="space-y-2">
                  {audiences.map(a => (
                    <button key={a.id} onClick={() => setF({ ...f, audience_id: a.id })}
                      className={`w-full text-left px-4 py-3 rounded-[10px] border transition-colors ${
                        f.audience_id === a.id ? "border-[#7C3AED] bg-[#7C3AED]/10" : "border-[#1E1E2E] hover:border-[#333]"
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-white">{a.name}</div>
                        <Badge className="bg-[#7C3AED]/20 text-[#7C3AED]">
                          <Users className="h-3 w-3 mr-1" />{a.member_count} membres
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <Label>Template de départ (optionnel)</Label>
                <Select value={f.template_id} onValueChange={pickTemplate}>
                  <SelectTrigger><SelectValue placeholder="Choisir un template…" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="flex flex-col">
                  <Label>Corps du message officiel Nivra</Label>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {MARKETING_EMAIL_SNIPPETS.map((snippet) => (
                      <Button key={snippet.label} type="button" size="sm" variant="outline" onClick={() => setF({ ...f, html_content: `${f.html_content}\n${snippet.html}` })}>{snippet.label}</Button>
                    ))}
                  </div>
                  <Textarea className="min-h-[400px] font-mono text-xs" value={f.html_content}
                    onChange={e => setF({ ...f, html_content: e.target.value })} />
                </div>
                <div className="flex flex-col">
                  <Label>Aperçu</Label>
                  <iframe srcDoc={renderOfficialMarketingEmail({ title: f.subject || f.name || "Nivra Telecom", preheader: f.preheader, bodyHtml: f.html_content })} className="min-h-[520px] flex-1 rounded border border-[#1E1E2E] bg-white" />
                </div>
              </div>
              <p className="text-[10px] text-[#888]">
                L'en-tête, le footer officiel, le support et le désabonnement Nivra sont appliqués automatiquement à l'aperçu, au test et à l'envoi réel. Variables: <code>{"{{first_name}}"}</code>, <code>{"{{full_name}}"}</code>, <code>{"{{city}}"}</code>, <code>{"{{unsubscribe_url}}"}</code>
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div>
                <Label>Sujet *</Label>
                <Input value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })}
                  placeholder="Bonjour {{first_name}}, une offre pour toi" />
              </div>
              <div>
                <Label>Preheader (texte de prévisualisation dans la boîte)</Label>
                <Input value={f.preheader} onChange={e => setF({ ...f, preheader: e.target.value })} />
              </div>
              <div className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-foreground">
                  <input type="checkbox" checked={f.ab_enabled} onChange={(e) => setF({ ...f, ab_enabled: e.target.checked })} />
                  <SplitSquareHorizontal className="h-4 w-4 text-primary" /> Activer A/B testing sujet
                </label>
                {f.ab_enabled && (
                  <div className="grid gap-3 md:grid-cols-[1fr_110px]">
                    <div>
                      <Label>Sujet variante B</Label>
                      <Input value={f.subject_b} onChange={e => setF({ ...f, subject_b: e.target.value })} placeholder="Variante de sujet" />
                    </div>
                    <div>
                      <Label>Split A</Label>
                      <Input type="number" min="10" max="90" value={f.ab_split} onChange={e => setF({ ...f, ab_split: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label>Planifier l'envoi</Label>
                <Input type="datetime-local" value={f.scheduled_at} onChange={e => setF({ ...f, scheduled_at: e.target.value })} />
              </div>
              <div className="border-t border-[#1E1E2E] pt-3">
                <Label>Envoyer un test à :</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                    placeholder="ton@email.com" disabled={f.channel !== "email"} />
                  <Button onClick={sendTest} disabled={testing || f.channel !== "email"} variant="outline">
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                    <span className="ml-1">Test</span>
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                Envoi via le domaine vérifié <strong>nivra-telecom.ca</strong> chez Resend.
              </div>
            </div>
          )}
      </div>

      <DialogFooter className="border-t border-border p-5 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Précédent</Button>}
          {step < 4 && (
            <Button onClick={() => setStep(step + 1)} className="bg-[#7C3AED] hover:bg-[#6D28D9]"
              disabled={(step === 1 && !f.name) || (step === 2 && !f.audience_id) || (step === 3 && !f.html_content)}>
              Suivant
            </Button>
          )}
          {step === 4 && (
            <>
              <Button variant="outline" onClick={() => saveDraft()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Sauver brouillon
              </Button>
              <Button variant="outline" onClick={schedule} disabled={saving || !f.scheduled_at || !f.subject}>
                <CalendarClock className="h-4 w-4 mr-1" /> Planifier
              </Button>
              <Button onClick={launch} disabled={sending || !f.subject} className="bg-[#10B981] hover:bg-[#059669]">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                {f.channel === "email" ? "Envoyer maintenant" : "Préparer"}
              </Button>
            </>
          )}
      </DialogFooter>
    </MKCard>
  );
}
