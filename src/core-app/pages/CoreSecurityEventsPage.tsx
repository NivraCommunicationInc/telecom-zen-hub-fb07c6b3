/**
 * CoreSecurityEventsPage — Security events monitor.
 * Mirrors old admin AdminSecurityEvents.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Search, Eye, RefreshCcw, AlertTriangle, Lock, Key } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreSecurityEventsPage() {
  const [tab, setTab] = useState("security");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data: securityAudit = [], isLoading: l1, refetch: r1 } = useQuery({
    queryKey: ["core-security-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_security_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: authAudit = [], isLoading: l2 } = useQuery({
    queryKey: ["core-auth-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_auth_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: secretAudit = [], isLoading: l3 } = useQuery({
    queryKey: ["core-secret-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_secret_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: otpCodes = [] } = useQuery({
    queryKey: ["core-otp-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_otp_codes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const filterList = (list: any[]) =>
    list.filter((l) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return JSON.stringify(l).toLowerCase().includes(q);
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">Événements de sécurité</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => { r1(); }} className="border-[hsl(220,15%,20%)] text-[hsl(220,10%,60%)] hover:text-white">
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Événements sécu", value: securityAudit.length, icon: Shield },
          { label: "Auth audit", value: authAudit.length, icon: Lock },
          { label: "Secret audit", value: secretAudit.length, icon: Key },
          { label: "OTP codes", value: otpCodes.length, icon: AlertTriangle },
        ].map((s, i) => (
          <div key={i} className="bg-[hsl(220,15%,12%)] rounded-lg border border-[hsl(220,15%,16%)] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className="h-3 w-3 text-[hsl(220,10%,50%)]" />
              <p className="text-[10px] text-[hsl(220,10%,50%)] uppercase">{s.label}</p>
            </div>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />
        <Input
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,18%)]">
          <TabsTrigger value="security">Sécurité ({securityAudit.length})</TabsTrigger>
          <TabsTrigger value="auth">Auth ({authAudit.length})</TabsTrigger>
          <TabsTrigger value="secret">Secrets ({secretAudit.length})</TabsTrigger>
          <TabsTrigger value="otp">OTP ({otpCodes.length})</TabsTrigger>
        </TabsList>

        {/* Security audit tab */}
        <TabsContent value="security">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Action</th>
                  <th className="text-left p-2.5 font-medium">Type cible</th>
                  <th className="text-left p-2.5 font-medium">IP</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                  <th className="text-right p-2.5 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {l1 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,40%)]">Chargement…</td></tr>
                ) : filterList(securityAudit).length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,40%)]">Aucun événement</td></tr>
                ) : (
                  filterList(securityAudit).slice(0, 200).map((e: any) => (
                    <tr key={e.id} className="hover:bg-[hsl(220,15%,12%)]">
                      <td className="p-2.5 text-white font-medium">{e.action}</td>
                      <td className="p-2.5 text-[hsl(220,10%,70%)]">{e.target_type || "—"}</td>
                      <td className="p-2.5 text-[hsl(220,10%,50%)] font-mono">{e.ip_address || "—"}</td>
                      <td className="p-2.5 text-[hsl(220,10%,50%)]">
                        {e.created_at ? format(new Date(e.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                      </td>
                      <td className="p-2.5 text-right">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setSelected(e)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Auth audit tab */}
        <TabsContent value="auth">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Événement</th>
                  <th className="text-left p-2.5 font-medium">Email</th>
                  <th className="text-left p-2.5 font-medium">Request ID</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {filterList(authAudit).slice(0, 200).map((e: any) => (
                  <tr key={e.id} className="hover:bg-[hsl(220,15%,12%)]">
                    <td className="p-2.5 text-white">{e.event}</td>
                    <td className="p-2.5 text-[hsl(220,10%,70%)] font-mono">{e.email}</td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)] font-mono text-[10px]">{e.request_id?.slice(0, 8)}</td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)]">
                      {e.created_at ? format(new Date(e.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Secret audit tab */}
        <TabsContent value="secret">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Événement</th>
                  <th className="text-left p-2.5 font-medium">IP</th>
                  <th className="text-left p-2.5 font-medium">User Agent</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {filterList(secretAudit).slice(0, 200).map((e: any) => (
                  <tr key={e.id} className="hover:bg-[hsl(220,15%,12%)]">
                    <td className="p-2.5 text-white">{e.event}</td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)] font-mono">{e.ip_address || "—"}</td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)] max-w-[200px] truncate">{e.user_agent || "—"}</td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)]">
                      {e.created_at ? format(new Date(e.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* OTP tab */}
        <TabsContent value="otp">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Email</th>
                  <th className="text-left p-2.5 font-medium">Tentatives</th>
                  <th className="text-left p-2.5 font-medium">Expiré</th>
                  <th className="text-left p-2.5 font-medium">Consommé</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {filterList(otpCodes).slice(0, 100).map((o: any) => (
                  <tr key={o.id} className="hover:bg-[hsl(220,15%,12%)]">
                    <td className="p-2.5 text-white font-mono">{o.email}</td>
                    <td className="p-2.5 text-[hsl(220,10%,70%)]">{o.attempts}/{o.max_attempts}</td>
                    <td className="p-2.5">
                      <Badge className={`text-[10px] ${new Date(o.expires_at) < new Date() ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        {new Date(o.expires_at) < new Date() ? "Expiré" : "Valide"}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)]">{o.consumed_at ? "Oui" : "Non"}</td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)]">
                      {o.created_at ? format(new Date(o.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">Détail événement</DialogTitle></DialogHeader>
          {selected?.details && (
            <pre className="bg-[hsl(220,15%,8%)] rounded p-3 overflow-auto max-h-[300px] text-[10px] text-emerald-300">
              {JSON.stringify(selected.details, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
