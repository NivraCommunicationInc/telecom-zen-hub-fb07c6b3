/**
 * StepReview — Final review before submission with confidence signals.
 */
import { AlertCircle, CreditCard, Loader2, Package, Tag, User, Wrench } from "lucide-react";
import type { FieldSaleDraft } from "@/field-app/lib/fieldSaleTypes";
import { FieldBadge, FieldPanel } from "@/field-app/components/FieldUI";

interface Props {
  draft: FieldSaleDraft;
  agentName: string;
  activationFee: number;
  submitPhase: "idle" | "creating" | "syncing" | "finalizing" | "error";
  submitMessage: string;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

function Row({ label, value, emphasis = false, danger = false }: { label: string; value: string; emphasis?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={danger ? "font-medium text-destructive" : emphasis ? "font-semibold text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <FieldPanel title={title} className="rounded-[1.5rem] p-0" contentClassName="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      {children}
    </FieldPanel>
  );
}

export default function StepReview({
  draft,
  agentName,
  activationFee,
  submitPhase,
  submitMessage,
  onSubmit,
  onBack,
  isSubmitting,
}: Props) {
  const { customer, services, promos, equipment, installation, billing, payment } = draft;

  const monthlySubtotal = services.reduce((sum, service) => sum + service.monthlyPrice, 0);
  const equipmentTotal = equipment.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const promoMonthlyDiscount = promos.reduce((sum, promo) => {
    if (promo.promo_type === "monthly_discount") return sum + promo.discount_monthly;
    if (promo.promo_type === "percentage_off") return sum + (monthlySubtotal * promo.discount_percentage) / 100;
    return sum;
  }, 0);

  const promoOnetimeDiscount = promos.reduce((sum, promo) => {
    if (promo.promo_type === "activation_credit") return sum + Math.min(promo.discount_onetime, activationFee);
    if (promo.promo_type === "free_installation") return sum + promo.discount_onetime;
    return sum;
  }, 0);

  const effectiveMonthly = Math.max(0, monthlySubtotal - promoMonthlyDiscount);
  const effectiveActivation = Math.max(0, activationFee - promoOnetimeDiscount);
  const totalDueToday = effectiveMonthly + equipmentTotal + effectiveActivation;

  const phaseTone = submitPhase === "error" ? "danger" : submitPhase === "idle" ? "default" : "warning";
  const phaseLabel =
    submitPhase === "creating"
      ? "Création"
      : submitPhase === "syncing"
        ? "Synchronisation"
        : submitPhase === "finalizing"
          ? "Finalisation"
          : submitPhase === "error"
            ? "À corriger"
            : "Prêt";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Confirmation finale</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Vérifiez les informations critiques avant d'envoyer la commande. L'agent doit pouvoir expliquer clairement ce qui se passe ensuite.
        </p>
      </div>

      {(submitPhase !== "idle" || submitMessage) && (
        <div className="rounded-[1.5rem] border border-border bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            {submitPhase === "error" ? (
              <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
            ) : (
              <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-primary" />
            )}
            <div className="space-y-2">
              <FieldBadge tone={phaseTone as any}>{phaseLabel}</FieldBadge>
              <p className="text-sm leading-6 text-foreground">{submitMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <FieldPanel title="Client" description="Identité, coordonnées et adresse de service.">
          <Row label="Nom" value={`${customer.first_name} ${customer.last_name}`} emphasis />
          <Row label="Date de naissance" value={customer.date_of_birth ? new Date(`${customer.date_of_birth}T12:00:00`).toLocaleDateString("fr-CA") : "—"} />
          <Row label="Téléphone" value={customer.phone} />
          <Row label="Courriel" value={customer.email} />
          <Row label="Adresse" value={`${customer.address}, ${customer.city} ${customer.postal_code}`} />
        </FieldPanel>

        <FieldPanel title="Paiement & installation" description="Le client doit comprendre quoi payer et quelle est la prochaine étape.">
          <Row
            label="Méthode de paiement"
            value={
              payment.method === "paypal"
                ? "PayPal"
                : payment.method === "interac"
                  ? "Virement Interac"
                  : payment.method === "send_link"
                    ? "Lien de paiement"
                    : "Carte sur place"
            }
            emphasis
          />
          <Row
            label="Statut"
            value={payment.status === "completed" ? "Payé" : payment.status === "sent" ? "Lien envoyé" : "En attente"}
          />
          <Row label="Préautorisation" value={billing.preauthorizedPayment ? "Oui" : "Non"} />
          <Row
            label="Installation"
            value={installation.type === "technician" ? "Technicien" : "Auto-installation / expédition"}
          />
          {installation.scheduledDate ? (
            <Row
              label="Date prévue"
              value={new Date(`${installation.scheduledDate}T12:00:00`).toLocaleDateString("fr-CA", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            />
          ) : null}
          {installation.timeWindow ? <Row label="Plage horaire" value={installation.timeWindow} /> : null}
        </FieldPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FieldPanel title="Services" description="Résumé commercial présenté au client.">
          <div className="space-y-3">
            {services.map((service) => (
              <Row key={service.id} label={service.name} value={`${service.monthlyPrice.toFixed(2)} $/mois`} />
            ))}
            <div className="border-t border-border pt-3">
              <Row label="Sous-total mensuel" value={`${monthlySubtotal.toFixed(2)} $/mois`} emphasis />
            </div>
          </div>
        </FieldPanel>

        <FieldPanel title="Équipement & promos" description="Ce qui modifie le coût affiché aujourd'hui.">
          <div className="space-y-3">
            {equipment.length > 0 ? equipment.map((item) => (
              <Row key={item.id} label={`${item.name} × ${item.quantity}`} value={`${(item.price * item.quantity).toFixed(2)} $`} />
            )) : <Row label="Équipement" value="Aucun" />}
            {promos.map((promo) => (
              <Row
                key={promo.id}
                label={promo.name}
                value={promo.promo_type === "monthly_discount" ? `-${promo.discount_monthly.toFixed(2)} $/mois` : `-${promo.discount_onetime.toFixed(2)} $`}
                danger
              />
            ))}
          </div>
        </FieldPanel>
      </div>

      <FieldPanel title="Résumé financier" description="Sous-total terrain visible maintenant. Les taxes sont calculées au traitement central.">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <Row label="Premier mois" value={`${monthlySubtotal.toFixed(2)} $`} />
            {promoMonthlyDiscount > 0 ? <Row label="Réduction mensuelle" value={`-${promoMonthlyDiscount.toFixed(2)} $`} danger /> : null}
            <Row label="Frais d'activation" value={`${activationFee.toFixed(2)} $`} />
            <Row label="Équipement" value={`${equipmentTotal.toFixed(2)} $`} />
            {promoOnetimeDiscount > 0 ? <Row label="Crédits immédiats" value={`-${promoOnetimeDiscount.toFixed(2)} $`} danger /> : null}
            <Row label="Taxes" value="Calculées au traitement" />
          </div>
          <div className="rounded-[1.5rem] border border-[hsl(var(--field-premium-border))] bg-[linear-gradient(135deg,hsl(var(--field-hero-from)),hsl(var(--field-hero-to)))] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Aujourd'hui</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{totalDueToday.toFixed(2)} $</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Sous-total avant taxes, prêt à être expliqué clairement au client.</p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Agent: <span className="font-medium text-foreground">{agentName}</span></div>
              <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Paiement: <span className="font-medium text-foreground">{payment.status === "completed" ? "confirmé" : "à suivre"}</span></div>
              <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /> Installation: <span className="font-medium text-foreground">{installation.type === "technician" ? "technicien" : "self-install"}</span></div>
            </div>
          </div>
        </div>
      </FieldPanel>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:shadow-card"
        >
          Retour modifier
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-elevated disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Soumission en cours…" : "Soumettre la commande"}
        </button>
      </div>
    </div>
  );
}
