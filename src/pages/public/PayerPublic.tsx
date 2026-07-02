import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Search, ShieldCheck, CreditCard, ArrowLeft, Mail, Copy, Check,
  CheckCircle2, ExternalLink, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SquarePaymentForm } from "@/components/payment/SquarePaymentForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface LookupInvoice {
  id: string;
  invoice_number: string;
  total: number;
  balance_due: number;
  due_date: string | null;
  first_name: string;
  email: string | null;
}

const fmt = (n: number) =>
  n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

function InteracBlock({ amount, reference }: { amount: number; reference: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Copié");
  };
  const Row = ({ label, value, k }: { label: string; value: string; k: string }) => (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0">
      <div>
        <div className="text-xs text-white/50">{label}</div>
        <div className="text-sm text-white font-mono">{value}</div>
      </div>
      <button
        onClick={() => copy(value, k)}
        className="text-white/50 hover:text-white p-1.5 rounded transition"
        aria-label={`Copier ${label}`}
      >
        {copied === k ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
  return (
    <Card className="p-5 mt-6" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-4 h-4" style={{ color: "#A78BFA" }} />
        <h3 className="text-white font-semibold text-sm">Payer par virement Interac</h3>
      </div>
      <p className="text-xs text-white/60 mb-3">
        Envoyez un virement Interac depuis votre banque avec les informations suivantes. Un accusé sera envoyé une fois le virement reçu.
      </p>
      <Row label="Adresse courriel" value="support@nivra-telecom.ca" k="email" />
      <Row label="Montant" value={fmt(amount)} k="amount" />
      <Row label="Réponse à la question de sécurité" value={reference} k="ref" />
    </Card>
  );
}

export default function PayerPublic() {
  const [reference, setReference] = useState("");
  const [identity, setIdentity] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<LookupInvoice | null>(null);
  const [paidOk, setPaidOk] = useState(false);
  const [paidRef, setPaidRef] = useState<{
    nvr: string | null;
    sqRef: string | null;
    receiptUrl: string | null;
    amount: number;
    when: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Custom amount state
  const [amountMode, setAmountMode] = useState<"full" | "custom">("full");
  const [customAmount, setCustomAmount] = useState<string>("");

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim() || !identity.trim()) {
      toast.error("Les deux champs sont requis.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/functions/v1/public-invoice-lookup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reference: reference.trim(), identity: identity.trim() }),
      });
      const data = await res.json();
      if (!data?.ok) {
        toast.error(data?.error || "Aucun dossier trouvé — vérifiez vos informations ou contactez support@nivra-telecom.ca");
        return;
      }
      setInvoice(data.invoice);
      setCustomAmount(String(data.invoice.balance_due.toFixed(2)));
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setInvoice(null);
    setPaidOk(false);
    setPaidRef(null);
    setReference("");
    setIdentity("");
    setAmountMode("full");
    setCustomAmount("");
  };

  // On payment success, fetch the NVR reference from billing_payments
  const handlePaid = async (receiptUrl?: string | null, sqPaymentId?: string) => {
    setPaidOk(true);
    const now = new Date().toISOString();
    let nvr: string | null = null;
    try {
      if (sqPaymentId) {
        // Retry a few times as backend may write async
        for (let i = 0; i < 5; i++) {
          const { data } = await supabase
            .from("billing_payments")
            .select("nivra_reference")
            .eq("square_payment_id", sqPaymentId)
            .maybeSingle();
          if (data?.nivra_reference) { nvr = data.nivra_reference; break; }
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    } catch { /* non-fatal */ }
    setPaidRef({
      nvr,
      sqRef: sqPaymentId || null,
      receiptUrl: receiptUrl || null,
      amount: effectiveAmount,
      when: now,
    });
  };

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Copié");
  };

  const parsedCustom = parseFloat(customAmount || "0");
  const validCustom = amountMode === "custom" && parsedCustom >= 1;
  const effectiveAmount = amountMode === "custom" && validCustom ? parsedCustom : invoice?.balance_due || 0;
  const amountOverrideCents =
    amountMode === "custom" && validCustom ? Math.round(parsedCustom * 100) : undefined;

  return (
    <>
      <SEOHead
        title="Payer une facture — Nivra Telecom"
        description="Payez votre facture Nivra en ligne par carte de crédit ou virement Interac — accès sans compte, sécurisé."
      />
      <Header />
      <main style={{ minHeight: "80vh", background: "#020209", paddingTop: 100, paddingBottom: 60 }}>
        <div className="mx-auto px-4" style={{ maxWidth: 640 }}>
          {!invoice && (
            <Card className="p-6 md:p-8" style={{ background: "#0b0b17", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ background: "rgba(124,58,237,0.15)" }}>
                  <CreditCard className="w-6 h-6" style={{ color: "#A78BFA" }} />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Payer une facture</h1>
                <p className="text-sm text-white/60">
                  Retrouvez votre facture et payez par carte de crédit — sans créer de compte.
                </p>
              </div>

              <form onSubmit={search} className="space-y-4">
                <div>
                  <Label htmlFor="reference" className="text-white/80 mb-1.5 block">
                    Numéro de facture ou de dossier
                  </Label>
                  <Input
                    id="reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="ex : INV-2026-000123"
                    autoComplete="off"
                    className="bg-white/5 border-white/10 text-white"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="identity" className="text-white/80 mb-1.5 block">
                    Courriel ou numéro de téléphone
                  </Label>
                  <Input
                    id="identity"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="ex : nom@courriel.ca"
                    autoComplete="off"
                    className="bg-white/5 border-white/10 text-white"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Recherche…</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" />Rechercher ma facture</>
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/5 flex items-start gap-2 text-xs text-white/50">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#A78BFA" }} />
                <span>
                  Les deux informations doivent correspondre au même dossier.
                  Limité à 3 tentatives par heure. Toutes les tentatives sont enregistrées.
                </span>
              </div>
            </Card>
          )}

          {invoice && (
            <Card className="p-6 md:p-8" style={{ background: "#0b0b17", borderColor: "rgba(255,255,255,0.08)" }}>
              <button
                onClick={reset}
                className="text-white/60 hover:text-white text-sm mb-4 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Nouvelle recherche
              </button>

              <div className="mb-6">
                <div className="text-white/60 text-sm">Bonjour {invoice.first_name},</div>
                <h1 className="text-xl md:text-2xl font-bold text-white mt-1">
                  Facture #{invoice.invoice_number}
                </h1>
              </div>

              <div className="rounded-lg p-4 mb-6" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)" }}>
                <div className="flex items-baseline justify-between">
                  <span className="text-white/70 text-sm">Montant dû</span>
                  <span className="text-2xl font-bold text-white">{fmt(invoice.balance_due)}</span>
                </div>
                {invoice.due_date && (
                  <div className="text-xs text-white/50 mt-1">
                    Échéance : {new Date(invoice.due_date).toLocaleDateString("fr-CA")}
                  </div>
                )}
                {invoice.total !== invoice.balance_due && (
                  <div className="text-xs text-white/50 mt-1">
                    Total facture : {fmt(invoice.total)}
                  </div>
                )}
              </div>

              {!paidOk && (
                <>
                  {/* Choix montant */}
                  <div className="mb-4 space-y-2">
                    <div className="text-sm text-white/70 font-medium mb-2">Choisissez le montant</div>
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${amountMode === "full" ? "border-purple-500 bg-purple-500/10" : "border-white/10 bg-white/5"}`}>
                      <input
                        type="radio"
                        name="amt"
                        checked={amountMode === "full"}
                        onChange={() => setAmountMode("full")}
                        className="accent-purple-500"
                      />
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">Payer {fmt(invoice.balance_due)}</div>
                        <div className="text-white/50 text-xs">Montant exact du solde dû</div>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${amountMode === "custom" ? "border-purple-500 bg-purple-500/10" : "border-white/10 bg-white/5"}`}>
                      <input
                        type="radio"
                        name="amt"
                        checked={amountMode === "custom"}
                        onChange={() => setAmountMode("custom")}
                        className="accent-purple-500 mt-1"
                      />
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium mb-2">Payer un autre montant</div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">$</span>
                          <Input
                            type="number"
                            min="1"
                            step="0.01"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            disabled={amountMode !== "custom"}
                            className="pl-7 bg-white/5 border-white/10 text-white"
                            placeholder="Minimum 1,00"
                          />
                        </div>
                        {amountMode === "custom" && parsedCustom > invoice.balance_due && (
                          <div className="text-xs text-amber-300 mt-1.5">
                            Surpaiement de {fmt(parsedCustom - invoice.balance_due)} — sera crédité à votre dossier.
                          </div>
                        )}
                        {amountMode === "custom" && parsedCustom > 0 && parsedCustom < invoice.balance_due && (
                          <div className="text-xs text-white/50 mt-1.5">
                            Paiement partiel — solde restant après : {fmt(invoice.balance_due - parsedCustom)}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  <div className="mb-3 text-sm text-white/70 font-medium">Paiement par carte de crédit</div>
                  <SquarePaymentForm
                    key={amountOverrideCents ?? "full"}
                    invoiceId={invoice.id}
                    amount={effectiveAmount}
                    amountOverrideCents={amountOverrideCents}
                    invoiceNumber={invoice.invoice_number}
                    customerName={invoice.first_name}
                    customerEmail={invoice.email || undefined}
                    paymentSource="public_pay"
                    onSuccess={handlePaid}
                  />
                  <p className="mt-4 text-xs text-white/40 text-center">
                    Paiement sécurisé traité par Square. Nous ne conservons aucune information de carte.
                  </p>

                  <InteracBlock amount={effectiveAmount} reference={invoice.invoice_number} />
                </>
              )}

              {paidOk && (
                <div className="space-y-5">
                  {/* Real-time checkpoints */}
                  <div className="space-y-2">
                    {[
                      "Paiement confirmé par Square",
                      "Facture mise à jour dans votre dossier",
                      "Email de confirmation envoyé",
                    ].map((label, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
                        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <span className="text-sm text-white">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* NVR reference block */}
                  <div
                    className="rounded-xl p-5 text-center"
                    style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.35)" }}
                  >
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
                      Votre numéro de référence Nivra
                    </div>
                    <div className="text-3xl md:text-4xl font-bold font-mono text-white tracking-wider break-all">
                      {paidRef?.nvr || (
                        <span className="inline-flex items-center gap-2 text-white/70">
                          <Loader2 className="w-5 h-5 animate-spin" /> Génération…
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/50 mt-3">
                      Conservez cette référence — utile en cas de question sur votre paiement.
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2 mt-4">
                      {paidRef?.nvr && (
                        <Button
                          onClick={() => copy(paidRef.nvr!, "nvr")}
                          variant="outline"
                          className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                        >
                          {copied === "nvr"
                            ? <Check className="w-4 h-4 mr-2" />
                            : <Copy className="w-4 h-4 mr-2" />}
                          Copier la référence
                        </Button>
                      )}
                      {paidRef?.receiptUrl && (
                        <Button asChild variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10">
                          <a href={paidRef.receiptUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Voir mon reçu
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="rounded-lg p-4 space-y-1.5 text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex justify-between">
                      <span className="text-white/60">Montant payé</span>
                      <span className="text-white font-semibold">{fmt(paidRef?.amount || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Facture</span>
                      <span className="text-white font-mono text-xs">{invoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Date</span>
                      <span className="text-white text-xs">
                        {paidRef ? new Date(paidRef.when).toLocaleString("fr-CA") : ""}
                      </span>
                    </div>
                    {paidRef?.sqRef && (
                      <div className="flex justify-between">
                        <span className="text-white/40 text-xs">Réf. Square</span>
                        <span className="text-white/50 font-mono text-[10px]">{paidRef.sqRef}</span>
                      </div>
                    )}
                  </div>

                  <Button onClick={reset} variant="ghost" className="w-full text-white/70 hover:bg-white/5">
                    Payer une autre facture
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
