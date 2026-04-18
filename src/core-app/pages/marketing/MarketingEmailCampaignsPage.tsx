/**
 * MarketingEmailCampaignsPage — Marketing-focused email campaign management.
 * Uses existing email_campaigns + email_sends tables; sends via send-marketing-email.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Send, Loader2, Mail, Eye, MousePointer, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("all");
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
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const reset = () => {
    setName(""); setAudience("all");
    setSubjectFr(""); setSubjectEn("");
    setBodyFr(""); setBodyEn("");
    setScheduleNow("now"); setScheduledAt("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !subjectFr.trim() || !bodyFr.trim()) {
      toast.error("Nom, sujet (FR) et corps (FR) sont requis");
      return;
    }
    setCreating(true);
    try {
      // Build bilingual HTML wrapped in corporate template
      const html = CORPORATE_TEMPLATE(
        subjectFr,
        `<div lang="fr">${bodyFr.replace(/\n/g, "<br/>")}</div>` +
          (bodyEn ? `<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;"/><div lang="en">${bodyEn.replace(/\n/g, "<br/>")}</div>` : "")
      );

      // Create a one-off email_template
      const { data: tpl, error: tplError } = await supabase
        .from("email_templates")
        .insert({
          name: `marketing-${Date.now()}`,
          subject: subjectFr,
          html_content: html,
          variables: ["client_name", "client_email", "unsubscribe_link"],
          category: "marketing",
        })
        .select()
        .single();
      if (tplError) throw tplError;

      // Map audience -> segment_filters
      const segment_filters: Record<string, any> = {};
      if (audience === "active") segment_filters.status = ["active"];
      else if (audience === "cancelled") segment_filters.status = ["cancelled"];

      const isScheduled = scheduleNow === "later" && scheduledAt;
      const { data: campaign, error: cErr } = await supabase
        .from("email_campaigns")
        .insert({
          name,
          template_id: tpl.id,
          subject_override: subjectFr,
          type: "manual",
          status: isScheduled ? "scheduled" : "draft",
          segment_filters,
          scheduled_at: isScheduled ? new Date(scheduledAt).toISOString() : null,
        })
        .select()
        .single();
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

      setOpen(false);
      reset();
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setCreating(false);
    }
  };

  const statusColor = (s: string) =>
    s === "sent" ? "default" : s === "sending" ? "secondary" : s === "scheduled" ? "outline" : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campagnes Email</h1>
          <p className="text-sm text-muted-foreground">
            Campagnes marketing — utilise l'infrastructure email existante
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nouvelle campagne</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer une campagne email</DialogTitle>
              <DialogDescription>Bilingue FR/EN — design corporate Nivra</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom de la campagne</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promo printemps 2026" />
              </div>
              <div>
                <Label>Audience cible</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les clients</SelectItem>
                    <SelectItem value="active">Clients actifs</SelectItem>
                    <SelectItem value="cancelled">Clients annulés</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Tabs defaultValue="fr">
                <TabsList className="w-full">
                  <TabsTrigger value="fr" className="flex-1">🇫🇷 Français</TabsTrigger>
                  <TabsTrigger value="en" className="flex-1">🇬🇧 English</TabsTrigger>
                </TabsList>
                <TabsContent value="fr" className="space-y-3">
                  <div>
                    <Label>Sujet (FR)</Label>
                    <Input value={subjectFr} onChange={(e) => setSubjectFr(e.target.value)} />
                  </div>
                  <div>
                    <Label>Corps (FR)</Label>
                    <Textarea rows={8} value={bodyFr} onChange={(e) => setBodyFr(e.target.value)} placeholder="Bonjour {{client_name}}, ..." />
                    <p className="text-xs text-muted-foreground mt-1">
                      Variables: {`{{client_name}}, {{client_email}}, {{unsubscribe_link}}`}
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="en" className="space-y-3">
                  <div>
                    <Label>Subject (EN)</Label>
                    <Input value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} />
                  </div>
                  <div>
                    <Label>Body (EN)</Label>
                    <Textarea rows={8} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} placeholder="Hello {{client_name}}, ..." />
                  </div>
                </TabsContent>
              </Tabs>

              <div>
                <Label>Planification</Label>
                <Select value={scheduleNow} onValueChange={setScheduleNow}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="now">Envoyer maintenant</SelectItem>
                    <SelectItem value="later">Planifier</SelectItem>
                  </SelectContent>
                </Select>
                {scheduleNow === "later" && (
                  <Input
                    type="datetime-local"
                    className="mt-2"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>Annuler</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                {scheduleNow === "now" ? "Envoyer" : "Planifier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Toutes les campagnes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucune campagne
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const openRate = c.total_sent > 0 ? Math.round((c.total_opened / c.total_sent) * 100) : 0;
                const clickRate = c.total_sent > 0 ? Math.round((c.total_clicked / c.total_sent) * 100) : 0;
                return (
                  <div key={c.id} className="border rounded-lg p-4 hover:bg-muted/30 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{c.name}</h3>
                          <Badge variant={statusColor(c.status) as any}>{c.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">{c.subject_override}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(c.created_at), "PPp")}
                        </p>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-center text-xs">
                        <div>
                          <div className="font-semibold">{c.total_sent}</div>
                          <div className="text-muted-foreground">Envoyés</div>
                        </div>
                        <div>
                          <div className="font-semibold flex items-center justify-center gap-1">
                            <Eye className="h-3 w-3" />{openRate}%
                          </div>
                          <div className="text-muted-foreground">Ouverts</div>
                        </div>
                        <div>
                          <div className="font-semibold flex items-center justify-center gap-1">
                            <MousePointer className="h-3 w-3" />{clickRate}%
                          </div>
                          <div className="text-muted-foreground">Cliqués</div>
                        </div>
                        <div>
                          <div className="font-semibold flex items-center justify-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3" />{c.total_bounced}
                          </div>
                          <div className="text-muted-foreground">Rebonds</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingEmailCampaignsPage;
