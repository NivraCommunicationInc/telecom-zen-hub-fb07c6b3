/**
 * CoreCancellationsPage — Résiliations (service cancellation requests)
 * Lists all rows from public.service_cancellation_requests with quick actions:
 * Approuver, Décliner, Compléter. Mirrors AdminCancellations behaviour but lives in Core.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  FileX, Search, CheckCircle, XCircle, AlertTriangle, Clock,
  RefreshCw, Calendar, Loader2,
} from "lucide-react";

type CancellationStatus =
  | "requested" | "under_review" | "awaiting_client"
  | "approved" | "scheduled" | "completed" | "declined";

const statusConfig: Record<CancellationStatus, { label: string; tone: string; icon: any }> = {
  requested:       { label: "Demandée",       tone: "bg-amber-500/15 text-amber-500 border-amber-500/30",   icon: Clock },
  under_review:    { label: "En révision",    tone: "bg-blue-500/15 text-blue-500 border-blue-500/30",      icon: RefreshCw },
  awaiting_client: { label: "Info requise",   tone: "bg-purple-500/15 text-purple-500 border-purple-500/30", icon: AlertTriangle },
  approved:        { label: "Approuvée",      tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: CheckCircle },
  scheduled:       { label: "Planifiée",      tone: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",       icon: Calendar },
  completed:       { label: "Complétée",      tone: "bg-muted text-muted-foreground border-border",          icon: CheckCircle },
  declined:        { label: "Refusée",        tone: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
};

const serviceTypeLabels: Record<string, string> = {
  mobile: "Mobile", internet: "Internet", tv: "Télévision",
  security: "Sécurité", streaming: "Streaming", bundle: "Forfait combiné",
};

const reasonCodeLabels: Record<string, string> = {
  price: "Prix trop élevé", moving: "Déménagement",
  not_needed: "Service non nécessaire", service_issue: "Problème de service",
  billing_issue: "Problème de facturation", other: "Autre raison",
};

const PAGE_SIZE = 10;

export default function CoreCancellationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [publicMessage, setPublicMessage] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [page, setPage] = useState(1);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["core-cancellations"],
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_cancellation_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      if (!data?.length) return [];
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, client_number")
        .in("user_id", userIds);
      return data.map((r: any) => ({
        ...r,
        profile: profiles?.find((p: any) => p.user_id === r.user_id) ?? null,
      }));
    },
  });

  const stats = useMemo(() => {
    const counts: Record<string, number> = { total: requests.length };
    Object.keys(statusConfig).forEach((k) => {
      counts[k] = requests.filter((r: any) => r.status === k).length;
    });
    return counts;
  }, [requests]);

  const filtered = useMemo(() => {
    return requests.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.request_number?.toLowerCase().includes(q) ||
          r.profile?.full_name?.toLowerCase().includes(q) ||
          r.profile?.email?.toLowerCase().includes(q) ||
          r.service_identifier?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requests, search, statusFilter]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string } & Record<string, any>) => {
      const { id, ...fields } = payload;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
        : { data: null };

      const update = {
        ...fields,
        updated_at: new Date().toISOString(),
        processed_by_id: user?.id ?? null,
        processed_by_name: profile?.full_name ?? user?.email ?? null,
        processed_at: new Date().toISOString(),
      };

      // STEP 1 — update the cancellation request itself
      const { error } = await supabase
        .from("service_cancellation_requests")
        .update(update)
        .eq("id", id);
      if (error) throw error;

      // Pull a full snapshot of the request so downstream steps have all fields
      const { data: req } = await supabase
        .from("service_cancellation_requests")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      const result: any = { id, ...update, _sideEffects: { subscription: false, sim: false, equipment: false, invoice: null as null | "voided" | "marked_overdue", account: false, email: false, note: false } };

      // Lifecycle emails for non-approved transitions
      if (fields.status === "declined" || fields.status === "completed") {
        try {
          const { data: cp } = req.user_id
            ? await supabase.from("profiles").select("email, full_name").eq("user_id", req.user_id).maybeSingle()
            : { data: null };
          if (cp?.email) {
            await (supabase as any).from("email_queue").insert({
              template_key: fields.status === "declined" ? "cancellation_declined" : "cancellation_completed",
              to_email: cp.email,
              entity_type: "cancellation_request",
              entity_id: id,
              variables: {
                client_name: cp.full_name ?? "Client",
                request_number: req.request_number ?? id.slice(0, 8),
                service_type: req.service_type,
                effective_date: (fields.effective_date as string) || req.effective_date || "",
                decline_reason: (fields.decline_reason as string) || "",
                public_message: (fields.public_message as string) || "",
              },
              priority: 1,
            });
            result._sideEffects.email = true;
          }
        } catch (e: any) {
          console.error("[CoreCancellations] lifecycle email failed:", e?.message ?? e);
        }
      }

      // Side-effects only run on approval transitions
      if (fields.status !== "approved" || !req) return result;

      const accountId: string | null = req.account_id ?? null;
      const effective: string = (fields.effective_date as string) || new Date().toISOString();
      const serviceType: string = (req.service_type ?? "").toString().toLowerCase();

      // Parse refund metadata stored in staff_notes by the dialogs
      let refundMode: "none" | "full" | "partial" | "credit" = "none";
      let refundAmount = 0;
      try {
        const parsed = req.staff_notes ? JSON.parse(req.staff_notes) : null;
        if (parsed && typeof parsed === "object") {
          refundMode = (parsed.refund_mode ?? "none") as any;
          refundAmount = Number(parsed.refund_amount ?? parsed.refund_amount_per_sub ?? 0) || 0;
        }
      } catch { /* legacy plain-text notes — ignore */ }

      // STEP 2 — Deactivate billing subscription(s)
      // Prefer targeted update by service_identifier (set by the dialogs);
      // fall back to all subs tied to the account via orders.
      try {
        let cancelledSubscriptionId: string | null = null;
        let paypalSubscriptionId: string | null = null;

        if (req.service_identifier) {
          const { data: subRow } = await supabase
            .from("billing_subscriptions")
            .select("id, paypal_subscription_id, plan_name")
            .eq("id", req.service_identifier)
            .maybeSingle();
          if (subRow) {
            cancelledSubscriptionId = subRow.id;
            paypalSubscriptionId = subRow.paypal_subscription_id ?? null;
            const { error: subErr } = await supabase
              .from("billing_subscriptions")
              .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
              })
              .eq("id", subRow.id);
            if (subErr) throw subErr;
            result._sideEffects.subscription = true;
          }
        }

        if (!cancelledSubscriptionId && accountId) {
          const { data: orderRows } = await supabase
            .from("orders")
            .select("id")
            .eq("account_id", accountId);
          const orderIds = (orderRows ?? []).map((o: any) => o.id);
          if (orderIds.length) {
            const { error: subErr } = await supabase
              .from("billing_subscriptions")
              .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
              })
              .in("order_id", orderIds)
              .eq("status", "active");
            if (subErr) throw subErr;
            result._sideEffects.subscription = true;
          }
        }

        // STEP 2a — PayPal: cancel recurring binding
        if (paypalSubscriptionId && cancelledSubscriptionId) {
          try {
            await supabase.functions.invoke("paypal-cancel-subscription", {
              body: {
                subscription_id: cancelledSubscriptionId,
                account_id: accountId,
                reason: req.reason_code || "service_cancelled",
              },
            });
          } catch (ppErr: any) {
            console.error("[CoreCancellations] paypal-cancel-subscription failed:", ppErr?.message ?? ppErr);
          }
        }

        // STEP 2b — PayPal refund (if requested)
        if (refundMode !== "none" && refundMode !== "credit" && refundAmount > 0 && accountId) {
          try {
            const { data: lastPayment } = await supabase
              .from("billing_payments")
              .select("id, status")
              .eq("customer_id", (await supabase.from("billing_customers").select("id").eq("account_id", accountId as any).maybeSingle()).data?.id ?? "")
              .eq("status", "captured")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (lastPayment?.id) {
              await supabase.functions.invoke("paypal-refund", {
                body: {
                  payment_id: lastPayment.id,
                  amount: refundAmount,
                  reason: `Service cancellation — ${req.reason_code ?? "n/a"}`,
                },
              });
            }
          } catch (refErr: any) {
            console.error("[CoreCancellations] paypal-refund failed:", refErr?.message ?? refErr);
          }
        }
      } catch (e: any) {
        console.error("[CoreCancellations] STEP 2 subscription deactivation failed:", e?.message ?? e);
      }

      // STEP 3 — Deactivate SIM (mobile fulfillment) when service is mobile/sim
      try {
        if (accountId && (serviceType.includes("mobile") || serviceType.includes("sim"))) {
          const { data: actOrders } = await supabase
            .from("orders")
            .select("id")
            .eq("account_id", accountId)
            .eq("status", "activated");
          const orderIds = (actOrders ?? []).map((o: any) => o.id);
          if (orderIds.length) {
            const { error: simErr } = await supabase
              .from("mobile_fulfillment")
              .update({ activation_status: "deactivated", updated_at: new Date().toISOString() })
              .in("order_id", orderIds);
            if (simErr) throw simErr;
            result._sideEffects.sim = true;
          }
        }
      } catch (e: any) {
        console.error("[CoreCancellations] STEP 3 SIM deactivation failed:", e?.message ?? e);
      }

      // STEP 4 — Mark assigned equipment for return
      try {
        if (accountId) {
          const { error: eqErr } = await supabase
            .from("equipment_inventory")
            .update({ status: "return_requested" })
            .eq("account_id", accountId)
            .eq("status", "assigned");
          if (eqErr) throw eqErr;
          result._sideEffects.equipment = true;
        }
      } catch (e: any) {
        console.error("[CoreCancellations] STEP 4 equipment return flag failed:", e?.message ?? e);
      }

      // STEP 5 — Resolve outstanding invoices (void if zero balance, overdue if balance > 0)
      try {
        if (accountId) {
          const { data: orderRows } = await supabase
            .from("orders")
            .select("id")
            .eq("account_id", accountId);
          const orderIds = (orderRows ?? []).map((o: any) => o.id);
          if (orderIds.length) {
            const { data: openInvoices } = await supabase
              .from("billing_invoices")
              .select("id, balance_due")
              .in("order_id", orderIds)
              .not("status", "in", "(paid,void,cancelled,refunded)");
            const toVoid = (openInvoices ?? []).filter((i: any) => Number(i.balance_due ?? 0) <= 0).map((i: any) => i.id);
            const toOverdue = (openInvoices ?? []).filter((i: any) => Number(i.balance_due ?? 0) > 0).map((i: any) => i.id);
            if (toVoid.length) {
              await supabase.from("billing_invoices").update({ status: "void" }).in("id", toVoid);
              result._sideEffects.invoice = "voided";
            }
            if (toOverdue.length) {
              await supabase.from("billing_invoices").update({ status: "overdue" }).in("id", toOverdue);
              result._sideEffects.invoice = result._sideEffects.invoice === "voided" ? "voided" : "marked_overdue";
            }
          }
        }
      } catch (e: any) {
        console.error("[CoreCancellations] STEP 5 invoice resolution failed:", e?.message ?? e);
      }

      // STEP 6 — Cancel the account
      try {
        if (accountId) {
          const { error: acctErr } = await supabase
            .from("accounts")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", accountId);
          if (acctErr) throw acctErr;
          result._sideEffects.account = true;
        }
      } catch (e: any) {
        console.error("[CoreCancellations] STEP 6 account cancellation failed:", e?.message ?? e);
      }

      // STEP 7 — Activity log
      try {
        if (accountId && req.user_id) {
          await supabase.from("activity_logs").insert({
            user_id: req.user_id,
            action: "service_cancelled",
            entity_type: "account",
            entity_id: accountId,
            actor_user_id: user?.id ?? null,
            actor_name: profile?.full_name ?? user?.email ?? null,
            actor_role: "admin",
            details: {
              cancellation_request_id: id,
              reason_code: req.reason_code,
              effective_date: effective,
              processed_by_id: user?.id ?? null,
              processed_by_name: profile?.full_name ?? user?.email ?? null,
              service_type: req.service_type,
            },
          } as any);
        }
      } catch (e: any) {
        console.error("[CoreCancellations] STEP 7 activity log failed:", e?.message ?? e);
      }

      // STEP 8 — Send confirmation email
      try {
        const { data: clientProfile } = req.user_id
          ? await supabase.from("profiles").select("email, full_name").eq("user_id", req.user_id).maybeSingle()
          : { data: null };
        if (clientProfile?.email) {
          const { error: emailErr } = await (supabase as any).from("email_queue").insert({
            template_key: "cancellation_scheduled",
            to_email: clientProfile.email,
            entity_type: "cancellation_request",
            entity_id: id,
            variables: {
              client_name: clientProfile.full_name ?? "Client",
              request_number: req.request_number ?? id.slice(0, 8),
              service_type: req.service_type,
              effective_date: effective,
              public_message: fields.public_message ?? null,
            },
            priority: 1,
          });
          if (emailErr) throw emailErr;
          result._sideEffects.email = true;
        }

        // STEP 8b — Queue branded service_cancelled email (Violet shell)
        if (clientProfile?.email) {
          try {
            // Re-parse staff_notes here so we can include refund_amount in the email
            let refundAmt = 0;
            try {
              const parsed = req.staff_notes ? JSON.parse(req.staff_notes) : null;
              refundAmt = Number(parsed?.refund_amount ?? parsed?.refund_amount_per_sub ?? 0) || 0;
            } catch { /* ignore */ }

            // Best-effort plan name lookup for the email
            let planName: string | null = null;
            if (req.service_identifier) {
              const { data: subRow } = await supabase
                .from("billing_subscriptions")
                .select("plan_name")
                .eq("id", req.service_identifier)
                .maybeSingle();
              planName = subRow?.plan_name ?? null;
            }

            await supabase.from("email_queue").insert({
              to_email: clientProfile.email,
              template_key: "service_cancelled",
              variables: {
                client_name: clientProfile.full_name ?? "Client",
                service_name: planName ?? req.service_type,
                cancellation_date: effective,
                refund_amount: refundAmt,
              },
              status: "pending",
            } as any);
          } catch (qErr: any) {
            console.error("[CoreCancellations] STEP 8b service_cancelled email queue failed:", qErr?.message ?? qErr);
          }
        }
      } catch (e: any) {
        console.error("[CoreCancellations] STEP 8 confirmation email failed:", e?.message ?? e);
      }

      // STEP 9 — Auto-note (no helper exists in repo → log via activity_logs as service_cancelled_note)
      try {
        if (req.user_id) {
          await supabase.from("activity_logs").insert({
            user_id: req.user_id,
            action: "service_cancelled_note",
            entity_type: "client_profile",
            entity_id: req.user_id,
            actor_user_id: user?.id ?? null,
            actor_name: profile?.full_name ?? user?.email ?? null,
            actor_role: "admin",
            details: {
              event: "service_cancelled",
              cancellation_request_id: id,
              reason_code: req.reason_code,
              effective_date: effective,
              service_type: req.service_type,
            },
          } as any);
          result._sideEffects.note = true;
        }
      } catch (e: any) {
        console.error("[CoreCancellations] STEP 9 client auto-note failed:", e?.message ?? e);
      }

      return result;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["core-cancellations"] });
      const fx = data?._sideEffects;
      if (fx && data?.status === "approved") {
        const parts: string[] = [];
        if (fx.subscription) parts.push("abonnement résilié");
        if (fx.sim) parts.push("SIM désactivée");
        if (fx.equipment) parts.push("équipement marqué pour retour");
        if (fx.invoice === "voided") parts.push("factures annulées");
        if (fx.invoice === "marked_overdue") parts.push("solde marqué en retard");
        if (fx.account) parts.push("compte fermé");
        if (fx.email) parts.push("email envoyé");
        toast.success(`Annulation approuvée — ${parts.length ? parts.join(", ") : "aucune action en aval"}`);
      } else {
        toast.success("Demande mise à jour");
      }
      if (selected?.id === data.id) setSelected({ ...selected, ...data });
    },
    onError: (err: any) => {
      console.error("[CoreCancellations] update failed:", err);
      toast.error(err?.message ?? "Échec de la mise à jour");
    },
  });

  const handleApprove = () => {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      status: "approved",
      effective_date: effectiveDate || null,
      public_message: publicMessage || null,
    });
  };

  const handleComplete = () => {
    if (!selected) return;
    if (!effectiveDate) {
      toast.error("Veuillez définir une date effective");
      return;
    }
    updateMutation.mutate({
      id: selected.id,
      status: "completed",
      effective_date: effectiveDate,
      public_message: publicMessage || null,
    });
  };

  const handleDecline = () => {
    if (!selected) return;
    if (!declineReason.trim()) {
      toast.error("Veuillez expliquer la raison du refus");
      return;
    }
    updateMutation.mutate({
      id: selected.id,
      status: "declined",
      decline_reason: declineReason,
      public_message: publicMessage || null,
    });
    setDeclineOpen(false);
    setDeclineReason("");
  };

  const openDetail = (r: any) => {
    setSelected(r);
    setEffectiveDate(r.effective_date ?? "");
    setPublicMessage(r.public_message ?? "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileX className="h-6 w-6 text-primary" />
            Résiliations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demandes d'annulation de service — traitement et suivi
          </p>
        </div>
      </div>

      {/* Stats — clickable filter pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard
          label="Total"
          value={stats.total ?? 0}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        {(Object.keys(statusConfig) as CancellationStatus[]).map((s) => (
          <StatCard
            key={s}
            label={statusConfig[s].label}
            value={stats[s] ?? 0}
            tone={statusConfig[s].tone}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          />
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Numéro, client, courriel, identifiant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {(Object.keys(statusConfig) as CancellationStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Demandes ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Aucune demande de résiliation.
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r: any) => {
                  const cfg = statusConfig[r.status as CancellationStatus] ?? statusConfig.requested;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={r.id}
                      onClick={() => openDetail(r)}
                      className="w-full text-left px-4 py-3 hover:bg-secondary/40 transition-colors flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-xs text-foreground">{r.request_number ?? r.id.slice(0, 8)}</span>
                          <Badge variant="outline" className={cfg.tone}>
                            <Icon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {serviceTypeLabels[r.service_type] ?? r.service_type}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-foreground truncate">
                          {r.profile?.full_name ?? "Client"} · {r.profile?.email ?? "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {reasonCodeLabels[r.reason_code] ?? r.reason_code}
                          {r.requested_effective_date && (
                            <> · Souhaitée: {format(new Date(r.requested_effective_date), "d MMM yyyy", { locale: fr })}</>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground text-right shrink-0">
                        {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </div>
                    </button>
                  );
                })}
              </div>
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  <span>
                    Page {page} / {Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} — {filtered.length} demande{filtered.length > 1 ? "s" : ""}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileX className="h-5 w-5" />
                  {selected.request_number ?? selected.id.slice(0, 8)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Client" value={selected.profile?.full_name ?? "—"} />
                  <Field label="Courriel" value={selected.profile?.email ?? "—"} />
                  <Field label="Type de service" value={serviceTypeLabels[selected.service_type] ?? selected.service_type} />
                  <Field label="Identifiant" value={selected.service_identifier ?? "—"} />
                  <Field label="Raison" value={reasonCodeLabels[selected.reason_code] ?? selected.reason_code} />
                  <Field
                    label="Date souhaitée"
                    value={selected.requested_effective_date
                      ? format(new Date(selected.requested_effective_date), "d MMM yyyy", { locale: fr })
                      : "—"}
                  />
                </div>

                {selected.reason_details && (
                  <div className="text-sm rounded-md bg-secondary/50 p-3 text-foreground">
                    {selected.reason_details}
                  </div>
                )}

                <div className="space-y-3 border-t border-border pt-4">
                  <div className="space-y-2">
                    <Label>Date effective d'annulation</Label>
                    <Input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message au client (optionnel)</Label>
                    <Textarea
                      rows={3}
                      value={publicMessage}
                      onChange={(e) => setPublicMessage(e.target.value)}
                      placeholder="Visible par le client…"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  disabled={updateMutation.isPending || selected.status === "completed"}
                  onClick={() => setDeclineOpen(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Décliner
                </Button>
                <Button
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                  disabled={updateMutation.isPending || selected.status === "completed" || selected.status === "approved"}
                  onClick={handleApprove}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approuver
                </Button>
                <Button
                  disabled={updateMutation.isPending || selected.status === "completed" || !effectiveDate}
                  onClick={handleComplete}
                >
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Compléter
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la demande</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Raison du refus (visible par le client)</Label>
            <Textarea
              rows={4}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Expliquez pourquoi cette demande est refusée…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={!declineReason.trim() || updateMutation.isPending}
              onClick={handleDecline}
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone, active, onClick }: { label: string; value: number; tone?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border bg-card p-3 transition-colors hover:border-primary/50 ${active ? "border-primary ring-1 ring-primary/40" : "border-border"} ${tone ?? ""}`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground mt-0.5">{value}</div>
    </div>
  );
}
