import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, ShieldCheck, CreditCard, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
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

export default function PayerPublic() {
  const [reference, setReference] = useState("");
  const [identity, setIdentity] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<LookupInvoice | null>(null);
  const [paidOk, setPaidOk] = useState(false);

  const fmt = (n: number) =>
    n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

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
        toast.error(data?.error || "Aucun dossier trouvé.");
        return;
      }
      setInvoice(data.invoice);
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setInvoice(null);
    setPaidOk(false);
    setReference("");
    setIdentity("");
  };

  return (
    <>
      <SEOHead
        title="Payer une facture — Nivra Telecom"
        description="Payez votre facture Nivra en ligne par carte de crédit — accès sans compte, sécurisé."
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
                  <div className="mb-3 text-sm text-white/70 font-medium">Paiement par carte de crédit</div>
                  <SquarePaymentForm
                    invoiceId={invoice.id}
                    amount={invoice.balance_due}
                    invoiceNumber={invoice.invoice_number}
                    customerName={invoice.first_name}
                    customerEmail={invoice.email || undefined}
                    onSuccess={() => setPaidOk(true)}
                  />
                  <p className="mt-4 text-xs text-white/40 text-center">
                    Paiement sécurisé traité par Square. Nous ne conservons aucune information de carte.
                  </p>
                </>
              )}
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
