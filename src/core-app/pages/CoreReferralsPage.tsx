/**
 * CoreReferralsPage — Nivra Core canonical referral management console
 * Full lifecycle tracking, qualification monitoring, reward queue
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Users, Search, Gift, Clock, CheckCircle, AlertTriangle,
  DollarSign, Eye, Shield, TrendingUp, Loader2, X, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<string, string> = {
  code_used: "Code utilisé",
  order_created: "Commande créée",
  service_activated: "Service activé",
  cycle_1_paid: "Cycle 1 payé",
  cycle_2_paid: "Cycle 2 payé",
  cycle_3_paid: "Cycle 3 payé",
  qualified: "Qualifié",
  reward_pending: "Récompense en attente",
  reward_issued: "Récompense envoyée",
  cancelled: "Annulé",
  disqualified: "Disqualifié",
  fraud_review: "Révision fraude",
};

function statusBadgeClass(status: string) {
  if (["qualified", "reward_pending", "reward_issued"].includes(status))
    return "bg-emerald-600/15 text-emerald-400 border-0";
  if (["cancelled", "disqualified", "fraud_review"].includes(status))
    return "bg-red-500/15 text-red-400 border-0";
  if (status.startsWith("cycle_"))
    return "bg-sky-500/15 text-sky-400 border-0";
  return "bg-amber-500/15 text-amber-400 border-0";
}

export default function CoreReferralsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rewardFilter, setRewardFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rewardNotes, setRewardNotes] = useState("");
  const [rewardRef, setRewardRef] = useState("");

  // Fetch all referrals with referrer/referred profiles
  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["core-client-referrals", statusFilter, rewardFilter],
    queryFn: async () => {
      let query = supabase
        .from("client_referrals" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (rewardFilter !== "all") query = query.eq("reward_status", rewardFilter);

      const { data } = await query;
      return (data as any[]) || [];
    },
  });

  // Get profiles for referrer/referred display
  const userIds = [...new Set(referrals.flatMap((r: any) => [r.referrer_user_id, r.referred_user_id]))];
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["core-referral-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, phone")
        .in("user_id", userIds);
      const map: Record<string, any> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p; });
      return map;
    },
    enabled: userIds.length > 0,
  });

  // Detail + events
  const selected = referrals.find((r: any) => r.id === selectedId);
  const { data: events = [] } = useQuery({
    queryKey: ["core-referral-events", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await supabase
        .from("client_referral_events" as any)
        .select("*")
        .eq("referral_id", selectedId)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!selectedId,
  });

  // Issue reward mutation
  const issueReward = useMutation({
    mutationFn: async (referralId: string) => {
      const { error } = await supabase
        .from("client_referrals" as any)
        .update({
          status: "reward_issued",
          reward_status: "reward_issued",
          reward_issued_at: new Date().toISOString(),
          reward_reference: rewardRef || null,
          notes: rewardNotes || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", referralId);
      if (error) throw error;

      // Log event
      await supabase.from("client_referral_events" as any).insert({
        referral_id: referralId,
        event_type: "reward_issued",
        new_status: "reward_issued",
        details: { reference: rewardRef, notes: rewardNotes },
        actor_type: "admin",
      } as any);
    },
    onSuccess: () => {
      toast.success("Récompense marquée comme envoyée");
      queryClient.invalidateQueries({ queryKey: ["core-client-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["core-referral-events"] });
      setRewardNotes("");
      setRewardRef("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Disqualify mutation
  const disqualify = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("client_referrals" as any)
        .update({
          status: "disqualified",
          reward_status: "cancelled",
          disqualified_at: new Date().toISOString(),
          disqualification_reason: reason,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;

      await supabase.from("client_referral_events" as any).insert({
        referral_id: id,
        event_type: "disqualified",
        new_status: "disqualified",
        details: { reason },
        actor_type: "admin",
      } as any);
    },
    onSuccess: () => {
      toast.success("Parrainage disqualifié");
      queryClient.invalidateQueries({ queryKey: ["core-client-referrals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Flag fraud
  const flagFraud = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_referrals" as any)
        .update({
          status: "fraud_review",
          fraud_flag: true,
          fraud_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;

      await supabase.from("client_referral_events" as any).insert({
        referral_id: id,
        event_type: "fraud_flagged",
        new_status: "fraud_review",
        actor_type: "admin",
      } as any);
    },
    onSuccess: () => {
      toast.success("Marqué pour révision fraude");
      queryClient.invalidateQueries({ queryKey: ["core-client-referrals"] });
    },
  });

  // Filter by search
  const filtered = referrals.filter((r: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const referrer = profilesMap[r.referrer_user_id];
    const referred = profilesMap[r.referred_user_id];
    return (
      r.referral_code_used?.toLowerCase().includes(s) ||
      referrer?.email?.toLowerCase().includes(s) ||
      referred?.email?.toLowerCase().includes(s) ||
      `${referrer?.first_name} ${referrer?.last_name}`.toLowerCase().includes(s) ||
      `${referred?.first_name} ${referred?.last_name}`.toLowerCase().includes(s)
    );
  });

  // Stats
  const stats = {
    total: referrals.length,
    inProgress: referrals.filter((r: any) => !["qualified", "reward_pending", "reward_issued", "cancelled", "disqualified"].includes(r.status)).length,
    rewardPending: referrals.filter((r: any) => r.reward_status === "reward_pending").length,
    rewardIssued: referrals.filter((r: any) => r.reward_status === "reward_issued").length,
    fraudReview: referrals.filter((r: any) => r.status === "fraud_review").length,
  };

  const profileName = (userId: string) => {
    const p = profilesMap[userId];
    if (!p) return "—";
    return `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "—";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Parrainage client</h1>
        <p className="text-sm text-[hsl(var(--core-text-secondary))]">Programme de parrainage Nivra — carte-cadeau 25$ après 3 cycles payés</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { icon: Users, label: "Total", value: stats.total, color: "text-sky-400" },
          { icon: Clock, label: "En cours", value: stats.inProgress, color: "text-amber-400" },
          { icon: Gift, label: "Récompenses en attente", value: stats.rewardPending, color: "text-emerald-400" },
          { icon: CheckCircle, label: "Récompenses envoyées", value: stats.rewardIssued, color: "text-emerald-400" },
          { icon: AlertTriangle, label: "Fraude", value: stats.fraudReview, color: "text-red-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-[hsl(var(--core-text-label))]">{label}</span>
            </div>
            <p className="text-xl font-bold text-[hsl(var(--core-text-primary))]">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
          <Input
            placeholder="Rechercher par code, nom, courriel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rewardFilter} onValueChange={setRewardFilter}>
          <SelectTrigger className="w-[180px] bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)]">
            <SelectValue placeholder="Récompense" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes récompenses</SelectItem>
            <SelectItem value="not_eligible">Non éligible</SelectItem>
            <SelectItem value="in_progress">En progression</SelectItem>
            <SelectItem value="reward_pending">En attente d'envoi</SelectItem>
            <SelectItem value="reward_issued">Envoyée</SelectItem>
            <SelectItem value="cancelled">Annulée</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[hsl(220,15%,16%)] hover:bg-transparent">
              <TableHead className="text-[hsl(var(--core-text-label))]">Date</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Code</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Parrain</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Filleul</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Progression</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Statut</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Récompense</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-[hsl(var(--core-text-label))]">Aucun parrainage</TableCell></TableRow>
            ) : filtered.map((r: any) => (
              <TableRow key={r.id} className="border-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,13%)]">
                <TableCell className="text-[hsl(var(--core-text-secondary))] text-sm">
                  {new Date(r.created_at).toLocaleDateString("fr-CA")}
                </TableCell>
                <TableCell className="font-mono text-sm text-emerald-400">{r.referral_code_used}</TableCell>
                <TableCell>
                  <Link to={`/core/clients/${r.referrer_user_id}`} className="text-sm text-[hsl(var(--core-text-primary))] hover:text-emerald-400">
                    {profileName(r.referrer_user_id)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link to={`/core/clients/${r.referred_user_id}`} className="text-sm text-[hsl(var(--core-text-primary))] hover:text-emerald-400">
                    {profileName(r.referred_user_id)}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-[hsl(220,15%,20%)] overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((r.qualifying_cycles_paid || 0) / (r.required_cycles || 3)) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-[hsl(var(--core-text-label))]">{r.qualifying_cycles_paid || 0}/{r.required_cycles || 3}</span>
                  </div>
                </TableCell>
                <TableCell><Badge className={statusBadgeClass(r.status)}>{STATUS_LABELS[r.status] || r.status}</Badge></TableCell>
                <TableCell>
                  {r.reward_status === "reward_issued" && <Badge className="bg-emerald-600/15 text-emerald-400 border-0">{r.reward_amount}$ envoyé</Badge>}
                  {r.reward_status === "reward_pending" && <Badge className="bg-amber-500/15 text-amber-400 border-0">En attente</Badge>}
                  {r.reward_status === "in_progress" && <Badge className="bg-sky-500/15 text-sky-400 border-0">En cours</Badge>}
                  {r.fraud_flag && <Badge className="bg-red-500/15 text-red-400 border-0 ml-1">⚠ Fraude</Badge>}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedId(r.id)} className="text-[hsl(var(--core-text-label))] hover:text-[hsl(var(--core-text-primary))]">
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px] bg-[hsl(220,15%,9%)] border-[hsl(220,15%,16%)] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-[hsl(var(--core-text-primary))]">Détail du parrainage</SheetTitle>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Status */}
                <div className="flex gap-2 flex-wrap">
                  <Badge className={`${statusBadgeClass(selected.status)} text-sm`}>{STATUS_LABELS[selected.status]}</Badge>
                  {selected.fraud_flag && <Badge className="bg-red-500/15 text-red-400 border-0">⚠ Fraude</Badge>}
                </div>

                {/* Referrer */}
                <div className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
                  <p className="text-xs text-[hsl(var(--core-text-label))] mb-1">Parrain</p>
                  <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{profileName(selected.referrer_user_id)}</p>
                  <p className="text-xs text-[hsl(var(--core-text-secondary))]">{profilesMap[selected.referrer_user_id]?.email}</p>
                  <Link to={`/core/clients/${selected.referrer_user_id}`} className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mt-1">
                    Voir le dossier <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {/* Referred */}
                <div className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
                  <p className="text-xs text-[hsl(var(--core-text-label))] mb-1">Filleul</p>
                  <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{profileName(selected.referred_user_id)}</p>
                  <p className="text-xs text-[hsl(var(--core-text-secondary))]">{profilesMap[selected.referred_user_id]?.email}</p>
                  <Link to={`/core/clients/${selected.referred_user_id}`} className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mt-1">
                    Voir le dossier <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {/* Code */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
                    <p className="text-xs text-[hsl(var(--core-text-label))]">Code utilisé</p>
                    <p className="text-sm font-mono text-emerald-400 mt-1">{selected.referral_code_used}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
                    <p className="text-xs text-[hsl(var(--core-text-label))]">Récompense</p>
                    <p className="text-sm font-medium text-[hsl(var(--core-text-primary))] mt-1">{selected.reward_amount}$ — Carte-cadeau</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
                  <p className="text-xs text-[hsl(var(--core-text-label))] mb-2">Progression qualification</p>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((c) => (
                      <div
                        key={c}
                        className={`flex-1 h-3 rounded ${(selected.qualifying_cycles_paid || 0) >= c ? "bg-emerald-500" : "bg-[hsl(220,15%,20%)]"}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-[hsl(var(--core-text-secondary))] mt-1">{selected.qualifying_cycles_paid || 0} / {selected.required_cycles || 3} cycles de facturation payés</p>
                </div>

                {/* Links */}
                <div className="grid grid-cols-2 gap-3">
                  {selected.referred_order_id && (
                    <Link to={`/core/orders/${selected.referred_order_id}`} className="p-2 rounded border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] text-xs text-emerald-400 hover:bg-[hsl(220,15%,14%)] flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Commande
                    </Link>
                  )}
                  {selected.referred_subscription_id && (
                    <Link to={`/core/subscriptions/${selected.referred_subscription_id}`} className="p-2 rounded border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] text-xs text-emerald-400 hover:bg-[hsl(220,15%,14%)] flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Abonnement
                    </Link>
                  )}
                </div>

                {/* Actions */}
                {selected.reward_status === "reward_pending" && (
                  <div className="space-y-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-sm font-medium text-emerald-400">Émettre la récompense</p>
                    <Input
                      placeholder="Référence carte-cadeau (optionnel)"
                      value={rewardRef}
                      onChange={(e) => setRewardRef(e.target.value)}
                      className="bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)]"
                    />
                    <Textarea
                      placeholder="Notes (optionnel)"
                      value={rewardNotes}
                      onChange={(e) => setRewardNotes(e.target.value)}
                      className="bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)]"
                      rows={2}
                    />
                    <Button
                      onClick={() => issueReward.mutate(selected.id)}
                      disabled={issueReward.isPending}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Gift className="w-4 h-4 mr-2" />
                      Marquer comme envoyé ({selected.reward_amount}$)
                    </Button>
                  </div>
                )}

                {selected.reward_status === "reward_issued" && (
                  <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-sm text-emerald-400">✅ Récompense envoyée le {selected.reward_issued_at ? new Date(selected.reward_issued_at).toLocaleDateString("fr-CA") : "—"}</p>
                    {selected.reward_reference && <p className="text-xs text-[hsl(var(--core-text-secondary))] mt-1">Réf: {selected.reward_reference}</p>}
                  </div>
                )}

                {!["cancelled", "disqualified", "reward_issued"].includes(selected.status) && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => flagFraud.mutate(selected.id)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Shield className="w-4 h-4 mr-1" /> Fraude
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const reason = prompt("Raison de la disqualification:");
                        if (reason) disqualify.mutate({ id: selected.id, reason });
                      }}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <X className="w-4 h-4 mr-1" /> Disqualifier
                    </Button>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <p className="text-xs font-medium text-[hsl(var(--core-text-label))] mb-2">Historique</p>
                  <div className="space-y-2">
                    {events.map((e: any) => (
                      <div key={e.id} className="flex gap-2 text-xs">
                        <span className="text-[hsl(var(--core-text-label))] shrink-0 w-20">
                          {new Date(e.created_at).toLocaleDateString("fr-CA")}
                        </span>
                        <span className="text-[hsl(var(--core-text-secondary))]">
                          {e.event_type} → {e.new_status || "—"}
                        </span>
                      </div>
                    ))}
                    {events.length === 0 && (
                      <p className="text-xs text-[hsl(var(--core-text-label))]">Aucun événement</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
