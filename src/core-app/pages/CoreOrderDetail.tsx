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
import { StepContent } from "@/core-app/components/order-processing/StepContent";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve a route param to a real `orders.id`. Admin must be able to open ANY
 * order — including field_payment_intents that are still pending_payment. In
 * that case we materialize the order via the canonical engine (from quote_id)
 * so the standard CoreOrderDetail page renders with full processing options.
 */
async function resolveOrderRouteParam(param: string): Promise<string> {
  const value = decodeURIComponent(param).trim();
  if (!value) throw new Error("Identifiant de commande manquant");

  if (UUID_RE.test(value)) {
    const { data: byId } = await supabase.from("orders").select("id").eq("id", value).maybeSingle();
    if (byId?.id) return byId.id;
  }

  const { data: byNumber } = await supabase
    .from("orders").select("id").eq("order_number", value).maybeSingle();
  if (byNumber?.id) return byNumber.id;

  if (UUID_RE.test(value)) {
    const { data: intent } = await supabase
      .from("field_payment_intents" as any)
      .select("id, quote_id, agent_id, converted_order_id")
      .eq("id", value)
      .maybeSingle();

    if (intent) {
      const row = intent as any;
      if (row.converted_order_id) return row.converted_order_id as string;
      if (!row.quote_id) throw new Error("Intention sans soumission liée — impossible à matérialiser");

      const { data, error } = await supabase.functions.invoke("field-order-engine", {
        body: { action: "materialize_from_quote", quote_id: row.quote_id, agent_id: row.agent_id },
      });
      if (error) throw new Error(error.message || "Échec de la matérialisation de la commande FIELD");
      const newId = (data as any)?.order_id;
      if (!newId) throw new Error("Le moteur FIELD n'a pas retourné d'identifiant de commande");

      // Link the intent → order so subsequent opens are instant and the
      // card-manual panel (queried by field_payment_intent_id) can attach.
      await supabase
        .from("field_payment_intents" as any)
        .update({ converted_order_id: newId } as any)
        .eq("id", row.id);

      return newId as string;
    }
  }

  throw new Error("Commande introuvable");
}

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

  return <OrderConsole orderId={resolver.data} />;
}


function PendingFieldIntentView({ intent, routeParam }: { intent: any; routeParam: string }) {
  const qc = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: card, isLoading, refetch } = useQuery({
    queryKey: ["pending-field-card-intent", intent.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("card_payment_intents")
        .select("*")
        .eq("field_payment_intent_id", intent.id)
        .in("status", ["pending_processing", "processing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 15000,
  });

  const amount = Number(intent.total_amount ?? intent.amount ?? 0).toLocaleString("fr-CA", {
    style: "currency", currency: "CAD",
  });

  const handleProcess = async () => {
    if (!card) return;
    setError(null);
    setProcessing(true);
    try {
      const { data, error: invErr } = await supabase.functions.invoke("core-process-card-payment", {
        body: { card_intent_id: card.id },
      });
      if (invErr) throw invErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Paiement carte confirmé", {
        description: `PayPal ${(data as any)?.paypal_order_id?.slice(0, 8) || ""}`,
      });
      // Re-resolve — converted_order_id should now exist → routes to full OrderConsole
      await qc.invalidateQueries({ queryKey: ["core-order-detail-resolve", routeParam] });
      await qc.invalidateQueries({ queryKey: ["admin-orders-v2"] });
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      toast.error("Paiement refusé", { description: msg });
      setProcessing(false);
      await refetch();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e16] text-white">
      <div className="bg-[#0f1623] border-b border-[#1e2535] px-4 py-3 flex items-center gap-3">
        <Link to={corePath("/orders")} className="text-[#8b9ab0] hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-medium text-white truncate font-mono">
            #FIELD-{String(intent.id).slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-[11px] text-[#8b9ab0] mt-0.5 truncate">
            Vente terrain · {intent.client_email || intent.customer_email || "—"} · {amount}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-[3px] rounded-full bg-[#7c3a00] text-[#ffb74d]">
          {intent.status}
        </span>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#8b9ab0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l'intention…
          </div>
        ) : !card ? (
          <div className="rounded-lg border border-[#5a4200] bg-[#2d1f00] p-4 text-[12px] text-[#ffd54f]">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <AlertTriangle className="h-4 w-4" /> Aucune carte manuelle en attente
            </div>
            Cette vente terrain est en attente de paiement, mais aucune intention carte n'a été déposée.
            L'agent doit relancer le flux PayPal côté Field.
          </div>
        ) : (
          <div className="rounded-lg border border-[#7C3AED]/40 bg-gradient-to-br from-[#1a1033] to-[#0f0a1f] p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-[#A78BFA]" />
              <h3 className="text-sm font-semibold text-white">💳 Paiement carte manuelle en attente</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-[12px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#6b7a90]">Marque</div>
                <div className="text-white font-medium">{(card.card_brand || "card").toUpperCase()}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#6b7a90]">N°</div>
                <div className="text-white font-mono">•••• {card.card_last4}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#6b7a90]">Expiration</div>
                <div className="text-white font-mono">{card.card_expiry}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#6b7a90]">Titulaire</div>
                <div className="text-white truncate" title={card.card_name}>{card.card_name}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#8b9ab0] mb-3">
              <ShieldCheck className="h-3.5 w-3.5 text-[#A78BFA]" />
              Données chiffrées (AES-256-GCM). Supprimées après traitement.
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded border border-red-500/40 bg-red-500/10 p-2 mb-3 text-[11px] text-red-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <button
              type="button"
              onClick={handleProcess}
              disabled={processing}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-[12px] font-semibold text-white transition-colors"
            >
              {processing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Traitement PayPal en cours…</>
              ) : (
                <>Traiter le paiement via PayPal — {Number(card.amount).toLocaleString("fr-CA", { style: "currency", currency: card.currency || "CAD" })}</>
              )}
            </button>
            <p className="text-[10px] text-[#6b7a90] mt-3 text-center">
              Le dossier de commande complet s'ouvrira automatiquement dès la capture confirmée.
            </p>
          </div>
        )}
      </div>
    </div>
  );
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
