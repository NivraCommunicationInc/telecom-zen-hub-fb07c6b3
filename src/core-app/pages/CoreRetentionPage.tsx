/**
 * CoreRetentionPage — admin view for retention agent.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Heart } from "lucide-react";

export default function CoreRetentionPage() {
  const [actions, setActions] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("retention_actions").select("*").order("created_at", { ascending: false }).limit(100);
      setActions(data ?? []);
    })();
  }, []);

  const sent = actions.filter((a) => a.status === "sent" || a.status === "accepted").length;
  const accepted = actions.filter((a) => a.status === "accepted").length;
  const avgScore = actions.length > 0 ? (actions.reduce((s, a) => s + (a.risk_score ?? 0), 0) / actions.length).toFixed(0) : "0";
  const saved = actions.reduce((s, a) => s + Number(a.revenue_saved ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Heart className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Agent Rétention IA</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Clients à risque</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{actions.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Score moyen</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{avgScore}/100</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Offres envoyées</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{sent}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenu sauvé</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{saved.toFixed(2)}$</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Actions de rétention</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Compte</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Envoyé le</TableHead>
                <TableHead className="text-right">Accepté</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.account_id?.slice(0, 8)}…</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={a.risk_score >= 80 ? "destructive" : "secondary"}>{a.risk_score}</Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline">{a.action_type}</Badge></TableCell>
                  <TableCell><Badge>{a.status}</Badge></TableCell>
                  <TableCell className="text-xs">{a.sent_at ? new Date(a.sent_at).toLocaleString("fr-CA") : "—"}</TableCell>
                  <TableCell className="text-right">{Number(a.revenue_saved ?? 0).toFixed(2)}$</TableCell>
                </TableRow>
              ))}
              {actions.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucune action</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
