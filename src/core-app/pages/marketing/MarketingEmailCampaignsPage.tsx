/**
 * MarketingEmailCampaignsPage — Bilingual marketing emails (Nivra dark theme).
 * Backend logic preserved: email_campaigns + email_templates + send-marketing-email.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Send, Loader2, Mail, Eye, MousePointer, AlertTriangle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";

interface Campaign {
  id: string;
  name: string;
  subject_override: string | null;
  status: string;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const CORPORATE_TEMPLATE = (subject: string, bodyHtml: string) => `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:24px 0;font-family:Arial,sans-serif;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#0066CC;padding:24px;text-align:center;color:#ffffff;font-size:20px;font-weight:bold;">Nivra Télécom</td></tr>
      <tr><td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
      <tr><td style="background:#f4f6fa;padding:16px;text-align:center;color:#6b7280;font-size:12px;">
        © ${new Date().getFullYear()} Nivra Télécom · <a href="{{unsubscribe_link}}" style="color:#0066CC;">Se désabonner</a>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();

const MarketingEmailCampaignsPage = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("all");
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const [subjectFr, setSubjectFr] = useState("");
  const [subjectEn, setSubjectEn] = useState("");
  const [bodyFr, setBodyFr] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [scheduleNow, setScheduleNow] = useState("now");
  const [scheduledAt, setScheduledAt] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("email_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setCampaigns((data ?? []) as Campaign[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("marketing-email-campaigns")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_campaigns" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const reset = () => {
    setName(""); setAudience("all");
    setSubjectFr(""); setSubjectEn(""); setBodyFr(""); setBodyEn("");
    setScheduleNow("now"); setScheduledAt("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !subjectFr.trim() || !bodyFr.trim()) {
      toast.error("Nom, sujet (FR) et corps (FR) sont requis"); return;
    }
    setCreating(true);
    try {
      const html = CORPORATE_TEMPLATE(
        subjectFr,
        `<div lang="fr">${bodyFr.replace(/\n/g, "<br/>")}</div>` +
          (bodyEn ? `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;"/><div lang="en">${bodyEn.replace(/\n/g, "<br/>")}</div>` : "")
      );

      const { data: tpl, error: tplError } = await supabase
        .from("email_templates")
        .insert({
          name: `marketing-${Date.now()}`,
          subject: subjectFr,
          html_content: html,
          variables: ["client_name", "client_email", "unsubscribe_link"],
          category: "marketing",
        })
        .select().single();
      if (tplError) throw tplError;

      const segment_filters: Record<string, any> = {};
      if (audience === "active") segment_filters.status = ["active"];
      else if (audience === "cancelled") segment_filters.status = ["cancelled"];

      const isScheduled = scheduleNow === "later" && scheduledAt;
      const { data: campaign, error: cErr } = await supabase
        .from("email_campaigns")
        .insert({
          name, template_id: tpl.id, subject_override: subjectFr,
          type: "manual", status: isScheduled ? "scheduled" : "draft",
          segment_filters,
          scheduled_at: isScheduled ? new Date(scheduledAt).toISOString() : null,
        })
        .select().single();
      if (cErr) throw cErr;

      if (!isScheduled) {
        const { error: sendErr } = await supabase.functions.invoke("send-marketing-email", {
          body: { campaign_id: campaign.id },
        });
        if (sendErr) throw sendErr;
        toast.success("Campagne envoyée");
      } else {
        toast.success("Campagne planifiée");
      }
      reset(); load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setCreating(false);
    }
  };

  const subj = lang === "fr" ? subjectFr : subjectEn;
  const body = lang === "fr" ? bodyFr : bodyEn;

  return (
    <MKPage title="Campagnes Email" subtitle="Marketing — design corporate Nivra · template existant">
      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
        {/* Composer */}
        <MKCard>
          <MKCardHeader title="Nouvelle campagne" />
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">
                Nom de la campagne
              </label>
              <Input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Promo printemps 2026"
                className="bg-[#1E1E2E] border-[#1E1E2E] text-white placeholder:text-[#888] rounded-[10px]"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">
                Audience cible
              </label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger className="bg-[#1E1E2E] border-[#1E1E2E] text-white rounded-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0D1A] border-[#1E1E2E] text-white">
                  <SelectItem value="all">Tous les clients</SelectItem>
                  <SelectItem value="active">Clients actifs</SelectItem>
                  <SelectItem value="cancelled">Clients annulés</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs value={lang} onValueChange={(v) => setLang(v as "fr" | "en")}>
              <TabsList className="w-full bg-[#1E1E2E] rounded-[10px] h-9">
                <TabsTrigger value="fr" className="flex-1 data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white text-[#888] rounded-md">🇫🇷 Français</TabsTrigger>
                <TabsTrigger value="en" className="flex-1 data-[state=active]:bg-[#7C3AED] data-[state=active]:text-white text-[#888] rounded-md">🇬🇧 English</TabsTrigger>
              </TabsList>

              <TabsContent value="fr" className="space-y-3 mt-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">Sujet</label>
                  <Input
                    value={subjectFr} onChange={(e) => setSubjectFr(e.target.value)}
                    className="bg-[#1E1E2E] border-[#1E1E2E] text-white rounded-[10px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">Corps</label>
                  <Textarea
                    rows={8} value={bodyFr} onChange={(e) => setBodyFr(e.target.value)}
                    placeholder="Bonjour {{client_name}}, ..."
                    className="bg-[#1E1E2E] border-[#1E1E2E] text-white placeholder:text-[#888] rounded-[10px] resize-none"
                  />
                  <p className="text-[10px] text-[#888] mt-1">
                    Variables : {`{{client_name}}, {{client_email}}, {{unsubscribe_link}}`}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="en" className="space-y-3 mt-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">Subject</label>
                  <Input
                    value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)}
                    className="bg-[#1E1E2E] border-[#1E1E2E] text-white rounded-[10px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">Body</label>
                  <Textarea
                    rows={8} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)}
                    placeholder="Hello {{client_name}}, ..."
                    className="bg-[#1E1E2E] border-[#1E1E2E] text-white placeholder:text-[#888] rounded-[10px] resize-none"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div>
              <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-1.5 block">Planification</label>
              <Select value={scheduleNow} onValueChange={setScheduleNow}>
                <SelectTrigger className="bg-[#1E1E2E] border-[#1E1E2E] text-white rounded-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0D0D1A] border-[#1E1E2E] text-white">
                  <SelectItem value="now">Envoyer maintenant</SelectItem>
                  <SelectItem value="later">Planifier plus tard</SelectItem>
                </SelectContent>
              </Select>
              {scheduleNow === "later" && (
                <Input
                  type="datetime-local"
                  className="mt-2 bg-[#1E1E2E] border-[#1E1E2E] text-white rounded-[10px]"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              )}
            </div>

            <Button
              onClick={handleCreate} disabled={creating}
              className="w-full rounded-[10px] text-white border-0 h-11 font-semibold"
              style={{ background: "#7C3AED" }}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> :
                scheduleNow === "now" ? <Send className="h-4 w-4 mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
              {scheduleNow === "now" ? "Envoyer la campagne" : "Planifier la campagne"}
            </Button>
          </div>
        </MKCard>

        {/* Live preview */}
        <MKCard>
          <MKCardHeader title="Aperçu corporate · #0066CC" />
          <div className="p-5">
            <div className="rounded-[10px] overflow-hidden border border-[#1E1E2E] bg-[#f4f6fa]">
              <div style={{ background: "#0066CC", color: "white", padding: "20px", textAlign: "center", fontSize: 18, fontWeight: 700, fontFamily: "Arial, sans-serif" }}>
                Nivra Télécom
              </div>
              <div style={{ background: "white", color: "#1a1a1a", padding: 24, fontFamily: "Arial, sans-serif", fontSize: 14, lineHeight: 1.6, minHeight: 220 }}>
                {subj && <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#0066CC" }}>{subj}</div>}
                <div style={{ whiteSpace: "pre-wrap" }}>{body || <span style={{ color: "#9ca3af" }}>(votre message apparaîtra ici)</span>}</div>
              </div>
              <div style={{ background: "#f4f6fa", padding: 12, textAlign: "center", color: "#6b7280", fontSize: 11, fontFamily: "Arial, sans-serif" }}>
                © {new Date().getFullYear()} Nivra Télécom · <span style={{ color: "#0066CC" }}>Se désabonner</span>
              </div>
            </div>
          </div>
        </MKCard>
      </div>

      {/* History */}
      <MKCard>
        <MKCardHeader title={`Historique · ${campaigns.length}`} />
        <div className="p-2">
          {loading ? (
            <div className="text-center py-12 text-[#888]"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#888]">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucune campagne envoyée
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const openRate = c.total_sent > 0 ? Math.round((c.total_opened / c.total_sent) * 100) : 0;
                const clickRate = c.total_sent > 0 ? Math.round((c.total_clicked / c.total_sent) * 100) : 0;
                return (
                  <div key={c.id} className="rounded-[10px] border border-[#1E1E2E] bg-[#0D0D1A] p-4 hover:border-[#7C3AED66] transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white truncate">{c.name}</h3>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider"
                            style={
                              c.status === "sent" || c.status === "completed"
                                ? { background: "#10B98122", color: "#10B981" }
                                : c.status === "sending"
                                  ? { background: "#F59E0B22", color: "#F59E0B" }
                                  : { background: "#7C3AED22", color: "#7C3AED" }
                            }
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="text-sm text-[#888] truncate mt-1">{c.subject_override}</p>
                        <p className="text-[11px] text-[#888] mt-1">{format(new Date(c.created_at), "PPp")}</p>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <Stat label="Envoyés" value={c.total_sent} icon={Send} color="#888" />
                        <Stat label="Ouverts" value={`${openRate}%`} icon={Eye} color="#10B981" />
                        <Stat label="Cliqués" value={`${clickRate}%`} icon={MousePointer} color="#7C3AED" />
                        <Stat label="Rebonds" value={c.total_bounced} icon={AlertTriangle} color="#EF4444" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </MKCard>
    </MKPage>
  );
};

function Stat({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold text-white inline-flex items-center justify-center gap-1 tabular-nums">
        <Icon className="h-3 w-3" style={{ color }} />
        {value}
      </div>
      <div className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

export default MarketingEmailCampaignsPage;
