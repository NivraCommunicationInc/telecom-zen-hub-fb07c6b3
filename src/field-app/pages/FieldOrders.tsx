/**
 * FieldOrders — Unified list of all orders + pending payment intents
 * for the current field agent.
 *
 * Sources:
 *  - orders WHERE created_by_agent_id = auth.uid() OR source='field_sales'
 *    joined with field_commissions + profiles (client)
 *  - field_payment_intents WHERE agent_id = auth.uid() AND status != 'completed'
 *    joined with field_quotes (client info)
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShoppingCart, ExternalLink, Clock } from "lucide-react";

type StatusKey =
  | "pending_payment" | "pending_client" | "on_hold"
  | "activated" | "completed" | "cancelled" | "pending" | "processing";

const STATUS_FR: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "En attente paiement", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  pending_client:  { label: "Soumission envoyée",   cls: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
  on_hold:         { label: "En attente",           cls: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  activated:       { label: "Actif",                cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  completed:       { label: "Complété",             cls: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  cancelled:       { label: "Annulé",               cls: "bg-red-500/15 text-red-700 border-red-500/30" },
  pending:         { label: "En attente",           cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  processing:      { label: "En traitement",        cls: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
};

const COMMISSION_CLS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  paid: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  clawed_back: "bg-red-500/15 text-red-700 border-red-500/30",
};

const displayPrice = (item: any): string => {
  const p = Number(
    item?.price ?? item?.unit_price ??
    item?.monthly_price ?? item?.amount ?? 0
  );
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD'
  }).format(Number.isFinite(p) ? p : 0);
};

const showDiscount = (d: any): string => {
  if (!d) return 'Aucun rabais';
  const name = d.name || d.label || 'Rabais';
  const amount = Number(d.amount ||
    d.monthly_amount || 0);
  const months = Number(d.duration_months ||
    d.duration || d.months_total || 0);

  if (d.type === 'remove_fee' ||
      name.toLowerCase().includes('installation')) {
    return `${name} — Installation gratuite`;
  }
  if (months > 0) {
    return `${name} — ${new Intl.NumberFormat(
      'fr-CA',{style:'currency',currency:'CAD'}
    ).format(amount)}/mois × ${months} mois`;
  }
  return `${name} — ${new Intl.NumberFormat(
    'fr-CA',{style:'currency',currency:'CAD'}
  ).format(amount)}`;
};

interface UnifiedRow {
  kind: "order" | "intent";
  id: string;
  ref: string;
  client_name: string;
  client_email: string;
  amount: number;
  status: string;
  commission_amount: number;
  commission_status: string | null;
  date: string;
  paypal_approval_url?: string | null;
  quote_id?: string | null;
  services?: any[];
  discount_data?: any;
}

export default function FieldOrders() {
  const { data: rows = [], isLoading } = useQuery<UnifiedRow[]>({
    queryKey: ["field-orders-unified"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Orders for this agent
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at, user_id, source, created_by_agent_id, services, discount_data")
        .or(`created_by_agent_id.eq.${user.id},source.eq.field_sales`)
        .order("created_at", { ascending: false })
        .limit(200);

      const orderIds = (orders || []).map(o => o.id);
      const userIds = [...new Set((orders || []).map(o => o.user_id).filter(Boolean))];

      const [{ data: commissions }, { data: clients }] = await Promise.all([
        orderIds.length
          ? supabase.from("field_commissions").select("order_id, amount, status").in("order_id", orderIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds as string[])
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const commByOrder = new Map<string, { amount: number; status: string }>();
      for (const c of (commissions || []) as any[]) {
        const cur = commByOrder.get(c.order_id);
        commByOrder.set(c.order_id, {
          amount: (cur?.amount || 0) + Number(c.amount || 0),
          status: c.status || cur?.status || "pending",
        });
      }
      const clientById = new Map((clients || []).map((c: any) => [c.user_id, c]));

      const orderRows: UnifiedRow[] = (orders || []).map((o: any) => {
        const c = commByOrder.get(o.id);
        const cli = clientById.get(o.user_id);
        return {
          kind: "order",
          id: o.id,
          ref: o.order_number || o.id.slice(0, 8),
          client_name: cli?.full_name || "—",
          client_email: cli?.email || "",
          amount: Number(o.total_amount || 0),
          status: o.status || "pending",
          commission_amount: c?.amount || 0,
          commission_status: c?.status || null,
          date: o.created_at,
          services: Array.isArray(o.services) ? o.services : [],
          discount_data: o.discount_data,
        };
      });

      // Pending payment intents (not yet converted)
      const { data: intents } = await supabase
        .from("field_payment_intents")
        .select("id, quote_id, paypal_approval_url, amount, status, customer_name, customer_email, created_at, field_quotes(services, equipment, discount)")
        .eq("agent_id", user.id)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(100);

      const intentRows: UnifiedRow[] = (intents || []).map((i: any) => ({
        kind: "intent",
        id: i.id,
        ref: `INT-${String(i.id).slice(0, 8).toUpperCase()}`,
        client_name: i.customer_name || "—",
        client_email: i.customer_email || "",
        amount: Number(i.amount || 0),
        status: i.status === "pending" ? "pending_payment" : i.status,
        commission_amount: 0,
        commission_status: null,
        date: i.created_at,
        paypal_approval_url: i.paypal_approval_url,
        quote_id: i.quote_id,
        services: [
          ...(((i as any).field_quotes?.services as any[]) || []),
          ...(((i as any).field_quotes?.equipment as any[]) || []),
        ],
        discount_data: (i as any).field_quotes?.discount,
      }));

      return [...intentRows, ...orderRows].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    },
  });

  const totals = useMemo(() => ({
    count: rows.length,
    commissionPending: rows.filter(r => r.commission_status === "pending").reduce((s, r) => s + r.commission_amount, 0),
    commissionApproved: rows.filter(r => r.commission_status === "approved" || r.commission_status === "paid").reduce((s, r) => s + r.commission_amount, 0),
  }), [rows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-violet-400" /> Mes commandes
          </h1>
          <p className="text-xs text-white/60 mt-1">{totals.count} commande{totals.count !== 1 ? "s" : ""} au total</p>
        </div>
        <div className="text-right text-xs">
          <div className="text-white/60">Commissions en attente</div>
          <div className="text-amber-400 font-bold">{totals.commissionPending.toFixed(2)} $</div>
          <div className="text-white/60 mt-1">Commissions approuvées</div>
          <div className="text-emerald-400 font-bold">{totals.commissionApproved.toFixed(2)} $</div>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <ShoppingCart className="h-10 w-10 mx-auto text-white/30 mb-3" />
          <p className="text-white/70">Aucune commande pour l'instant.</p>
          <Link to="/field/sale/new" className="inline-block mt-4 rounded-full bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 text-sm font-semibold">
            Démarrer une vente
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const st = STATUS_FR[r.status] || { label: r.status, cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" };
            const previewItems = (r.services || []).slice(0, 3);
            return (
              <div key={`${r.kind}-${r.id}`} className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-colors p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-violet-300">{r.ref}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                      {r.kind === "intent" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                          <Clock className="h-2.5 w-2.5" /> Soumission
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-sm text-white font-semibold truncate">{r.client_name}</div>
                    <div className="text-[11px] text-white/60 truncate">{r.client_email}</div>
                    <div className="text-[11px] text-white/50 mt-1">{new Date(r.date).toLocaleDateString("fr-CA")}</div>
                    {previewItems.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {previewItems.map((item: any, idx: number) => (
                          <div key={idx} className="text-[11px] text-white/70 truncate">
                            {item?.name || item?.label || "Article"} — {displayPrice(item)}{item?.type !== "equipment" && item?.category !== "Équipement" ? "/mois" : ""}
                          </div>
                        ))}
                        <div className="text-[11px] text-white/60 truncate">{showDiscount(r.discount_data)}</div>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-white">{displayPrice({ amount: r.amount })}</div>
                    {r.commission_amount > 0 && (
                      <div className="mt-1 inline-flex items-center gap-1.5">
                        <span className="text-[10px] text-white/60">Comm.</span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${COMMISSION_CLS[r.commission_status || "pending"] || COMMISSION_CLS.pending}`}>
                          {displayPrice({ amount: r.commission_amount })}
                        </span>
                      </div>
                    )}
                    <div className="mt-2 flex justify-end gap-2">
                      {r.kind === "intent" && r.paypal_approval_url && (
                        <a
                          href={r.paypal_approval_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 text-[11px] font-bold"
                        >
                          Reprendre <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
              {r.kind === "intent" && !r.paypal_approval_url && (
                        <Link
                          to="/field/sale/new"
                          state={{ resumeIntentId: r.id, resumeQuoteId: r.quote_id }}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 text-[11px] font-bold"
                        >
                          Reprendre
                        </Link>
                      )}
                      {r.kind === "order" && (r.status === "pending_payment" || r.status === "on_hold") && (
                        <Link
                          to={`/field/orders/${r.id}?resume=1`}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 text-[11px] font-bold"
                        >
                          Reprendre
                        </Link>
                      )}
                      {r.kind === "order" && (
                        <Link
                          to={`/field/orders/${r.id}`}
                          className="inline-flex items-center gap-1 rounded-full bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-[11px] font-bold"
                        >
                          Voir détails
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
