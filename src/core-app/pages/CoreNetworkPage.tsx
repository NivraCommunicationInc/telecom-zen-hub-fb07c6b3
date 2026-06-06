/**
 * CoreNetworkPage — Network monitoring dashboard.
 * Shows real-time endpoint status, uptime history, and incidents.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Plus, Zap } from "lucide-react";
import { format, subHours } from "date-fns";
import { fr } from "date-fns/locale";

const INCIDENT_TYPE_FR: Record<string, string> = {
  degraded: "Dégradé", partial_outage: "Panne partielle", major_outage: "Panne majeure", maintenance: "Maintenance",
};
const INCIDENT_STATUS_STYLE: Record<string, string> = {
  investigating: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  identified:    "bg-orange-500/15 text-orange-400 border-orange-500/30",
  monitoring:    "bg-sky-500/15 text-sky-400 border-sky-500/30",
  resolved:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};
const ENDPOINT_LABELS: Record<string, string> = {
  portal_client: "Portail client",
  portal_core:   "Portail Core",
  website:       "Site web",
  supabase_api:  "API Supabase",
  email_resend:  "Email (Resend)",
};

export default function CoreNetworkPage() {
  const qc = useQueryClient();
  const [checkLoading, setCheckLoading] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [form, setForm] = useState({ title: "", incident_type: "degraded", severity: "medium", affected_services: "", notes: "" });

  // Last check per endpoint (last 2h)
  const { data: checks = [] } = useQuery({
    queryKey: ["network-uptime-recent"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = subHours(new Date(), 2).toISOString();
      const { data } = await supabase
        .from("network_uptime_checks")
        .select("endpoint_name, is_up, response_time_ms, http_status, checked_at, error_message")
        .gte("checked_at", since)
        .order("checked_at", { ascending: false });
      return data || [];
    },
  });

  // Latest status per endpoint
  const latestByEndpoint: Record<string, any> = {};
  for (const c of checks) {
    if (!latestByEndpoint[c.endpoint_name]) latestByEndpoint[c.endpoint_name] = c;
  }

  // Uptime % per endpoint (last 2h)
  const uptimeByEndpoint: Record<string, number> = {};
  const endpointNames = [...new Set(checks.map((c: any) => c.endpoint_name))];
  for (const ep of endpointNames) {
    const epChecks = checks.filter((c: any) => c.endpoint_name === ep);
    if (epChecks.length > 0) {
      uptimeByEndpoint[ep] = Math.round((epChecks.filter((c: any) => c.is_up).length / epChecks.length) * 100);
    }
  }

  // Open incidents
  const { data: incidents = [] } = useQuery({
    queryKey: ["network-incidents"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("network_incidents")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const openIncidents = incidents.filter((i: any) => i.status !== "resolved");

  const runCheck = async () => {
    setCheckLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("network-uptime-check");
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["network-uptime-recent"] });
      qc.invalidateQueries({ queryKey: ["network-incidents"] });
      const d = data as any;
      toast.success(`${d.up}/${d.checked} endpoints OK`);
    } catch (e: any) {
      toast.error(e.message || "Erreur vérification");
    } finally {
      setCheckLoading(false);
    }
  };

  const resolveIncidentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("network_incidents")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["network-incidents"] }); toast.success("Incident résolu"); },
  });

  const addIncidentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("network_incidents").insert({
        title: form.title,
        incident_type: form.incident_type,
        severity: form.severity,
        affected_services: form.affected_services ? form.affected_services.split(",").map((s) => s.trim()) : [],
        status: "investigating",
        resolution_notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network-incidents"] });
      setIncidentOpen(false);
      setForm({ title: "", incident_type: "degraded", severity: "medium", affected_services: "", notes: "" });
      toast.success("Incident ouvert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const allUp = Object.values(latestByEndpoint).every((c) => c.is_up);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Monitoring réseau</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Uptime plateforme et incidents</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runCheck} disabled={checkLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${checkLoading ? "animate-spin" : ""}`} />Vérifier maintenant
          </Button>
          <Button size="sm" onClick={() => setIncidentOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />Déclarer incident
          </Button>
        </div>
      </div>

      {/* Global status banner */}
      {Object.keys(latestByEndpoint).length > 0 && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${allUp ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
          {allUp
            ? <><CheckCircle2 className="w-5 h-5 text-emerald-400" /><span className="text-sm font-medium text-emerald-400">Tous les services opérationnels</span></>
            : <><AlertTriangle className="w-5 h-5 text-red-400" /><span className="text-sm font-medium text-red-400">Dégradation détectée — {Object.values(latestByEndpoint).filter((c) => !c.is_up).length} endpoint(s) en erreur</span></>
          }
          {Object.keys(latestByEndpoint).length > 0 && (
            <span className="ml-auto text-xs text-[hsl(var(--core-text-label))]">
              Dernière vérif : {format(new Date(Object.values(latestByEndpoint)[0].checked_at), "HH:mm", { locale: fr })}
            </span>
          )}
        </div>
      )}

      {/* Endpoint status grid */}
      <div>
        <h2 className="text-sm font-semibold text-[hsl(var(--core-text-label))] mb-2 uppercase tracking-wide">Endpoints</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(ENDPOINT_LABELS).map(([key, label]) => {
            const c = latestByEndpoint[key];
            const uptime = uptimeByEndpoint[key];
            return (
              <div key={key} className={`p-3 rounded-lg border ${c ? (c.is_up ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5") : "border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[hsl(var(--core-text-primary))]">{label}</span>
                  {c ? (c.is_up
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />
                  ) : <Activity className="w-4 h-4 text-[hsl(var(--core-text-label))]" />}
                </div>
                {c ? (
                  <div className="space-y-0.5">
                    <p className={`text-xs ${c.is_up ? "text-emerald-400" : "text-red-400"}`}>
                      {c.is_up ? "En ligne" : "Hors ligne"} {c.response_time_ms ? `· ${c.response_time_ms}ms` : ""}
                    </p>
                    {uptime !== undefined && (
                      <p className="text-xs text-[hsl(var(--core-text-label))]">Uptime 2h: {uptime}%</p>
                    )}
                    {c.error_message && <p className="text-xs text-red-400 truncate">{c.error_message}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-[hsl(var(--core-text-label))]">Aucune donnée</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Incidents */}
      <div>
        <h2 className="text-sm font-semibold text-[hsl(var(--core-text-label))] mb-2 uppercase tracking-wide">
          Incidents {openIncidents.length > 0 && <span className="text-red-400">({openIncidents.length} ouvert{openIncidents.length > 1 ? "s" : ""})</span>}
        </h2>
        {incidents.length === 0 ? (
          <div className="p-6 text-center rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
            <Zap className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm text-[hsl(var(--core-text-secondary))]">Aucun incident enregistré</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc: any) => (
              <div key={inc.id} className={`p-3 rounded-lg border ${inc.status !== "resolved" ? "border-amber-500/30 bg-amber-500/5" : "border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{inc.title}</span>
                      <Badge className={`text-xs border ${INCIDENT_STATUS_STYLE[inc.status] || ""}`}>{inc.status}</Badge>
                      <Badge variant="outline" className="text-xs">{INCIDENT_TYPE_FR[inc.incident_type] || inc.incident_type}</Badge>
                      <Badge variant="outline" className="text-xs">{inc.severity}</Badge>
                    </div>
                    <div className="text-xs text-[hsl(var(--core-text-secondary))]">
                      Début: {format(new Date(inc.started_at), "d MMM HH:mm", { locale: fr })}
                      {inc.resolved_at && ` · Résolu: ${format(new Date(inc.resolved_at), "d MMM HH:mm", { locale: fr })}`}
                    </div>
                    {inc.affected_services?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {inc.affected_services.map((s: string) => (
                          <span key={s} className="text-xs px-2 py-0.5 rounded bg-[hsl(220,15%,20%)] text-[hsl(var(--core-text-label))]">{ENDPOINT_LABELS[s] || s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {inc.status !== "resolved" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => resolveIncidentMutation.mutate(inc.id)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" />Résoudre
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Declare incident dialog */}
      <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Déclarer un incident réseau</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titre</Label>
              <Input placeholder="ex. Latence élevée portail client" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={form.incident_type} onValueChange={(v) => setForm({ ...form, incident_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCIDENT_TYPE_FR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sévérité</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="critical">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Services affectés (séparés par virgule)</Label>
              <Input placeholder="portal_client, supabase_api" value={form.affected_services} onChange={(e) => setForm({ ...form, affected_services: e.target.value })} /></div>
            <div><Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={() => addIncidentMutation.mutate()} disabled={!form.title || addIncidentMutation.isPending}>
              {addIncidentMutation.isPending ? "Ouverture…" : "Ouvrir incident"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
