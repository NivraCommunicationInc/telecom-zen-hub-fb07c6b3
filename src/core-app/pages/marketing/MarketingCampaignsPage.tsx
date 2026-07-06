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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Loader2, Send, Eye, TestTube2, Users, Mail, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  status: string;
  subject: string | null;
  html_content: string | null;
  audience_id: string | null;
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
      subtitle="Emails marketing via Resend — logs, taux d'ouverture, clics"
      actions={
        <Button size="sm" onClick={() => setWizardOpen(true)} className="bg-[#7C3AED] hover:bg-[#6D28D9]">
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
    audience_id: "",
    template_id: "",
    subject: "",
    preheader: "",
    html_content: "",
    from_name: "Nivra",
    from_email: "marketing@notify.nivra-telecom.ca",
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
    setF({ ...f, template_id: id, html_content: t?.html ?? "" });
  };

  const saveDraft = async (): Promise<string | null> => {
    if (!f.name.trim()) { toast.error("Nom requis"); return null; }
    setSaving(true);
    const { data, error } = await supabase.from("mkt_campaigns").insert({
      name: f.name.trim(),
      audience_id: f.audience_id || null,
      template_id: f.template_id || null,
      subject: f.subject.trim() || null,
      preheader: f.preheader.trim() || null,
      html_content: f.html_content || null,
      from_name: f.from_name,
      from_email: f.from_email,
      status: "draft",
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return null; }
    toast.success("Brouillon sauvegardé");
    return data.id;
  };

  const sendTest = async () => {
    if (!testEmail.trim()) { toast.error("Email test requis"); return; }
    if (!f.subject || !f.html_content) { toast.error("Sujet et HTML requis"); return; }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("marketing-send", {
      body: {
        mode: "test", test_email: testEmail.trim(),
        subject: f.subject, html: f.html_content,
        from_name: f.from_name, from_email: f.from_email,
      },
    });
    setTesting(false);
    if (error || !data?.ok) toast.error(`Échec: ${data?.error ?? error?.message ?? "inconnu"}`);
    else toast.success("Email test envoyé ✓");
  };

  const launch = async () => {
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nouvelle campagne — étape {step}/4</DialogTitle>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className={`h-1 flex-1 rounded ${n <= step ? "bg-[#7C3AED]" : "bg-[#1E1E2E]"}`} />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {step === 1 && (
            <div className="space-y-3">
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
              <p className="text-[11px] text-[#888]">
                Le domaine doit être vérifié dans Resend. Par défaut: notify.nivra-telecom.ca
              </p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[400px]">
                <div className="flex flex-col">
                  <Label>HTML</Label>
                  <Textarea className="flex-1 font-mono text-xs" value={f.html_content}
                    onChange={e => setF({ ...f, html_content: e.target.value })} />
                </div>
                <div className="flex flex-col">
                  <Label>Aperçu</Label>
                  <iframe srcDoc={f.html_content} className="flex-1 border border-[#1E1E2E] rounded bg-white" />
                </div>
              </div>
              <p className="text-[10px] text-[#888]">
                Variables: <code>{"{{first_name}}"}</code>, <code>{"{{full_name}}"}</code>, <code>{"{{city}}"}</code>, <code>{"{{unsubscribe_url}}"}</code>
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
              <div className="border-t border-[#1E1E2E] pt-3">
                <Label>Envoyer un test à :</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                    placeholder="ton@email.com" />
                  <Button onClick={sendTest} disabled={testing} variant="outline">
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                    <span className="ml-1">Test</span>
                  </Button>
                </div>
              </div>
              <div className="rounded-[10px] border border-[#F59E0B]/30 bg-[#F59E0B]/5 p-3 text-xs text-[#F59E0B]">
                ⚠️ Assure-toi d'avoir vérifié le domaine <code>notify.nivra-telecom.ca</code> dans le tableau de bord Resend.
                Sinon les envois échoueront avec "domain not verified".
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
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
              <Button variant="outline" onClick={saveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Sauver brouillon
              </Button>
              <Button onClick={launch} disabled={sending || !f.subject} className="bg-[#10B981] hover:bg-[#059669]">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Envoyer maintenant
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
