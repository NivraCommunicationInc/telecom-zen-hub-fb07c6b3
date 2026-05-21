/**
 * CoreMarketingAgentPage — admin view for AI marketing campaigns.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Megaphone, Sparkles, Send } from "lucide-react";

const SEGMENTS = [
  { v: "all_active", l: "Tous les clients actifs" },
  { v: "internet_only", l: "Internet uniquement" },
  { v: "no_tv", l: "Sans TV" },
  { v: "high_value", l: "Haute valeur" },
  { v: "no_mobile", l: "Sans mobile" },
  { v: "new_30days", l: "Nouveaux (<30j)" },
  { v: "long_term_1year", l: "Fidèles (>1 an)" },
  { v: "at_risk", l: "À risque" },
  { v: "churned_90days", l: "Anciens (<90j)" },
];

export default function CoreMarketingAgentPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [segment, setSegment] = useState("all_active");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false }).limit(50);
    setCampaigns(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const createAI = async () => {
    setCreating(true);
    try {
      const { error } = await supabase.functions.invoke("agent-marketing", { body: { action: "create_ai_campaign", segment } });
      if (error) throw error;
      toast.success("Campagne générée par l'IA");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); } finally { setCreating(false); }
  };

  const send = async (id: string) => {
    setSending(id);
    try {
      const { error } = await supabase.functions.invoke("agent-marketing", { body: { action: "send_campaign", campaign_id: id } });
      if (error) throw error;
      toast.success("Campagne envoyée");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); } finally { setSending(null); }
  };

  const totalSent = campaigns.reduce((s, c) => s + (c.sent_count ?? 0), 0);
  const totalOpen = campaigns.reduce((s, c) => s + (c.open_count ?? 0), 0);
  const openRate = totalSent > 0 ? ((totalOpen / totalSent) * 100).toFixed(1) : "0";
  const totalRev = campaigns.reduce((s, c) => s + Number(c.revenue_generated ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Agent Marketing IA</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Campagnes actives</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{campaigns.filter((c) => c.status === "running").length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Emails envoyés</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{totalSent}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Taux d'ouverture</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{openRate}%</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenus générés</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{totalRev.toFixed(2)}$</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Créer une campagne avec IA</CardTitle></CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="md:w-80"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={createAI} disabled={creating}>{creating ? "Génération…" : "Générer avec Gemini"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Campagnes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Envoyés</TableHead>
                <TableHead className="text-right">Ouvertures</TableHead>
                <TableHead className="text-right">Revenus</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}{c.ai_generated && <Badge variant="secondary" className="ml-2">IA</Badge>}</TableCell>
                  <TableCell><Badge variant="outline">{c.target_segment}</Badge></TableCell>
                  <TableCell><Badge>{c.status}</Badge></TableCell>
                  <TableCell className="text-right">{c.sent_count}</TableCell>
                  <TableCell className="text-right">{c.open_count}</TableCell>
                  <TableCell className="text-right">{Number(c.revenue_generated ?? 0).toFixed(2)}$</TableCell>
                  <TableCell>
                    {c.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => send(c.id)} disabled={sending === c.id}>
                        <Send className="h-3 w-3 mr-1" />{sending === c.id ? "Envoi…" : "Envoyer"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {campaigns.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Aucune campagne</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
