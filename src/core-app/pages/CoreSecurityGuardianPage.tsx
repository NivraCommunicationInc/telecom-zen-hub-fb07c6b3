/**
 * CoreSecurityGuardianPage — Security Guardian dashboard.
 * Mirrors old admin AdminSecurityGuardian.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Search, Eye, RefreshCcw, Lock, CheckCircle, AlertTriangle, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { ProfileName } from "@/hooks/useProfileName";

export default function CoreSecurityGuardianPage() {
  const [tab, setTab] = useState("sessions");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const queryClient = useQueryClient();

  // Admin audit sessions (magic links / impersonation)
  const { data: sessions = [], isLoading: l1 } = useQuery({
    queryKey: ["core-guardian-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_sessions")
        .select("*")
        .order("issued_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // OTP sessions
  const { data: otpSessions = [] } = useQuery({
    queryKey: ["core-guardian-otp-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_otp_sessions")
        .select("*")
        .order("verified_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Secret attempts
  const { data: secretAttempts = [] } = useQuery({
    queryKey: ["core-guardian-secret-attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_secret_attempts")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Account access logs
  const { data: accessLogs = [] } = useQuery({
    queryKey: ["core-guardian-access-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_audit_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session révoquée");
      queryClient.invalidateQueries({ queryKey: ["core-guardian-sessions"] });
    },
  });

  const filterList = (list: any[]) =>
    list.filter((l) => {
      if (!search.trim()) return true;
      return JSON.stringify(l).toLowerCase().includes(search.toLowerCase());
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">Security Guardian</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries()} className="border-[hsl(220,15%,20%)] text-[hsl(220,10%,60%)] hover:text-white">
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sessions admin", value: sessions.length, icon: Lock, color: "text-amber-400" },
          { label: "Sessions OTP", value: otpSessions.length, icon: Shield, color: "text-blue-400" },
          { label: "Tentatives secret", value: secretAttempts.length, icon: AlertTriangle, color: "text-red-400" },
          { label: "Accès comptes", value: accessLogs.length, icon: Users, color: "text-emerald-400" },
        ].map((s, i) => (
          <div key={i} className="bg-[hsl(220,15%,12%)] rounded-lg border border-[hsl(220,15%,16%)] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className="h-3 w-3 text-[hsl(220,10%,50%)]" />
              <p className="text-[10px] text-[hsl(220,10%,50%)] uppercase">{s.label}</p>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-8 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,18%)]">
          <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
          <TabsTrigger value="otp">OTP ({otpSessions.length})</TabsTrigger>
          <TabsTrigger value="secrets">Secrets ({secretAttempts.length})</TabsTrigger>
          <TabsTrigger value="access">Accès ({accessLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Admin</th>
                  <th className="text-left p-2.5 font-medium">Cible</th>
                  <th className="text-left p-2.5 font-medium">Raison</th>
                  <th className="text-left p-2.5 font-medium">Statut</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                  <th className="text-right p-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {filterList(sessions).slice(0, 100).map((s: any) => {
                  const isRevoked = !!s.revoked_at;
                  const isExpired = new Date(s.expires_at) < new Date();
                  const isConsumed = !!s.consumed_at;
                  const status = isRevoked ? "Révoqué" : isExpired ? "Expiré" : isConsumed ? "Consommé" : "Actif";
                  const statusColor = isRevoked ? "bg-red-500/20 text-red-400" : isExpired ? "bg-gray-500/20 text-gray-400" : isConsumed ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400";
                  return (
                    <tr key={s.id} className="hover:bg-[hsl(220,15%,12%)]">
                      <td className="p-2.5 text-[hsl(220,10%,70%)] font-mono text-[10px]">{s.admin_email || "—"}</td>
                      <td className="p-2.5 text-white">{s.target_email}</td>
                      <td className="p-2.5 text-[hsl(220,10%,60%)] max-w-[150px] truncate">{s.reason}</td>
                      <td className="p-2.5"><Badge className={`text-[10px] ${statusColor}`}>{status}</Badge></td>
                      <td className="p-2.5 text-[hsl(220,10%,50%)]">
                        {s.issued_at ? format(new Date(s.issued_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                      </td>
                      <td className="p-2.5 text-right">
                        {!isRevoked && !isExpired && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-400" onClick={() => revokeMutation.mutate(s.id)}>
                            Révoquer
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="otp">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Admin</th>
                  <th className="text-left p-2.5 font-medium">Vérifié</th>
                  <th className="text-left p-2.5 font-medium">Expire</th>
                  <th className="text-left p-2.5 font-medium">Révoqué</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {filterList(otpSessions).slice(0, 100).map((o: any) => (
                  <tr key={o.id} className="hover:bg-[hsl(220,15%,12%)]">
                    <td className="p-2.5 text-white text-[11px]"><ProfileName userId={o.admin_user_id} /></td>
                    <td className="p-2.5 text-[hsl(220,10%,70%)]">
                      {o.verified_at ? format(new Date(o.verified_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                    </td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)]">
                      {o.expires_at ? format(new Date(o.expires_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                    </td>
                    <td className="p-2.5">{o.revoked_at ? <Badge className="text-[10px] bg-red-500/20 text-red-400">Oui</Badge> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="secrets">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Admin</th>
                  <th className="text-left p-2.5 font-medium">Tentatives</th>
                  <th className="text-left p-2.5 font-medium">Verrouillé</th>
                  <th className="text-left p-2.5 font-medium">Dernière MAJ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {filterList(secretAttempts).slice(0, 100).map((s: any) => (
                  <tr key={s.id} className="hover:bg-[hsl(220,15%,12%)]">
                    <td className="p-2.5 text-white text-[11px]"><ProfileName userId={s.admin_user_id} /></td>
                    <td className="p-2.5 text-[hsl(220,10%,70%)]">{s.attempts}</td>
                    <td className="p-2.5">
                      {s.locked_until ? (
                        <Badge className="text-[10px] bg-red-500/20 text-red-400">
                          Jusqu'à {format(new Date(s.locked_until), "HH:mm", { locale: fr })}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)]">
                      {s.updated_at ? format(new Date(s.updated_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="access">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Staff</th>
                  <th className="text-left p-2.5 font-medium">Client</th>
                  <th className="text-left p-2.5 font-medium">Méthode</th>
                  <th className="text-left p-2.5 font-medium">Raison</th>
                  <th className="text-left p-2.5 font-medium">Accordé</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {filterList(accessLogs).slice(0, 100).map((a: any) => (
                  <tr key={a.id} className="hover:bg-[hsl(220,15%,12%)]">
                    <td className="p-2.5 text-white font-mono text-[10px]">{a.staff_user_id?.slice(0, 8)}</td>
                    <td className="p-2.5 text-[hsl(220,10%,70%)] font-mono text-[10px]">{a.client_user_id?.slice(0, 8)}</td>
                    <td className="p-2.5"><Badge variant="outline" className="text-[10px]">{a.method}</Badge></td>
                    <td className="p-2.5 text-[hsl(220,10%,60%)] max-w-[150px] truncate">{a.reason}</td>
                    <td className="p-2.5">
                      <Badge className={`text-[10px] ${a.access_granted ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        {a.access_granted ? "Oui" : "Non"}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-[hsl(220,10%,50%)]">
                      {a.created_at ? format(new Date(a.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
