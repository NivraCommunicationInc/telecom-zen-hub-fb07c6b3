/**
 * CoreOrderDetail — Order processing console.
 *
 * Layout matches the canonical HTML reference:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ HEADER (#0f1623 dark) — id · client · pills · SLA    │
 *   ├──────────────────────────────────────────────────────┤
 *   │ STEP RAIL (#0b0f1a) — horizontal scrollable tabs     │
 *   ├──────────────┬───────────────────────────────────────┤
 *   │ SIDEBAR 200px│  CONTENT (StepContent)                │
 *   │  · steps     │                                       │
 *   │  · quick acts│                                       │
 *   ├──────────────┴───────────────────────────────────────┤
 *   │ ACTION BAR — client summary · primary CTA            │
 *   └──────────────────────────────────────────────────────┘
 *
 * Logic-level imports / state / mutations are unchanged.
 */
import type { ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrderProcessing, WorkflowStepId, WorkflowStep } from "@/core-app/hooks/useOrderProcessing";
import { corePath } from "@/core-app/lib/corePaths";
import { CoreActivityTimeline } from "@/core-app/components/order-detail/CoreActivityTimeline";
import { CoreKycPanel } from "@/core-app/components/order-detail/CoreKycPanel";
import { CoreOrderHeader } from "@/core-app/components/order-detail/CoreOrderHeader";
import { CoreQuickActions } from "@/core-app/components/order-detail/CoreQuickActions";
import { CoreCardManualPanel } from "@/core-app/components/order-detail/CoreCardManualPanel";
import { CorePaymentOptionsPanel } from "@/core-app/components/order-detail/CorePaymentOptionsPanel";
import { StepContent } from "@/core-app/components/order-processing/StepContent";
import { ArrowLeft, CreditCard, ExternalLink, Loader2, Mail, RefreshCw, ShoppingCart, User } from "lucide-react";
import { resolveOrderRouteParam } from "@/shared-ops/orderRouteResolver";

const CoreOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();

  if (!orderId) {
    return (
      <div className="py-20 text-center">
        <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-[#6b7a90]" />
        <p className="text-[#8b9ab0] text-xs">Commande introuvable</p>
        <Link to={corePath("/orders")} className="text-[#64b5f6] text-xs mt-2 inline-block hover:opacity-80">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  return <OrderResolver routeParam={orderId} />;
};

function OrderResolver({ routeParam }: { routeParam: string }) {
  const resolver = useQuery({
    queryKey: ["core-order-detail-resolve", routeParam],
    queryFn: () => resolveOrderRouteParam(routeParam),
    retry: false,
    staleTime: 30_000,
  });

  if (resolver.isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-[#0a0e16]">
        <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
        <span className="ml-3 text-xs text-[#8b9ab0]">Résolution du dossier…</span>
      </div>
    );
  }

  if (resolver.error || !resolver.data) {
    return (
      <div className="rounded-lg border border-[#7f0000] bg-[#2d0a0a] p-8 text-center">
        <p className="text-[#ef9a9a] font-medium text-sm">Erreur de chargement</p>
        <p className="text-xs text-[#8b9ab0] mt-1">
          {resolver.error instanceof Error ? resolver.error.message : "Commande introuvable"}
        </p>
        <Link to={corePath("/orders")} className="text-[#64b5f6] text-xs mt-3 inline-block hover:opacity-80">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  if (resolver.data.kind === "field_payment_intent") {
    return <PendingFieldPaymentConsole intentId={resolver.data.intentId} />;
  }

  return <OrderConsole orderId={resolver.data.orderId} />;
}

function PendingFieldPaymentConsole({ intentId }: { intentId: string }) {
  const pending = useQuery({
    queryKey: ["core-field-payment-intent-detail", intentId],
    queryFn: async () => {
      const { data: intent, error } = await supabase
        .from("field_payment_intents" as any)
        .select("id, quote_id, agent_id, amount, currency, status, payment_method, customer_name, customer_email, paypal_order_id, paypal_approval_url, paid_at, expires_at, converted_order_id, created_at")
        .eq("id", intentId)
        .maybeSingle();
      if (error) throw error;
      if (!intent) throw new Error("Commande terrain introuvable");
      if ((intent as any).converted_order_id) return { intent, quote: null, convertedOrderId: (intent as any).converted_order_id as string, agent: null };

      const { data: quote } = (intent as any).quote_id
        ? await supabase
            .from("field_quotes" as any)
            .select("client_info, services, equipment, discount, activation_fee, subtotal, tps, tvq, total, status, agent_name, valid_until")
            .eq("id", (intent as any).quote_id)
            .maybeSingle()
        : { data: null };

      const { data: agent } = (intent as any).agent_id
        ? await supabase.from("profiles").select("full_name, email").eq("user_id", (intent as any).agent_id).maybeSingle()
        : { data: null };
      return { intent, quote, agent, convertedOrderId: null as string | null };
    },
    refetchInterval: 15000,
  });

  if (pending.isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-[#0a0e16]">
        <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
        <span className="ml-3 text-xs text-[#8b9ab0]">Chargement de la vente terrain…</span>
      </div>
    );
  }

  if (pending.data?.convertedOrderId) return <OrderConsole orderId={pending.data.convertedOrderId} />;

  if (pending.error || !pending.data?.intent) {
    return (
      <div className="rounded-lg border border-[#7f0000] bg-[#2d0a0a] p-8 text-center">
        <p className="text-[#ef9a9a] font-medium text-sm">Erreur de chargement</p>
        <p className="text-xs text-[#8b9ab0] mt-1">{pending.error instanceof Error ? pending.error.message : "Commande terrain introuvable"}</p>
        <Link to={corePath("/orders")} className="text-[#64b5f6] text-xs mt-3 inline-block hover:opacity-80">← Retour aux commandes</Link>
      </div>
    );
  }

  const intent: any = pending.data.intent;
  const quote: any = pending.data.quote;
  const clientInfo = quote?.client_info || {};
  const clientName = intent.customer_name || [clientInfo.first_name, clientInfo.last_name].filter(Boolean).join(" ") || "—";
  const clientEmail = intent.customer_email || clientInfo.email || "—";
  const services = Array.isArray(quote?.services) ? quote.services : [];
  const equipment = Array.isArray(quote?.equipment) ? quote.equipment : [];
  const amount = Number(intent.amount || quote?.total || 0).toLocaleString("fr-CA", { style: "currency", currency: intent.currency || "CAD" });
  const paymentUrl = `${window.location.origin}/payer/${intent.id}`;
  const expired = intent.expires_at && new Date(intent.expires_at).getTime() < Date.now();

  return (
    <div className="space-y-3">
      <Link to={corePath("/orders")} className="inline-flex items-center gap-1.5 text-[11px] text-[#6b7a90] hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Commandes
      </Link>

      <div className="rounded-lg border border-[#1e2535] bg-[#0a0e16] overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#1e2535] bg-[#0f1623] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#a78bfa] text-[11px] font-semibold uppercase tracking-wide">
              <CreditCard className="h-4 w-4" /> Vente terrain en attente de paiement
            </div>
            <h1 className="text-white text-xl font-bold mt-1">FIELD-{String(intent.id).slice(0, 8).toUpperCase()}</h1>
            <p className="text-[#8b9ab0] text-xs mt-1">La commande Core sera créée automatiquement dès que le paiement est confirmé.</p>
          </div>
          <div className="text-right">
            <div className="text-white text-2xl font-bold">{amount}</div>
            <div className={`text-[11px] font-semibold ${expired ? "text-red-300" : "text-amber-300"}`}>{expired ? "Lien expiré" : intent.status || "pending"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0">
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InfoTile icon={<User className="h-4 w-4" />} label="Client" value={clientName} sub={clientEmail} />
              <InfoTile icon={<Mail className="h-4 w-4" />} label="Agent" value={quote?.agent_name || pending.data.agent?.full_name || "—"} sub={pending.data.agent?.email || ""} />
              <InfoTile icon={<CreditCard className="h-4 w-4" />} label="Paiement" value={intent.payment_method || "PayPal"} sub={intent.paypal_order_id || "En attente"} />
            </div>

            <DetailSection title="Services">
              {services.length ? services.map((item: any, idx: number) => <LineItem key={`s-${idx}`} item={item} />) : <EmptyLine />}
            </DetailSection>

            <DetailSection title="Équipement">
              {equipment.length ? equipment.map((item: any, idx: number) => <LineItem key={`e-${idx}`} item={item} />) : <EmptyLine />}
            </DetailSection>
          </div>

          <aside className="border-l border-[#1e2535] bg-[#0d121d] p-5 space-y-3">
            <a href={paymentUrl} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#7C3AED] hover:bg-[#6d28d9] px-4 py-2.5 text-xs font-bold text-white transition-colors">
              <ExternalLink className="h-4 w-4" /> Ouvrir lien client
            </a>
            {intent.paypal_approval_url && (
              <a href={intent.paypal_approval_url} target="_blank" rel="noreferrer" className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#7C3AED]/50 bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 px-4 py-2.5 text-xs font-bold text-[#c4b5fd] transition-colors">
                <ExternalLink className="h-4 w-4" /> Ouvrir PayPal
              </a>
            )}
            <button onClick={() => pending.refetch()} className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#263247] bg-[#101827] hover:bg-[#162036] px-4 py-2.5 text-xs font-bold text-[#c0c9d8] transition-colors">
              <RefreshCw className="h-4 w-4" /> Vérifier statut
            </button>
            <div className="rounded-lg border border-[#263247] bg-[#0a0e16] p-3 text-[11px] text-[#8b9ab0] space-y-1">
              <div>ID intent: <span className="font-mono text-white">{intent.id}</span></div>
              <div>Soumission: <span className="font-mono text-white">{intent.quote_id || "—"}</span></div>
              <div>Expire: <span className="text-white">{intent.expires_at ? new Date(intent.expires_at).toLocaleString("fr-CA") : "—"}</span></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return <div className="rounded-lg border border-[#1e2535] bg-[#0f1623] p-3"><div className="flex items-center gap-1.5 text-[#8b9ab0] text-[10px] uppercase font-semibold">{icon}{label}</div><div className="text-white text-sm font-semibold mt-1 truncate">{value}</div>{sub && <div className="text-[#6b7a90] text-[11px] truncate">{sub}</div>}</div>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-lg border border-[#1e2535] bg-[#0f1623] p-4"><h2 className="text-[11px] text-[#8b9ab0] font-semibold uppercase mb-2">{title}</h2><div className="divide-y divide-[#1e2535]">{children}</div></div>;
}

function LineItem({ item }: { item: any }) {
  const name = item?.name || item?.label || item?.title || "Article";
  const price = Number(item?.monthlyPrice ?? item?.monthly_price ?? item?.price ?? item?.unit_price ?? item?.amount ?? 0);
  const quantity = Number(item?.quantity || 1);
  return <div className="flex items-center justify-between gap-3 py-2 text-xs"><span className="text-white truncate">{name}{quantity > 1 ? ` ×${quantity}` : ""}</span><span className="text-[#c0c9d8] font-mono">{(price * quantity).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>;
}

function EmptyLine() {
  return <div className="py-2 text-xs text-[#6b7a90]">Aucun élément.</div>;
}




function OrderConsole({ orderId }: { orderId: string }) {
  const proc = useOrderProcessing(orderId);

  if (proc.isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-[#0a0e16]">
        <Loader2 className="h-6 w-6 animate-spin text-[#3b82f6]" />
        <span className="ml-3 text-xs text-[#8b9ab0]">Chargement du dossier…</span>
      </div>
    );
  }

  if (proc.error || !proc.order) {
    return (
      <div className="rounded-lg border border-[#7f0000] bg-[#2d0a0a] p-8 text-center">
        <p className="text-[#ef9a9a] font-medium text-sm">Erreur de chargement</p>
        <p className="text-xs text-[#8b9ab0] mt-1">
          {proc.error instanceof Error ? proc.error.message : "Commande introuvable"}
        </p>
        <Link to={corePath("/orders")} className="text-[#64b5f6] text-xs mt-3 inline-block hover:opacity-80">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  const order = proc.order;
  const profile = proc.profile;
  const account = proc.account;

  const clientName =
    profile?.full_name ||
    [order.client_first_name, order.client_last_name].filter(Boolean).join(" ") ||
    order.client_full_name ||
    "—";
  const clientEmail = order.client_email || profile?.email || "—";
  const clientPhone = order.client_phone || profile?.phone || "";
  const orderNumber = order.order_number || `#${order.id.slice(0, 8)}`;
  const totalAmount = order.total_amount != null
    ? `${Number(order.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
    : "—";

  // Build header product-line summary (e.g. "GIGA + TV 25 choix · Terminal Nivra 4K · Router Born Wifi")
  const lineItems: string[] = Array.isArray((order as any).items)
    ? ((order as any).items as any[]).map((it) => it?.name || it?.label).filter(Boolean)
    : [];
  const productSummary = lineItems.length
    ? lineItems.join(" · ")
    : (order.service_type || "—");

  return (
    <div className="space-y-2">
      {/* Back nav */}
      <Link
        to={corePath("/orders")}
        className="inline-flex items-center gap-1.5 text-[11px] text-[#6b7a90] hover:text-white transition-colors mb-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Commandes
      </Link>

      {/* Card-manual processing panel — visible only when a pending intent exists */}
      {order.payment_method === "card_manual" && (
        <CoreCardManualPanel orderId={order.id} orderReference={null} />
      )}

      {/* Payment options — link by email / direct PayPal / manual confirm */}
      <CorePaymentOptionsPanel
        orderId={order.id}
        orderNumber={orderNumber}
        totalAmount={order.total_amount != null ? Number(order.total_amount) : null}
        clientEmail={order.client_email || profile?.email || null}
        paymentStatus={(order as any).payment_status ?? null}
        orderStatus={order.status ?? null}
        onChanged={() => proc.refetch()}
      />


      {/* Main shell — single dark container */}
      <div className="rounded-lg border border-[#1e2535] bg-[#0a0e16] overflow-hidden shadow-2xl">
        {/* HEADER */}
        <CoreOrderHeader
          order={order}
          profile={profile}
          account={account}
          clientName={clientName}
          clientEmail={clientEmail}
          clientPhone={clientPhone}
          productSummary={productSummary}
          orderNumber={orderNumber}
          totalAmount={totalAmount}
          onRefresh={() => proc.refetch()}
        />

        {/* HORIZONTAL STEP RAIL */}
        <HorizontalStepRail
          steps={proc.workflow}
          activeStep={proc.activeStep}
          onStepClick={(id) => proc.setActiveStep(id)}
        />

        {/* BODY: SIDEBAR | CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] min-h-[560px]">
          {/* SIDEBAR */}
          <SidebarStepList
            steps={proc.workflow}
            activeStep={proc.activeStep}
            onStepClick={(id) => proc.setActiveStep(id)}
            proc={proc}
          />

          {/* CONTENT */}
          <div className="bg-[#0a0e16] border-l border-[#1e2535] overflow-x-auto">
            <div className="p-4">
              <StepContent proc={proc} />
            </div>
          </div>
        </div>

        {/* ACTION BAR — fixed bottom of console */}
        <div className="px-4 py-2.5 border-t border-[#1e2535] bg-[#0f1623] flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-[11px] text-[#8b9ab0] flex-wrap min-w-0">
            <span>Client: <strong className="text-white">{clientName}</strong></span>
            <span className="text-[#3a4456]">·</span>
            <span>Compte: <strong className="text-white font-mono">{account?.account_number || "—"}</strong></span>
            <span className="text-[#3a4456]">·</span>
            <span>Total: <strong className="text-[#81c784]">{totalAmount}</strong></span>
          </div>
        </div>
      </div>

      {/* KYC panel + Activity timeline (preserved, below the console) */}
      <div className="space-y-3 mt-3">
        <CoreKycPanel order={proc.order} onRefresh={() => proc.refetch()} />
        <CoreActivityTimeline logs={proc.activityLogs} onAddNote={proc.addNote} orderId={proc.order?.id} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * HORIZONTAL STEP RAIL — dark scrollable tabs
 * ═══════════════════════════════════════════════════════ */
function HorizontalStepRail({
  steps,
  activeStep,
  onStepClick,
}: {
  steps: WorkflowStep[];
  activeStep: WorkflowStepId;
  onStepClick: (id: WorkflowStepId) => void;
}) {
  return (
    <div className="flex overflow-x-auto bg-[#0b0f1a] border-b border-[#1e2535] scrollbar-thin">
      {steps.map((step, idx) => {
        const isActive = step.id === activeStep;
        const isCompleted = step.status === "completed";
        const isBlocked = step.status === "blocked";

        let cls =
          "shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] cursor-pointer border-r border-[#1e2535] transition-colors whitespace-nowrap ";
        if (isActive) {
          cls += "bg-[#131929] text-white border-b-2 border-b-[#3b82f6]";
        } else if (isCompleted) {
          cls += "text-[#4caf50] hover:bg-[#131929] hover:text-[#a5d6a7]";
        } else if (isBlocked) {
          cls += "text-[#f59e0b] hover:bg-[#131929]";
        } else {
          cls += "text-[#6b7a90] hover:bg-[#131929] hover:text-[#c0c9d8]";
        }

        return (
          <button key={step.id} onClick={() => onStepClick(step.id)} className={cls} title={step.label}>
            <span className="text-[10px] opacity-60 font-mono">{idx + 1}</span>
            {step.label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * SIDEBAR — vertical step list + quick actions
 * ═══════════════════════════════════════════════════════ */
function SidebarStepList({
  steps,
  activeStep,
  onStepClick,
  proc,
}: {
  steps: WorkflowStep[];
  activeStep: WorkflowStepId;
  onStepClick: (id: WorkflowStepId) => void;
  proc: any;
}) {
  return (
    <aside className="bg-[#0d121d] py-3 px-2">
      <div className="text-[10px] font-semibold tracking-[0.07em] uppercase text-[#6b7a90] px-2 pb-1.5">
        Navigation
      </div>

      <nav className="space-y-0.5">
        {steps.map((step, idx) => {
          const isActive = step.id === activeStep;
          const isCompleted = step.status === "completed";
          const isBlocked = step.status === "blocked";

          let rowCls =
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12px] transition-colors ";
          if (isActive) {
            rowCls += "bg-[#0a0e16] text-white font-medium";
          } else if (isCompleted) {
            rowCls += "text-[#9eb0c5] hover:bg-[#0a0e16] hover:text-white";
          } else if (isBlocked) {
            rowCls += "text-[#f59e0b] hover:bg-[#0a0e16]";
          } else {
            rowCls += "text-[#7c8ba1] hover:bg-[#0a0e16] hover:text-[#c0c9d8]";
          }

          let iconCls =
            "w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center text-[9px] shrink-0 ";
          if (isCompleted) {
            iconCls += "bg-[#1b4a1b] border-[#2e7d32] text-[#81c784]";
          } else if (isActive) {
            iconCls += "bg-[#1565c0] border-[#1976d2] text-[#90caf9]";
          } else if (isBlocked) {
            iconCls += "bg-[#5a3500] border-[#f59e0b] text-[#ffd54f]";
          } else {
            iconCls += "border-[#2a3142] text-[#6b7a90]";
          }

          return (
            <button key={step.id} onClick={() => onStepClick(step.id)} className={rowCls}>
              <span className={iconCls}>
                {isCompleted ? "✓" : isBlocked ? "!" : idx + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="h-px bg-[#1e2535] my-3" />

      <div className="text-[10px] font-semibold tracking-[0.07em] uppercase text-[#6b7a90] px-2 pb-1.5">
        Actions rapides
      </div>
      <CoreQuickActions proc={proc} layout="sidebar" />
    </aside>
  );
}

export default CoreOrderDetail;
