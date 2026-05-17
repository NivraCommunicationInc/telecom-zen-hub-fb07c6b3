/**
 * HrPayrollRunsPage — Weekly Friday payroll run management.
 *
 * - Section 1: Next payroll summary (approved commissions before next Thursday 18h EST cutoff).
 * - Section 2: Payroll runs history with drill-in to entries.
 * - Section 3: Employee payroll settings (payment method, BPA, disability rate).
 *
 * Calls the `process-payroll` edge function.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, DollarSign, Download, Loader2, Play, Users } from "lucide-react";
import { toast } from "sonner";

const fmtMoney = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(Number(n) || 0);
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function HrPayrollRunsPage() {
  const qc = useQueryClient();
  const [drillIn, setDrillIn] = useState<string | null>(null);
  const [editAgent, setEditAgent] = useState<any | null>(null);
  const [preview, setPreview] = useState<any | null>(null);

  // Dry-run preview
  const previewMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-payroll", { body: { dry_run: true } });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { setPreview(d); toast.success("Aperçu chargé"); },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'aperçu"),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-payroll", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Paie traitée — ${d.employee_count} employé(s), net ${fmtMoney(d.total_net)}`);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["hr-payroll-runs"] });
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors du traitement"),
  });

  const { data: runs } = useQuery({
    queryKey: ["hr-payroll-runs"],
    queryFn: async () => {
      const { data } = await supabase.from("payroll_runs").select("*").order("pay_date", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const { data: drillEntries } = useQuery({
    queryKey: ["hr-payroll-entries", drillIn],
    enabled: !!drillIn,
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_entries")
        .select("*, profile:profiles!user_id(full_name, email, agent_number)")
        .eq("run_id", drillIn!);
      return data ?? [];
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["hr-payroll-agents"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["field_sales", "field_manager"] as any)
        .eq("is_active", true);
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, agent_number")
        .in("user_id", ids);
      const { data: settings } = await supabase
        .from("employee_payroll_settings")
        .select("*")
        .in("employee_id", ids);
      const map = new Map((settings ?? []).map((s: any) => [s.employee_id, s]));
      return (profiles ?? []).map((p: any) => ({ ...p, settings: map.get(p.user_id) }));
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paie hebdomadaire — Vendredis</h1>
          <p className="text-sm text-muted-foreground">Traitement de la paie basé sur les commissions approuvées avant le jeudi 18h EST.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
            {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
            Aperçu de la prochaine paie
          </Button>
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="bg-[#7C3AED] hover:bg-[#6D28D9]">
            {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Traiter la paie maintenant
          </Button>
        </div>
      </div>

      {/* Preview card */}
      {preview && (
        <Card className="border-violet-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-violet-600" />
              Aperçu — Paie du {fmtDate(preview.pay_date)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <KpiCard icon={Users} label="Agents à payer" value={String(preview.employee_count)} />
              <KpiCard icon={DollarSign} label="Total brut estimé" value={fmtMoney(preview.total_gross)} />
              <KpiCard icon={DollarSign} label="Total déductions" value={fmtMoney(preview.total_deductions)} tone="red" />
              <KpiCard icon={DollarSign} label="Total NET estimé" value={fmtMoney(preview.total_net)} tone="green" />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent ID</TableHead>
                  <TableHead className="text-right">Brut</TableHead>
                  <TableHead className="text-right">Fed</TableHead>
                  <TableHead className="text-right">QC</TableHead>
                  <TableHead className="text-right">RRQ</TableHead>
                  <TableHead className="text-right">AE</TableHead>
                  <TableHead className="text-right">RQAP</TableHead>
                  <TableHead className="text-right">Inv.</TableHead>
                  <TableHead className="text-right">NET</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(preview.employees || []).map((e: any) => (
                  <TableRow key={e.agent_id}>
                    <TableCell className="font-mono text-xs">{String(e.agent_id).slice(0, 8)}…</TableCell>
                    <TableCell className="text-right">{fmtMoney(e.gross)}</TableCell>
                    <TableCell className="text-right text-red-600">-{fmtMoney(e.federal_tax)}</TableCell>
                    <TableCell className="text-right text-red-600">-{fmtMoney(e.quebec_tax)}</TableCell>
                    <TableCell className="text-right text-red-600">-{fmtMoney(e.rrq)}</TableCell>
                    <TableCell className="text-right text-red-600">-{fmtMoney(e.ae)}</TableCell>
                    <TableCell className="text-right text-red-600">-{fmtMoney(e.rqap)}</TableCell>
                    <TableCell className="text-right text-red-600">-{fmtMoney(e.disability_insurance)}</TableCell>
                    <TableCell className="text-right font-bold text-green-700">{fmtMoney(e.net_pay)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Historique des paies</TabsTrigger>
          <TabsTrigger value="settings">Paramètres employés</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Paies traitées</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° de paie</TableHead>
                    <TableHead>Date de paie</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-right">Employés</TableHead>
                    <TableHead className="text-right">Brut</TableHead>
                    <TableHead className="text-right">Déductions</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runs ?? []).map((r: any) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDrillIn(r.id)}>
                      <TableCell className="font-mono text-xs">{r.run_number}</TableCell>
                      <TableCell>{fmtDate(r.pay_date)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(r.period_start)} → {fmtDate(r.period_end)}</TableCell>
                      <TableCell className="text-right">{r.employee_count}</TableCell>
                      <TableCell className="text-right">{fmtMoney(r.total_gross)}</TableCell>
                      <TableCell className="text-right text-red-600">{fmtMoney(r.total_deductions)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-700">{fmtMoney(r.total_net)}</TableCell>
                      <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!runs?.length && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucune paie traitée pour le moment.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Paramètres de paie par employé</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>N° agent</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead className="text-right">BPA fédéral</TableHead>
                    <TableHead className="text-right">BPA Québec</TableHead>
                    <TableHead className="text-right">Inv. (%)</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(agents ?? []).map((a: any) => (
                    <TableRow key={a.user_id}>
                      <TableCell>{a.full_name || a.email}</TableCell>
                      <TableCell className="font-mono text-xs">{a.agent_number || "—"}</TableCell>
                      <TableCell>{a.settings?.payment_method || "interac"}</TableCell>
                      <TableCell className="text-right">{fmtMoney(a.settings?.federal_claim_amount ?? 15705)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(a.settings?.quebec_claim_amount ?? 17183)}</TableCell>
                      <TableCell className="text-right">{((a.settings?.disability_insurance_rate ?? 0.02) * 100).toFixed(2)} %</TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => setEditAgent(a)}>Modifier</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drill-in entries */}
      <Dialog open={!!drillIn} onOpenChange={(o) => !o && setDrillIn(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Détail des entrées de paie</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>N°</TableHead>
                <TableHead className="text-right">Brut</TableHead>
                <TableHead className="text-right">Fed</TableHead>
                <TableHead className="text-right">QC</TableHead>
                <TableHead className="text-right">RRQ</TableHead>
                <TableHead className="text-right">AE</TableHead>
                <TableHead className="text-right">RQAP</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(drillEntries ?? []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{e.profile?.full_name || e.profile?.email || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.payroll_number}</TableCell>
                  <TableCell className="text-right">{fmtMoney(e.total_gross || e.gross_pay)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmtMoney(e.federal_tax)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmtMoney(e.quebec_tax)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmtMoney(e.rrq)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmtMoney(e.ae)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmtMoney(e.rqap)}</TableCell>
                  <TableCell className="text-right font-bold text-green-700">{fmtMoney(e.net_pay)}</TableCell>
                  <TableCell>
                    {(e.paystub_pdf_url || e.pdf_url) && (
                      <a href={e.paystub_pdf_url || e.pdf_url} target="_blank" rel="noreferrer" className="text-violet-600">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Edit settings */}
      <Dialog open={!!editAgent} onOpenChange={(o) => !o && setEditAgent(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Paramètres — {editAgent?.full_name || editAgent?.email}</DialogTitle></DialogHeader>
          {editAgent && <EditAgentSettings agent={editAgent} onSaved={() => { setEditAgent(null); qc.invalidateQueries({ queryKey: ["hr-payroll-agents"] }); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "text-foreground";
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function EditAgentSettings({ agent, onSaved }: { agent: any; onSaved: () => void }) {
  const [paymentMethod, setPaymentMethod] = useState(agent.settings?.payment_method || "interac");
  const [federal, setFederal] = useState(String(agent.settings?.federal_claim_amount ?? 15705));
  const [quebec, setQuebec] = useState(String(agent.settings?.quebec_claim_amount ?? 17183));
  const [disability, setDisability] = useState(String(((agent.settings?.disability_insurance_rate ?? 0.02) * 100).toFixed(2)));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        employee_id: agent.user_id,
        payment_method: paymentMethod,
        federal_claim_amount: Number(federal),
        quebec_claim_amount: Number(quebec),
        disability_insurance_rate: Number(disability) / 100,
        is_active: true,
      };
      const { error } = await supabase.from("employee_payroll_settings").upsert(payload, { onConflict: "employee_id" });
      if (error) throw error;
      toast.success("Paramètres enregistrés");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Méthode de paiement</Label>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="interac">Virement Interac</SelectItem>
            <SelectItem value="direct_deposit">Dépôt direct</SelectItem>
            <SelectItem value="paypal">PayPal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Montant personnel fédéral ($)</Label>
        <Input type="number" value={federal} onChange={(e) => setFederal(e.target.value)} />
      </div>
      <div>
        <Label>Montant personnel Québec ($)</Label>
        <Input type="number" value={quebec} onChange={(e) => setQuebec(e.target.value)} />
      </div>
      <div>
        <Label>Taux d'assurance invalidité (%)</Label>
        <Input type="number" step="0.01" value={disability} onChange={(e) => setDisability(e.target.value)} />
      </div>
      <Button onClick={save} disabled={saving} className="w-full bg-[#7C3AED] hover:bg-[#6D28D9]">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Enregistrer
      </Button>
    </div>
  );
}
