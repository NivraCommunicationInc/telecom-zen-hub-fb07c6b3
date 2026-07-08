/**
 * CoreReferralsPage — Nivra Core canonical referral management console
 * Full lifecycle tracking, qualification monitoring, reward queue, KPI dashboard
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  CreditCard, BarChart3, Target, Ban,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { AdminReferralAdvancedDialog } from "@/core-app/components/loyalty/AdminReferralAdvancedDialog";

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
  const [tab, setTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rewardFilter, setRewardFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rewardNotes, setRewardNotes] = useState("");
  const [rewardRef, setRewardRef] = useState("");

  // Fetch all referrals
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

  // Get profiles for referrer/referred
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

  // Issue reward
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

  // Disqualify
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

  // Stats
  const stats = {
    total: referrals.length,
    inProgress: referrals.filter((r: any) => !["qualified", "reward_pending", "reward_issued", "cancelled", "disqualified"].includes(r.status)).length,
    rewardPending: referrals.filter((r: any) => r.reward_status === "reward_pending").length,
    rewardIssued: referrals.filter((r: any) => r.reward_status === "reward_issued").length,
    fraudReview: referrals.filter((r: any) => r.status === "fraud_review").length,
    disqualified: referrals.filter((r: any) => r.status === "disqualified").length,
    totalPaid: referrals.filter((r: any) => r.reward_status === "reward_issued").reduce((s: number, r: any) => s + Number(r.reward_amount || 0), 0),
    conversionRate: referrals.length > 0
      ? Math.round((referrals.filter((r: any) => ["qualified", "reward_pending", "reward_issued"].includes(r.status)).length / referrals.length) * 100)
      : 0,
  };

  // Tab-based filtering
  const tabFiltered = referrals.filter((r: any) => {
    if (tab === "pending") return r.reward_status === "reward_pending";
    if (tab === "fraud") return r.status === "fraud_review";
    if (tab === "issued") return r.reward_status === "reward_issued";
    return true;
  });

  // Search filter
  const profileName = (userId: string) => {
    const p = profilesMap[userId];
    if (!p) return "—";
    return `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "—";
  };

  const filtered = tabFiltered.filter((r: any) => {
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Parrainage client</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Programme de parrainage Nivra — carte-cadeau 25$ après 3 cycles payés</p>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { icon: Users, label: "Total", value: stats.total, color: "text-sky-400", bg: "bg-sky-500/10" },
          { icon: Clock, label: "En cours", value: stats.inProgress, color: "text-amber-400", bg: "bg-amber-500/10" },
          { icon: Gift, label: "À émettre", value: stats.rewardPending, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { icon: CheckCircle, label: "Émises", value: stats.rewardIssued, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { icon: AlertTriangle, label: "Fraude", value: stats.fraudReview, color: "text-red-400", bg: "bg-red-500/10" },
          { icon: Ban, label: "Disqualifiés", value: stats.disqualified, color: "text-red-400", bg: "bg-red-500/10" },
          { icon: DollarSign, label: "Total payé", value: `${stats.totalPaid}$`, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { icon: Target, label: "Conversion", value: `${stats.conversionRate}%`, color: "text-sky-400", bg: "bg-sky-500/10" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-6 h-6 rounded ${bg} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
            </div>
            <p className="text-lg font-bold text-[hsl(var(--core-text-primary))]">{value}</p>
            <p className="text-[10px] text-[hsl(var(--core-text-label))]">{label}</p>
          </div>
        ))}
      </div>

      {/* Reward Queue Alert */}
      {stats.rewardPending > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <Gift className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400 font-medium">
            {stats.rewardPending} récompense{stats.rewardPending > 1 ? "s" : ""} en attente d'émission
          </p>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => setTab("pending")}
          >
            Voir la file
          </Button>
        </div>
      )}

      {/* Tabs + Filters */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList className="bg-[hsl(220,15%,11%)] border border-[hsl(220,15%,16%)]">
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="pending" className="gap-1">
              À émettre
              {stats.rewardPending > 0 && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px] px-1.5">{stats.rewardPending}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="fraud" className="gap-1">
              Fraude
              {stats.fraudReview > 0 && <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px] px-1.5">{stats.fraudReview}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="issued">Émises</TabsTrigger>
          </TabsList>

          <div className="flex gap-2 flex-wrap">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))] h-9"
              />
            </div>
            {tab === "all" && (
              <>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)] h-9">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous statuts</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={rewardFilter} onValueChange={setRewardFilter}>
                  <SelectTrigger className="w-[160px] bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)] h-9">
                    <SelectValue placeholder="Récompense" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="not_eligible">Non éligible</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="reward_pending">En attente</SelectItem>
                    <SelectItem value="reward_issued">Envoyée</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        {/* Table for all tabs */}
        <TabsContent value={tab} className="mt-4">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[hsl(220,15%,16%)] hover:bg-transparent">
                  <TableHead className="text-[hsl(var(--core-text-label))]">Date</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))]">Code</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))]">Parrain</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))]">Filleul</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))]">Cycles</TableHead>
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
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3].map(c => (
                          <div key={c} className={`w-5 h-1.5 rounded-full ${(r.qualifying_cycles_paid || 0) >= c ? "bg-emerald-500" : "bg-[hsl(220,15%,20%)]"}`} />
                        ))}
                        <span className="text-xs text-[hsl(var(--core-text-label))] ml-1">{r.qualifying_cycles_paid || 0}/3</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={statusBadgeClass(r.status)}>{STATUS_LABELS[r.status] || r.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {r.reward_status === "reward_issued" && <Badge className="bg-emerald-600/15 text-emerald-400 border-0">{r.reward_amount}$ ✓</Badge>}
                        {r.reward_status === "reward_pending" && <Badge className="bg-amber-500/15 text-amber-400 border-0">⏳ {r.reward_amount}$</Badge>}
                        {r.reward_status === "in_progress" && <Badge className="bg-sky-500/15 text-sky-400 border-0">En cours</Badge>}
                        {r.fraud_flag && <Badge className="bg-red-500/15 text-red-400 border-0">⚠</Badge>}
                      </div>
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
        </TabsContent>
      </Tabs>

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px] bg-[hsl(220,15%,9%)] border-[hsl(220,15%,16%)] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-[hsl(var(--core-text-primary))]">Détail du parrainage</SheetTitle>
              </SheetHeader>

              <div className="space-y-5 mt-5">
                {/* Status */}
                <div className="flex gap-2 flex-wrap items-center">
                  <Badge className={`${statusBadgeClass(selected.status)} text-sm`}>{STATUS_LABELS[selected.status]}</Badge>
                  {selected.fraud_flag && <Badge className="bg-red-500/15 text-red-400 border-0">⚠ Fraude</Badge>}
                  <Button size="sm" variant="outline" className="ml-auto"
                    onClick={() => setAdvancedOpen(true)}>
                    Actions avancées
                  </Button>
                </div>

                {/* Referrer & Referred */}
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: "Parrain", userId: selected.referrer_user_id },
                    { label: "Filleul", userId: selected.referred_user_id },
                  ].map(({ label, userId }) => (
                    <div key={label} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
                      <p className="text-xs text-[hsl(var(--core-text-label))] mb-1">{label}</p>
                      <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{profileName(userId)}</p>
                      <p className="text-xs text-[hsl(var(--core-text-secondary))]">{profilesMap[userId]?.email}</p>
                      <Link to={`/core/clients/${userId}`} className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mt-1">
                        Voir le dossier <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Code & Reward */}
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
                  <p className="text-xs text-[hsl(var(--core-text-secondary))] mt-1">{selected.qualifying_cycles_paid || 0} / {selected.required_cycles || 3} cycles payés</p>
                </div>

                {/* Entity links */}
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

                {/* Issue reward */}
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

                {/* Fraud / Disqualify */}
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
