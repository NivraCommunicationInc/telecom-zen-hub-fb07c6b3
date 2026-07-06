/** MarketingPushCampaignsPage — création de campagnes Push web. */
import { useMemo, useState } from "react";
import { Bell, CheckCircle2, Clock, Eye, Plus, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MarketingNav from "./MarketingNav";
import { MKCard, MKCardHeader, MKPage, MKStat } from "./_marketing-ui";

type PushDraft = {
  id: string;
  title: string;
  body: string;
  url: string;
  audience: string;
  status: "draft" | "scheduled" | "ready";
  scheduledAt?: string;
};

export default function MarketingPushCampaignsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [drafts, setDrafts] = useState<PushDraft[]>([]);
  const [form, setForm] = useState({
    title: "Offre Nivra disponible",
    body: "Découvrez les services prépayés disponibles à votre adresse.",
    url: "https://nivra-telecom.ca",
    audience: "Tous les visiteurs abonnés",
    scheduledAt: "",
  });

  const stats = useMemo(() => ({
    drafts: drafts.filter((d) => d.status === "draft").length,
    scheduled: drafts.filter((d) => d.status === "scheduled").length,
    ready: drafts.filter((d) => d.status === "ready").length,
  }), [drafts]);

  const saveDraft = (status: PushDraft["status"]) => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Titre et message requis");
      return;
    }
    setDrafts((prev) => [{
      id: crypto.randomUUID(),
      title: form.title.trim(),
      body: form.body.trim(),
      url: form.url.trim(),
      audience: form.audience.trim(),
      status,
      scheduledAt: form.scheduledAt || undefined,
    }, ...prev]);
    toast.success(status === "scheduled" ? "Push planifié" : status === "ready" ? "Push prêt à envoyer" : "Brouillon enregistré");
    setDialogOpen(false);
  };

  return (
    <MKPage
      title="Push web"
      subtitle="Prépare les notifications navigateur pour visiteurs abonnés et clients connectés."
      actions={<Button className="rounded-full font-black" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nouveau push</Button>}
    >
      <MarketingNav />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MKStat label="Abonnés estimés" value="—" icon={Users} />
        <MKStat label="Brouillons" value={stats.drafts} icon={Bell} accent="hsl(var(--muted-foreground))" />
        <MKStat label="Planifiés" value={stats.scheduled} icon={Clock} accent="hsl(var(--primary))" />
        <MKStat label="Prêts" value={stats.ready} icon={CheckCircle2} accent="hsl(var(--success))" />
      </div>

      <MKCard>
        <MKCardHeader title="Campagnes push" />
        {drafts.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Bell className="mx-auto mb-3 h-10 w-10 opacity-50" />
            Aucun push créé. Le module prépare les campagnes; l'envoi réel sera branché au service push existant.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {drafts.map((d) => (
              <div key={d.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full capitalize">{d.status}</Badge>
                    <span className="text-sm font-black text-foreground">{d.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{d.body}</p>
                </div>
                <div className="text-xs text-muted-foreground">{d.audience}</div>
                <Button variant="outline" className="rounded-full" onClick={() => { setForm({ title: d.title, body: d.body, url: d.url, audience: d.audience, scheduledAt: d.scheduledAt ?? "" }); setPreviewOpen(true); }}>
                  <Eye className="mr-2 h-4 w-4" /> Aperçu
                </Button>
              </div>
            ))}
          </div>
        )}
      </MKCard>

      {dialogOpen && (
        <MKCard>
          <div className="border-b border-border px-5 py-4"><h2 className="text-lg font-black leading-tight text-foreground">Nouvelle campagne push</h2></div>
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Message</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
              <div><Label>URL de destination</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
              <div><Label>Audience</Label><Input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></div>
              <div><Label>Date/heure planifiée</Label><Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div>
            </div>
            <PushPreview title={form.title} body={form.body} url={form.url} />
          </div>
          <DialogFooter className="border-t border-border p-5">
            <Button variant="outline" onClick={() => { saveDraft("draft"); }}>Sauver brouillon</Button>
            <Button variant="outline" onClick={() => saveDraft("scheduled")} disabled={!form.scheduledAt}><Clock className="mr-2 h-4 w-4" /> Planifier</Button>
            <Button onClick={() => saveDraft("ready")}><Send className="mr-2 h-4 w-4" /> Préparer</Button>
          </DialogFooter>
        </MKCard>
      )}

      {previewOpen && (
        <MKCard className="max-w-md">
          <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-lg font-black leading-tight text-foreground">Aperçu push</h2><Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>Fermer</Button></div>
          <div className="p-5"><PushPreview title={form.title} body={form.body} url={form.url} /></div>
        </MKCard>
      )}
    </MKPage>
  );
}

function PushPreview({ title, body, url }: { title: string; body: string; url: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-5">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Bell className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="text-sm font-black text-foreground">{title || "Titre de notification"}</div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{body || "Message de notification"}</div>
            <div className="mt-2 truncate text-[11px] font-bold text-primary">{url || "https://nivra-telecom.ca"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}