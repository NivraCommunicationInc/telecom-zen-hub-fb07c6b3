/**
 * FieldSaleSuccess — Real sync visibility after submission.
 */
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Mail,
  MapPin,
  User,
  Wallet,
  Banknote,
  Headphones,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { FieldBadge, FieldPageHeader, FieldPanel } from "@/field-app/components/FieldUI";
import { cn } from "@/lib/utils";

const METHOD_DISPLAY: Record<string, { label: string; icon: typeof Wallet }> = {
  paypal: { label: "PayPal", icon: Wallet },
  interac: { label: "Virement Interac", icon: Banknote },
  deferred: { label: "Paiement différé", icon: Clock },
  send_link: { label: "Lien de paiement", icon: Wallet },
};

const syncSteps = [
  { key: "field", label: "Portail terrain", icon: MapPin, description: "Commande enregistrée" },
  { key: "core", label: "Système central", icon: Building2, description: "Synchronisation opérationnelle" },
  { key: "client", label: "Espace client", icon: User, description: "Suivi visible au client" },
  { key: "email", label: "Courriel", icon: Mail, description: "Confirmation envoyée" },
  { key: "support", label: "Support", icon: Headphones, description: "Dossier accessible au service client" },
] as const;

export default function FieldSaleSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const leadId = params.get("leadId") || "";
  const total = params.get("total") || "0.00";
  const paymentMethod = params.get("payment") || "paypal";
  const paymentStatus = params.get("status") || "pending";
  const syncFallback = params.get("sync") || "pending";
  const syncErrorFallback = params.get("syncError") || "";

  const method = METHOD_DISPLAY[paymentMethod] || METHOD_DISPLAY.paypal;
  const MethodIcon = method.icon;

  const { data: fieldOrder, isLoading } = useQuery({
    queryKey: ["field-sale-success-order", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_sales_orders")
        .select("id, customer_name, sync_status, sync_error, converted_order_id, synced_at, payment_status")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId,
    refetchInterval: (query) => {
      const status = query.state.data?.sync_status;
      return status === "pending" || !status ? 4000 : false;
    },
  });

  const effectiveSyncStatus = fieldOrder?.sync_status || syncFallback;
  const syncError = fieldOrder?.sync_error || syncErrorFallback;
  const isSynced = effectiveSyncStatus === "synced" || !!fieldOrder?.converted_order_id;
  const isSyncError = effectiveSyncStatus === "error";

  const statusTone = isSynced ? "success" : isSyncError ? "danger" : "warning";
  const statusLabel = isSynced ? "Synchronisation complète" : isSyncError ? "Synchronisation à suivre" : "Synchronisation en cours";
  const statusDescription = isSynced
    ? "La vente est maintenant visible pour les opérations et le support."
    : isSyncError
      ? syncError || "La commande est sauvegardée, mais elle doit être relancée depuis le détail de commande."
      : "Le dossier est créé et continue de se propager dans les systèmes. Vous pouvez suivre l'état en direct.";

  const completedCount = isSynced ? 5 : isSyncError ? 1 : 2;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <FieldPageHeader
        eyebrow="Commande soumise"
        title="Soumission terminée"
        description="Le portail vous montre maintenant le vrai état de synchronisation, sans zone floue."
      />

      <FieldPanel tone={statusTone as any} className="field-soft-shadow">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <FieldBadge tone={statusTone as any}>{statusLabel}</FieldBadge>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{isSynced ? "Commande prête pour les opérations" : isSyncError ? "Commande créée, suivi requis" : "Commande en propagation"}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{statusDescription}</p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-card px-5 py-4 shadow-card">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Référence terrain</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-lg font-semibold text-foreground">{leadId.slice(0, 8).toUpperCase()}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(leadId);
                  toast.success("Référence copiée");
                }}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Montant terrain: <span className="font-semibold text-foreground">{total} $</span></p>
          </div>
        </div>
      </FieldPanel>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <FieldPanel title="Propagation de la commande" description="Chaque étape reflète l'état réel de votre vente.">
          <div className="space-y-3">
            {syncSteps.map((step, index) => {
              const active = index < completedCount;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-start gap-3 rounded-[1.25rem] border border-border bg-card px-4 py-3 shadow-card">
                  <div
                    className={cn(
                      "mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border",
                      active
                        ? "border-[hsl(var(--field-success-border))] bg-[hsl(var(--field-success-bg))] text-[hsl(var(--field-success-fg))]"
                        : isSyncError && index === 1
                          ? "border-[hsl(var(--field-danger-border))] bg-[hsl(var(--field-danger-bg))] text-[hsl(var(--field-danger-fg))]"
                          : "border-border bg-secondary text-muted-foreground",
                    )}
                  >
                    {isLoading && index === 1 && !isSynced && !isSyncError ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{step.label}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </FieldPanel>

        <FieldPanel title="Résumé de vente" description="Informations à communiquer immédiatement au client si nécessaire.">
          <div className="space-y-3">
            <div className="rounded-[1.25rem] border border-border bg-card px-4 py-3 shadow-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Paiement</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <MethodIcon className="h-4 w-4 text-primary" />
                {method.label}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{paymentStatus === "completed" ? "Paiement confirmé." : "Paiement encore à suivre."}</p>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-card px-4 py-3 shadow-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">État sync</p>
              <div className="mt-2"><FieldBadge tone={statusTone as any}>{statusLabel}</FieldBadge></div>
              {syncError ? <p className="mt-2 text-sm text-muted-foreground">{syncError}</p> : null}
            </div>
            <div className="rounded-[1.25rem] border border-border bg-card px-4 py-3 shadow-card">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Prochaine action agent</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {isSynced ? "Confirmer au client que le dossier est pris en charge." : isSyncError ? "Ouvrir le détail de commande et relancer la sync." : "Surveiller le détail de commande jusqu'à confirmation."}
              </p>
            </div>
          </div>
        </FieldPanel>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => navigate(fieldPath(`/orders/${leadId}`))}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
        >
          Ouvrir le détail de commande
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigate(fieldPath("/submissions"))}
          className="inline-flex flex-1 items-center justify-center rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
        >
          Voir mes commandes
        </button>
        <button
          onClick={() => navigate(fieldPath("/sale/new"))}
          className="inline-flex flex-1 items-center justify-center rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
        >
          Nouvelle vente
        </button>
      </div>
    </div>
  );
}
