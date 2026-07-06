/** MarketingAutomationsPage — éditeur simple de séquences marketing. */
import { useState } from "react";
import { MKPage, MKCard, MKCardHeader, MKStat } from "./_marketing-ui";
import MarketingNav from "./MarketingNav";
import { Zap, Clock, Mail, MessageSquare, Bell, Plus, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type Step = { id: string; type: "email" | "sms" | "push" | "wait"; title: string; detail: string };
type Automation = { id: string; name: string; trigger: string; status: "draft" | "active"; steps: Step[] };

const STARTER_STEPS: Step[] = [
  { id: "s1", type: "email", title: "Email de bienvenue", detail: "Envoyer immédiatement" },
  { id: "s2", type: "wait", title: "Attendre 2 jours", detail: "Pause avant relance" },
  { id: "s3", type: "sms", title: "Relance SMS", detail: "Court rappel si aucun achat" },
];

const TYPE_ICON = { email: Mail, sms: MessageSquare, push: Bell, wait: Clock } as const;

export default function MarketingAutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Bienvenue nouveau prospect");
  const [trigger, setTrigger] = useState("Contact ajouté à une audience");
  const [steps, setSteps] = useState<Step[]>(STARTER_STEPS);

  const addStep = (type: Step["type"]) => {
    const labels = {
      email: ["Nouvel email", "Sujet + contenu email"],
      sms: ["Nouveau SMS", "Message court"],
      push: ["Nouveau push", "Notification navigateur"],
      wait: ["Attendre", "Délai avant prochaine action"],
    } as const;
    setSteps((prev) => [...prev, { id: crypto.randomUUID(), type, title: labels[type][0], detail: labels[type][1] }]);
  };

  const save = (status: Automation["status"]) => {
    if (!name.trim()) return toast.error("Nom requis");
    setAutomations((prev) => [{ id: crypto.randomUUID(), name: name.trim(), trigger: trigger.trim(), status, steps }, ...prev]);
    toast.success(status === "active" ? "Automation activée" : "Automation sauvegardée");
    setOpen(false);
  };

  return (
    <MKPage
      title="Automations"
      subtitle="Séquences multi-canaux: déclencheur, attentes, emails, SMS et push."
      actions={<Button size="sm" className="rounded-full font-black" onClick={() => setOpen(true)}><Zap className="h-4 w-4 mr-1.5" /> Nouvelle automation</Button>}
    >
      <MarketingNav />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MKStat label="Automations" value={automations.length} icon={Zap} />
        <MKStat label="Actives" value={automations.filter((a) => a.status === "active").length} icon={Play} accent="hsl(var(--success))" />
        <MKStat label="Étapes" value={automations.reduce((n, a) => n + a.steps.length, 0)} icon={Clock} />
        <MKStat label="Canaux" value="3" icon={Bell} accent="hsl(var(--accent))" />
      </div>

      <MKCard>
        <MKCardHeader title="Automations créées" />
        {automations.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">Aucune automation. Crée une séquence depuis les templates ci-dessous.</div>
        ) : (
          <div className="divide-y divide-border">
            {automations.map((a) => (
              <div key={a.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><Badge className="rounded-full capitalize">{a.status}</Badge><span className="font-black text-foreground">{a.name}</span></div>
                    <div className="mt-1 text-xs text-muted-foreground">Déclencheur: {a.trigger}</div>
                  </div>
                  <div className="text-xs font-bold text-muted-foreground">{a.steps.length} étapes</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.steps.map((s) => {
                    const Icon = TYPE_ICON[s.type];
                    return <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-bold"><Icon className="h-3 w-3" />{s.title}</span>;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </MKCard>

      <MKCard>
        <MKCardHeader title="Templates d'automation" />
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: "Bienvenue nouveau client", desc: "3 emails sur 7 jours après activation" },
            { name: "Relance panier abandonné", desc: "Rappel à H+1, H+24, H+72" },
            { name: "Anniversaire client", desc: "Email + code promo annuel" },
            { name: "Réactivation inactifs", desc: "Séquence 90 jours sans activité" },
            { name: "Onboarding lead CRM", desc: "Nurturing lead → client" },
            { name: "Renouvellement abonnement", desc: "Rappel J-15 / J-7 / J-1" },
          ].map((t) => (
            <button key={t.name} className="rounded-xl bg-card border border-border p-4 text-left hover:border-primary" onClick={() => { setName(t.name); setOpen(true); }}>
              <div className="text-foreground font-black text-sm mb-1">{t.name}</div>
              <div className="text-muted-foreground text-xs">{t.desc}</div>
              <div className="mt-3 text-xs font-black text-primary">Utiliser ce template</div>
            </button>
          ))}
        </div>
      </MKCard>

      {open && (
        <MKCard className="overflow-hidden">
          <div className="border-b border-border px-5 py-4"><h2 className="text-lg font-black leading-tight text-foreground">Builder automation</h2></div>
          <div className="grid gap-5 p-5 md:grid-cols-[.8fr_1.2fr]">
            <div className="space-y-3">
              <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Déclencheur</Label><Input value={trigger} onChange={(e) => setTrigger(e.target.value)} /></div>
              <div><Label>Notes internes</Label><Textarea rows={5} placeholder="Objectif, audience, conditions…" /></div>
              <div className="flex flex-wrap gap-2">
                {(["email", "sms", "push", "wait"] as Step["type"][]).map((type) => {
                  const Icon = TYPE_ICON[type];
                  return <Button key={type} type="button" variant="outline" size="sm" onClick={() => addStep(type)}><Plus className="mr-1 h-3 w-3" /><Icon className="mr-1 h-3 w-3" />{type}</Button>;
                })}
              </div>
            </div>
            <div className="space-y-3">
              {steps.map((s, i) => {
                const Icon = TYPE_ICON[s.type];
                return (
                  <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black">{i + 1}</span><Icon className="h-4 w-4 text-primary" /></div>
                      <Button variant="ghost" size="icon" onClick={() => setSteps((prev) => prev.filter((x) => x.id !== s.id))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <Input value={s.title} onChange={(e) => setSteps((prev) => prev.map((x) => x.id === s.id ? { ...x, title: e.target.value } : x))} />
                      <Input value={s.detail} onChange={(e) => setSteps((prev) => prev.map((x) => x.id === s.id ? { ...x, detail: e.target.value } : x))} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="border-t border-border p-5">
            <Button variant="outline" onClick={() => save("draft")}>Sauver brouillon</Button>
            <Button onClick={() => save("active")}><Play className="mr-2 h-4 w-4" /> Activer</Button>
          </DialogFooter>
        </MKCard>
      )}
    </MKPage>
  );
}
