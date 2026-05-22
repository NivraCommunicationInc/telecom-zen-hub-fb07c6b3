/**
 * CoreReferralRewardsPage — Full operational referral management console
 * Sections: Referral list, detail drawer, reward management, filters, lifecycle tracking
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { DataTable, Column } from "@/components/admin/ui/DataTable";
import { StatusBadge, statusToVariant, StatusVariant } from "@/components/admin/ui/StatusBadge";
import {
  Gift, CheckCircle, Clock, DollarSign, Loader2, CreditCard, Search,
  AlertTriangle, ShieldAlert, Eye, Send, PackageCheck, X, Users, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

/* ── Status mappings ── */
const REFERRAL_STATUS_LABELS: Record<string, string> = {
  pending: "Code Used",
  code_used: "Code Used",
  order_created: "Order Created",
  service_activated: "Service Activated",
  cycle_1_paid: "Billing Cycle 1/2",
  cycle_2_paid: "Billing Cycle 2/2",
  qualified: "Qualified",
  reward_pending: "Reward Pending",
  reward_issued: "Reward Issued",
  reward_sent: "Reward Sent",
  cancelled: "Cancelled",
  disqualified: "Disqualified",
  fraud_review: "Fraud Review",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  paypal: "PayPal",
  interac: "Interac",
  gift_card: "Gift Card",
};

const REWARD_STATUS_LABELS: Record<string, string> = {
  not_eligible: "Not Eligible",
  in_progress: "In Progress",
  qualified: "Qualified",
  reward_pending: "Pending",
  reward_issued: "Issued",
  cancelled: "Cancelled",
};


function referralStatusVariant(status: string): StatusVariant {
  if (["qualified", "reward_issued", "reward_sent"].includes(status)) return "success";
  if (["cycle_1_paid", "cycle_2_paid", "reward_pending", "order_created", "service_activated"].includes(status)) return "warning";
  if (["fraud_review"].includes(status)) return "danger";
  if (["cancelled", "disqualified"].includes(status)) return "danger";
  if (["code_used"].includes(status)) return "info";
  return "neutral";
}

function rewardStatusVariant(status: string): StatusVariant {
  if (status === "reward_issued") return "success";
  if (status === "qualified" || status === "reward_pending") return "warning";
  if (status === "cancelled") return "danger";
  if (status === "in_progress") return "info";
  return "neutral";
}

function cycleProgress(paid: number, required: number) {
  const pct = Math.round((paid / required) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground font-mono">{paid}/{required}</span>
    </div>
  );
}

/* ── Filter presets ── */
type FilterPreset = "all" | "pending_rewards" | "qualified" | "sent" | "fraud";
const FILTER_PRESETS: { key: FilterPreset; label: string; icon: any }[] = [
  { key: "all", label: "All Referrals", icon: Users },
  { key: "pending_rewards", label: "Pending Rewards", icon: Clock },
  { key: "qualified", label: "Qualified", icon: CheckCircle },
  { key: "sent", label: "Rewards Sent", icon: Send },
  { key: "fraud", label: "Fraud Flagged", icon: ShieldAlert },
];

const CoreReferralRewardsPage = () => {
  const queryClient = useQueryClient();
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReferral, setSelectedReferral] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Reward form state
  const [rewardForm, setRewardForm] = useState({
    card_provider: "",
    card_reference: "",
    send_date: "",
    notes: "",
  });

  /* ── Data fetch with joined profiles ── */
  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["core-referral-management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_referrals" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data as any[]) || [];

      // Batch-resolve profile names for referrer + referred
      const userIds = new Set<string>();
      rows.forEach((r) => {
        if (r.referrer_user_id) userIds.add(r.referrer_user_id);
        if (r.referred_user_id) userIds.add(r.referred_user_id);
      });

      let profileMap: Record<string, any> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, email, phone, account_number")
          .in("user_id", Array.from(userIds));
        (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });
      }

      // Batch-resolve order info
      const orderIds = rows.map(r => r.referred_order_id).filter(Boolean);
      let orderMap: Record<string, any> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from("orders")
          .select("id, order_number, service_type, created_at, status")
          .in("id", orderIds);
        (orders || []).forEach((o: any) => { orderMap[o.id] = o; });
      }

      return rows.map((r: any) => ({
        ...r,
        referrer_profile: profileMap[r.referrer_user_id] || null,
        referred_profile: profileMap[r.referred_user_id] || null,
        referred_order: orderMap[r.referred_order_id] || null,
      }));
    },
  });

  /* ── Mutations ── */
  const updateReferralMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("client_referrals" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-referral-management"] });
      toast.success("Referral updated");
    },
    onError: (e: any) => toast.error(`Update failed: ${e.message}`),
  });

  const issueReward = useCallback((referral: any) => {
    updateReferralMutation.mutate({
      id: referral.id,
      updates: {
        reward_status: "reward_issued",
        reward_issued_at: new Date().toISOString(),
        reward_amount: referral.reward_amount || 250,
        reward_type: "visa_mastercard_gift_card",
        status: "reward_issued",
      },
    });
  }, [updateReferralMutation]);

  const markRewardSent = useCallback(() => {
    if (!selectedReferral) return;
    updateReferralMutation.mutate({
      id: selectedReferral.id,
      updates: {
        status: "reward_sent",
        reward_card_provider: rewardForm.card_provider || null,
        reward_reference: rewardForm.card_reference || null,
        reward_sent_at: rewardForm.send_date ? new Date(rewardForm.send_date).toISOString() : new Date().toISOString(),
        notes: rewardForm.notes || selectedReferral.notes,
      },
    });
    setDrawerOpen(false);
  }, [selectedReferral, rewardForm, updateReferralMutation]);

  const markDelivered = useCallback(() => {
    if (!selectedReferral) return;
    updateReferralMutation.mutate({
      id: selectedReferral.id,
      updates: { reward_delivered_at: new Date().toISOString() },
    });
    setDrawerOpen(false);
  }, [selectedReferral, updateReferralMutation]);

  const flagFraud = useCallback((referral: any) => {
    updateReferralMutation.mutate({
      id: referral.id,
      updates: {
        fraud_flag: true,
        status: "fraud_review",
        fraud_checked_at: new Date().toISOString(),
      },
    });
  }, [updateReferralMutation]);

  /* ── Filtering ── */
  const filteredData = useMemo(() => {
    let result = referrals;

    // Preset filters
    if (filterPreset === "pending_rewards") {
      result = result.filter((r: any) => ["qualified", "reward_pending"].includes(r.reward_status));
    } else if (filterPreset === "qualified") {
      result = result.filter((r: any) => r.status === "qualified" || r.reward_status === "qualified");
    } else if (filterPreset === "sent") {
      result = result.filter((r: any) => r.status === "reward_sent" || r.status === "reward_issued");
    } else if (filterPreset === "fraud") {
      result = result.filter((r: any) => r.fraud_flag || r.status === "fraud_review");
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r: any) => {
        const referrerName = `${r.referrer_profile?.first_name || ""} ${r.referrer_profile?.last_name || ""}`.toLowerCase();
        const referredName = `${r.referred_profile?.first_name || ""} ${r.referred_profile?.last_name || ""}`.toLowerCase();
        const code = (r.referral_code_used || "").toLowerCase();
        const orderNum = (r.referred_order?.order_number || "").toLowerCase();
        const referrerEmail = (r.referrer_profile?.email || "").toLowerCase();
        const referredEmail = (r.referred_profile?.email || "").toLowerCase();
        return (
          referrerName.includes(q) || referredName.includes(q) ||
          code.includes(q) || orderNum.includes(q) ||
          referrerEmail.includes(q) || referredEmail.includes(q)
        );
      });
    }

    return result;
  }, [referrals, filterPreset, searchQuery]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const total = referrals.length;
    const inProgress = referrals.filter((r: any) => !["reward_issued", "reward_sent", "cancelled", "disqualified"].includes(r.status)).length;
    const qualified = referrals.filter((r: any) => r.reward_status === "qualified" || r.reward_status === "reward_pending").length;
    const issued = referrals.filter((r: any) => ["reward_issued", "reward_sent"].includes(r.status)).length;
    const totalAmount = referrals
      .filter((r: any) => r.reward_status === "reward_issued")
      .reduce((sum: number, r: any) => sum + Number(r.reward_amount || 0), 0);
    const fraudCount = referrals.filter((r: any) => r.fraud_flag).length;
    return { total, inProgress, qualified, issued, totalAmount, fraudCount };
  }, [referrals]);

  /* ── Open detail ── */
  const openDetail = useCallback((row: any) => {
    setSelectedReferral(row);
    setRewardForm({ card_provider: row.reward_card_provider || "", card_reference: row.reward_reference || "", send_date: "", notes: row.notes || "" });
    setDrawerOpen(true);
  }, []);

  const profileName = (profile: any) => profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "—" : "—";

  /* ── Table columns ── */
  const columns: Column<any>[] = [
    {
      key: "referrer",
      label: "Referrer",
      sortable: false,
      render: (r) => (
        <div>
          <p className="font-medium text-foreground text-sm">{profileName(r.referrer_profile)}</p>
          <p className="text-xs text-muted-foreground">{r.referrer_profile?.email || r.referrer_user_id?.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: "referred",
      label: "Referred Client",
      sortable: false,
      render: (r) => (
        <div>
          <p className="font-medium text-foreground text-sm">{profileName(r.referred_profile)}</p>
          <p className="text-xs text-muted-foreground">{r.referred_profile?.email || r.referred_user_id?.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: "referral_code_used",
      label: "Code",
      render: (r) => <span className="font-mono text-xs text-foreground">{r.referral_code_used}</span>,
    },
    {
      key: "referred_order",
      label: "Order",
      sortable: false,
      render: (r) => (
        <div>
          <p className="font-mono text-xs text-foreground">{r.referred_order?.order_number || "—"}</p>
          <p className="text-xs text-muted-foreground">{r.referred_order?.service_type || ""}</p>
        </div>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (r) => <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-CA")}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge
          label={REFERRAL_STATUS_LABELS[r.status] || r.status}
          variant={referralStatusVariant(r.status)}
          size="sm"
        />
      ),
    },
    {
      key: "qualifying_cycles_paid",
      label: "Cycles",
      render: (r) => cycleProgress(r.qualifying_cycles_paid || 0, r.required_cycles || 2),
    },
    {
      key: "payment_method",
      label: "Payout",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.payment_method ? PAYMENT_METHOD_LABELS[r.payment_method] || r.payment_method : "—"}
        </span>
      ),
    },
    {
      key: "reward_status",
      label: "Reward",
      render: (r) => (
        <StatusBadge
          label={REWARD_STATUS_LABELS[r.reward_status] || r.reward_status}
          variant={rewardStatusVariant(r.reward_status)}
          size="sm"
        />
      ),
    },
    {
      key: "reward_amount",
      label: "Amount",
      render: (r) => <span className="text-sm text-foreground">{r.reward_amount ? `$${r.reward_amount}` : "$250"}</span>,
    },

    {
      key: "actions",
      label: "Actions",
      sortable: false,
      className: "text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDetail(r)} title="View details">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {(r.status === "qualified" || r.reward_status === "qualified" || r.reward_status === "reward_pending") && r.reward_status !== "reward_issued" && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:text-emerald-300" onClick={() => issueReward(r)} title="Issue reward">
              <CreditCard className="h-3.5 w-3.5" />
            </Button>
          )}
          {!r.fraud_flag && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => flagFraud(r)} title="Flag fraud">
              <ShieldAlert className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Referral Management</h1>
        <p className="text-sm text-muted-foreground">Full referral lifecycle, reward issuance & fraud monitoring — 25 $/mo × 10 months (250 $ total) — PayPal / Interac / Gift Card</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Users, label: "Total Referrals", value: kpis.total, color: "text-foreground" },
          { icon: TrendingUp, label: "In Progress", value: kpis.inProgress, color: "text-sky-400" },
          { icon: CheckCircle, label: "Qualified", value: kpis.qualified, color: "text-amber-400" },
          { icon: Gift, label: "Rewards Issued", value: kpis.issued, color: "text-emerald-400" },
          { icon: DollarSign, label: "Total Issued", value: `$${kpis.totalAmount}`, color: "text-primary" },
          { icon: ShieldAlert, label: "Fraud Flags", value: kpis.fraudCount, color: "text-red-400" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-2.5">
              <kpi.icon className={`w-4 h-4 ${kpi.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-tight">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_PRESETS.map((preset) => (
          <Button
            key={preset.key}
            variant={filterPreset === preset.key ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setFilterPreset(preset.key)}
          >
            <preset.icon className="h-3 w-3 mr-1.5" />
            {preset.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search client, code, order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 w-64 text-sm bg-secondary border-border"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <Card className="bg-card border-border overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredData}
          keyExtractor={(r) => r.id}
          onRowClick={openDetail}
          isLoading={isLoading}
          emptyMessage="No referrals found"
          emptyIcon={<Gift className="w-10 h-10 opacity-40" />}
          pageSize={25}
          compact
        />
      </Card>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[480px] sm:max-w-[480px] bg-card border-border overflow-y-auto">
          {selectedReferral && (
            <>
              <SheetHeader>
                <SheetTitle className="text-foreground">Referral Detail</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-5">
                {/* Referral Status */}
                <div className="flex items-center gap-3">
                  <StatusBadge
                    label={REFERRAL_STATUS_LABELS[selectedReferral.status] || selectedReferral.status}
                    variant={referralStatusVariant(selectedReferral.status)}
                    size="md"
                  />
                  {selectedReferral.fraud_flag && (
                    <Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-xs">
                      <ShieldAlert className="h-3 w-3 mr-1" /> FRAUD FLAG
                    </Badge>
                  )}
                </div>

                {/* Referrer Info */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Referrer</h3>
                  <div className="rounded-md bg-secondary/50 p-3 space-y-1.5 text-sm">
                    <DetailRow label="Name" value={profileName(selectedReferral.referrer_profile)} />
                    <DetailRow label="Email" value={selectedReferral.referrer_profile?.email} />
                    <DetailRow label="Account #" value={selectedReferral.referrer_profile?.account_number} />
                    <DetailRow label="Referral Code" value={selectedReferral.referral_code_used} mono />
                  </div>
                </div>

                {/* Referred Client Info */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Referred Client</h3>
                  <div className="rounded-md bg-secondary/50 p-3 space-y-1.5 text-sm">
                    <DetailRow label="Name" value={profileName(selectedReferral.referred_profile)} />
                    <DetailRow label="Email" value={selectedReferral.referred_profile?.email} />
                    <DetailRow label="Account #" value={selectedReferral.referred_profile?.account_number} />
                  </div>
                </div>

                {/* Order Info */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Referred Order</h3>
                  <div className="rounded-md bg-secondary/50 p-3 space-y-1.5 text-sm">
                    <DetailRow label="Order #" value={selectedReferral.referred_order?.order_number} mono />
                    <DetailRow label="Service" value={selectedReferral.referred_order?.service_type} />
                    <DetailRow label="Order Date" value={selectedReferral.referred_order?.created_at ? new Date(selectedReferral.referred_order.created_at).toLocaleDateString("fr-CA") : undefined} />
                    <DetailRow label="Status" value={selectedReferral.referred_order?.status} />
                  </div>
                </div>

                {/* Billing Progress */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Billing Cycle Progress</h3>
                  <div className="rounded-md bg-secondary/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-foreground">Cycles Completed</span>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {selectedReferral.qualifying_cycles_paid || 0} / {selectedReferral.required_cycles || 3}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.round(((selectedReferral.qualifying_cycles_paid || 0) / (selectedReferral.required_cycles || 3)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-[11px] text-muted-foreground">
                      {[1, 2, 3].map((c) => (
                        <span key={c} className={selectedReferral.qualifying_cycles_paid >= c ? "text-primary font-semibold" : ""}>
                          Cycle {c} {selectedReferral.qualifying_cycles_paid >= c ? "✓" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator className="bg-border" />

                {/* Reward Management */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reward Management</h3>
                  <div className="rounded-md bg-secondary/50 p-3 space-y-1.5 text-sm">
                    <DetailRow label="Reward Status" value={REWARD_STATUS_LABELS[selectedReferral.reward_status] || selectedReferral.reward_status} />
                    <DetailRow label="Amount" value={`$${selectedReferral.reward_amount || 25}`} />
                    <DetailRow label="Type" value={selectedReferral.reward_type || "Visa/MC Gift Card"} />
                    {selectedReferral.reward_issued_at && (
                      <DetailRow label="Issued At" value={new Date(selectedReferral.reward_issued_at).toLocaleString("fr-CA")} />
                    )}
                    {selectedReferral.reward_card_provider && (
                      <DetailRow label="Card Provider" value={selectedReferral.reward_card_provider} />
                    )}
                    {selectedReferral.reward_reference && (
                      <DetailRow label="Card Reference" value={selectedReferral.reward_reference} mono />
                    )}
                    {selectedReferral.reward_sent_at && (
                      <DetailRow label="Sent At" value={new Date(selectedReferral.reward_sent_at).toLocaleString("fr-CA")} />
                    )}
                    {selectedReferral.reward_delivered_at && (
                      <DetailRow label="Delivered At" value={new Date(selectedReferral.reward_delivered_at).toLocaleString("fr-CA")} />
                    )}
                  </div>
                </div>

                {/* Reward Actions Form */}
                {selectedReferral.reward_status !== "cancelled" && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reward Actions</h3>

                    {/* Issue reward */}
                    {!["reward_issued", "reward_sent"].includes(selectedReferral.status) &&
                      (selectedReferral.status === "qualified" || selectedReferral.reward_status === "qualified" || selectedReferral.reward_status === "reward_pending") && (
                      <Button
                        onClick={() => issueReward(selectedReferral)}
                        disabled={updateReferralMutation.isPending}
                        className="w-full"
                        size="sm"
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-2" />
                        Issue $25 Gift Card Reward
                      </Button>
                    )}

                    {/* Mark sent form */}
                    {(selectedReferral.status === "reward_issued" || selectedReferral.reward_status === "reward_issued") && !selectedReferral.reward_sent_at && (
                      <div className="space-y-2 rounded-md border border-border p-3">
                        <p className="text-xs font-medium text-foreground">Mark Reward as Sent</p>
                        <Input
                          placeholder="Card provider (e.g., Visa, Mastercard)"
                          value={rewardForm.card_provider}
                          onChange={(e) => setRewardForm(f => ({ ...f, card_provider: e.target.value }))}
                          className="h-8 text-sm bg-background"
                        />
                        <Input
                          placeholder="Card reference / serial number"
                          value={rewardForm.card_reference}
                          onChange={(e) => setRewardForm(f => ({ ...f, card_reference: e.target.value }))}
                          className="h-8 text-sm bg-background"
                        />
                        <Input
                          type="date"
                          value={rewardForm.send_date}
                          onChange={(e) => setRewardForm(f => ({ ...f, send_date: e.target.value }))}
                          className="h-8 text-sm bg-background"
                        />
                        <Textarea
                          placeholder="Notes (optional)"
                          value={rewardForm.notes}
                          onChange={(e) => setRewardForm(f => ({ ...f, notes: e.target.value }))}
                          className="text-sm bg-background min-h-[60px]"
                        />
                        <Button
                          onClick={markRewardSent}
                          disabled={updateReferralMutation.isPending || !rewardForm.card_reference}
                          className="w-full"
                          size="sm"
                        >
                          <Send className="h-3.5 w-3.5 mr-2" />
                          Mark as Sent
                        </Button>
                      </div>
                    )}

                    {/* Mark delivered */}
                    {selectedReferral.reward_sent_at && !selectedReferral.reward_delivered_at && (
                      <Button
                        variant="outline"
                        onClick={markDelivered}
                        disabled={updateReferralMutation.isPending}
                        className="w-full"
                        size="sm"
                      >
                        <PackageCheck className="h-3.5 w-3.5 mr-2" />
                        Mark as Delivered
                      </Button>
                    )}
                  </div>
                )}

                {/* Fraud section */}
                {selectedReferral.fraud_flag && (
                  <div className="rounded-md border border-red-500/25 bg-red-500/5 p-3 space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5" /> Fraud Review
                    </h3>
                    {selectedReferral.fraud_review_notes && (
                      <p className="text-xs text-muted-foreground">{selectedReferral.fraud_review_notes}</p>
                    )}
                    {selectedReferral.fraud_checked_at && (
                      <p className="text-[11px] text-muted-foreground">
                        Checked: {new Date(selectedReferral.fraud_checked_at).toLocaleString("fr-CA")}
                      </p>
                    )}
                  </div>
                )}

                {/* Notes */}
                {selectedReferral.notes && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</h3>
                    <p className="text-sm text-muted-foreground">{selectedReferral.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ── Detail Row helper ── */
function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-foreground text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}

export default CoreReferralRewardsPage;
