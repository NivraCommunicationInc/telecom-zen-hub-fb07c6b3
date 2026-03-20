/**
 * Step 7 — Final Review before submission.
 * Shows promos impact in financial summary.
 */
import { User, Package, Wrench, CreditCard, CalendarDays, Check, MapPin, Tag } from "lucide-react";
import type { FieldSaleDraft } from "@/field-app/lib/fieldSaleTypes";
// ⛔ LOCAL TAX MATH REMOVED — taxes computed server-side only

interface Props {
  draft: FieldSaleDraft;
  agentName: string;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#22C55E]" />
        <h3 className="text-sm font-semibold text-[#000000]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#6B7280]">{label}</span>
      <span className={bold ? "font-bold text-[#000000]" : negative ? "font-medium text-[#DC2626]" : "text-[#000000]"}>{value}</span>
    </div>
  );
}

export default function StepReview({ draft, agentName, onSubmit, onBack, isSubmitting }: Props) {
  const { customer, services, promos, equipment, installation, billing, payment } = draft;

  const monthlySubtotal = services.reduce((s, sv) => s + sv.monthlyPrice, 0);
  const equipmentTotal = equipment.reduce((s, e) => s + e.price * e.quantity, 0);
  const activationFee = services.length === 0 ? 0 : services.length === 1 ? 25 : 45;

  // Promo calculations
  const promoMonthlyDiscount = promos.reduce((sum, p) => {
    if (p.promo_type === "monthly_discount") return sum + p.discount_monthly;
    if (p.promo_type === "percentage_off") return sum + (monthlySubtotal * p.discount_percentage / 100);
    return sum;
  }, 0);
  const promoOnetimeDiscount = promos.reduce((sum, p) => {
    if (p.promo_type === "activation_credit") return sum + Math.min(p.discount_onetime, activationFee);
    if (p.promo_type === "free_installation") return sum + p.discount_onetime;
    return sum;
  }, 0);

  const effectiveMonthly = Math.max(0, monthlySubtotal - promoMonthlyDiscount);
  const effectiveActivation = Math.max(0, activationFee - promoOnetimeDiscount);
  const oneTimeSubtotal = equipmentTotal + effectiveActivation;
  const totalDueToday = effectiveMonthly + oneTimeSubtotal;
  // ⛔ NO LOCAL TAX MATH — display subtotal only
  const taxes = { tps: 0, tvq: 0, total: totalDueToday, taxableAmount: totalDueToday };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Confirmation finale</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">Vérifiez tous les détails avant de soumettre la commande.</p>
      </div>

      <Section icon={User} title="Client">
        <Row label="Nom" value={`${customer.first_name} ${customer.last_name}`} />
        <Row label="Téléphone" value={customer.phone} />
        {customer.email && <Row label="Courriel" value={customer.email} />}
        <Row label="Adresse" value={`${customer.address}, ${customer.city} ${customer.postal_code}`} />
      </Section>

      <Section icon={Package} title="Services">
        {services.map((s) => (
          <Row key={s.id} label={s.name} value={`${s.monthlyPrice.toFixed(2)} $/mois`} />
        ))}
        <div className="border-t border-[#E5E7EB] pt-2">
          <Row label="Sous-total mensuel" value={`${monthlySubtotal.toFixed(2)} $/mois`} bold />
        </div>
      </Section>

      {/* Promos */}
      {promos.length > 0 && (
        <Section icon={Tag} title="Promotions appliquées">
          {promos.map((p) => (
            <div key={p.id} className="text-sm">
              <span className="text-[#374151]">{p.name}</span>
              {p.promo_type === "monthly_discount" && (
                <span className="text-[#DC2626] ml-2 font-medium">-{p.discount_monthly.toFixed(2)} $/mois × {p.duration_months} mois</span>
              )}
              {(p.promo_type === "free_installation" || p.promo_type === "activation_credit") && (
                <span className="text-[#DC2626] ml-2 font-medium">-{p.discount_onetime.toFixed(2)} $</span>
              )}
            </div>
          ))}
        </Section>
      )}

      {equipment.length > 0 && (
        <Section icon={Package} title="Équipement">
          {equipment.map((e) => (
            <Row key={e.id} label={`${e.name} x${e.quantity}`} value={`${(e.price * e.quantity).toFixed(2)} $`} />
          ))}
        </Section>
      )}

      <Section icon={Wrench} title="Installation">
        <Row
          label="Type"
          value={installation.type === "technician" ? "Installation technicien" : "Auto-installation / Expédition"}
        />
        {installation.scheduledDate && (
          <Row
            label="Date"
            value={new Date(installation.scheduledDate + "T12:00:00").toLocaleDateString("fr-CA", {
              weekday: "long", day: "numeric", month: "long",
            })}
          />
        )}
        {installation.timeWindow && <Row label="Plage horaire" value={installation.timeWindow} />}
      </Section>

      <Section icon={CreditCard} title="Paiement">
        <Row
          label="Méthode"
          value={payment.method === "send_link" ? "Lien de paiement" : "Carte sur place"}
        />
        <Row
          label="Statut"
          value={
            payment.status === "completed" ? "✅ Payé" :
            payment.status === "sent" ? "📧 Lien envoyé" : "⏳ En attente"
          }
        />
        {payment.linkSentTo && <Row label="Envoyé à" value={payment.linkSentTo} />}
        <Row label="Paiement pré-autorisé" value={billing.preauthorizedPayment ? "Oui" : "Non"} />
      </Section>

      {/* Financial summary */}
      <div className="bg-[#000000] text-white rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Résumé financier</h3>
        <Row label="Premier mois" value={`${monthlySubtotal.toFixed(2)} $`} />
        {promoMonthlyDiscount > 0 && (
          <Row label="Réduction mensuelle" value={`-${promoMonthlyDiscount.toFixed(2)} $`} negative />
        )}
        <Row label="Frais uniques" value={`${(equipmentTotal + activationFee).toFixed(2)} $`} />
        {promoOnetimeDiscount > 0 && (
          <Row label="Réduction frais uniques" value={`-${promoOnetimeDiscount.toFixed(2)} $`} negative />
        )}
        <div className="text-xs space-y-1 pt-1">
          <div className="flex justify-between text-[#9CA3AF]">
            <span>TPS (5%)</span>
            <span>Calculé au traitement</span>
          </div>
          <div className="flex justify-between text-[#9CA3AF]">
            <span>TVQ (9.975%)</span>
            <span>Calculé au traitement</span>
          </div>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#374151]">
          <span>Total aujourd'hui</span>
          <span className="text-[#22C55E]">{taxes.total.toFixed(2)} $</span>
        </div>
      </div>

      <div className="bg-[#F3F4F6] rounded-xl p-4 text-xs text-[#6B7280]">
        <span className="font-medium text-[#374151]">Agent :</span> {agentName}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
          ← Modifier
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-lg bg-[#22C55E] text-white text-sm font-bold hover:bg-[#16A34A] disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Soumission…" : "✓ Soumettre la commande"}
        </button>
      </div>
    </div>
  );
}
