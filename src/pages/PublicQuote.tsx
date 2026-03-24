/**
 * Public Quote Page — Accessible via token link without login.
 * Clients can view, accept, and be redirected to the quote checkout form.
 * If requires_identity_capture is true, the client must fill identity fields before accepting.
 */
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { acceptQuoteByClient } from "@/shared-ops/quoteOperations";
import { generateQuotePDF, type QuotePDFData } from "@/lib/pdf/quoteTemplate";
import { NIVRA } from "@/lib/pdf/companyInfo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Download, FileText, Clock, XCircle, ShieldCheck, ArrowRight, Loader2, User, Phone, Mail, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { validateCanadianPhone, formatCanadianPhone } from "@/components/checkout/CheckoutPhoneField";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any; canAccept: boolean }> = {
  sent: { label: "En attente de réponse", color: "text-blue-600", icon: Clock, canAccept: true },
  viewed: { label: "Consultée", color: "text-blue-600", icon: FileText, canAccept: true },
  approved: { label: "Approuvée", color: "text-emerald-600", icon: CheckCircle, canAccept: true },
  accepted_pending_checkout: { label: "Acceptée — Finalisation requise", color: "text-amber-600", icon: Clock, canAccept: false },
  checkout_in_progress: { label: "Finalisation en cours", color: "text-blue-600", icon: Clock, canAccept: false },
  checkout_completed: { label: "Informations reçues", color: "text-emerald-600", icon: CheckCircle, canAccept: false },
  rejected: { label: "Refusée", color: "text-red-600", icon: XCircle, canAccept: false },
  expired: { label: "Expirée", color: "text-muted-foreground", icon: Clock, canAccept: false },
  converted: { label: "Commande confirmée", color: "text-emerald-600", icon: CheckCircle, canAccept: false },
  draft: { label: "Brouillon", color: "text-muted-foreground", icon: FileText, canAccept: false },
  pending_review: { label: "En révision", color: "text-muted-foreground", icon: Clock, canAccept: false },
  accepted: { label: "Acceptée", color: "text-emerald-600", icon: CheckCircle, canAccept: false },
};

interface IdentityForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  serviceAddress: string;
}

export default function PublicQuote() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [quote, setQuote] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Identity capture for anonymous quotes
  const [identityForm, setIdentityForm] = useState<IdentityForm>({
    firstName: "", lastName: "", phone: "", email: "", serviceAddress: "",
  });
  const [identityErrors, setIdentityErrors] = useState<Record<string, string>>({});
  const [identitySaved, setIdentitySaved] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Lien invalide");
      setLoading(false);
      return;
    }
    loadQuote();
  }, [token]);

  const loadQuote = async () => {
    try {
      const { data: q, error: qErr } = await supabase
        .from("quotes" as any)
        .select("*")
        .eq("public_token", token!)
        .maybeSingle();

      if (qErr || !q) {
        setError("Soumission introuvable ou lien invalide.");
        setLoading(false);
        return;
      }

      // Mark as viewed if currently 'sent'
      if (q.status === "sent") {
        await supabase.from("quotes" as any).update({ status: "viewed" }).eq("id", q.id);
        await supabase.from("quote_events" as any).insert({
          quote_id: q.id,
          event_type: "viewed",
          actor_role: "client",
          message: "Le client a consulté la soumission",
        });
        q.status = "viewed";
      }

      // Pre-fill identity form with any existing prospect data
      if (q.prospect_name) {
        const parts = (q.prospect_name || "").split(" ");
        setIdentityForm(prev => ({
          ...prev,
          firstName: parts[0] || "",
          lastName: parts.slice(1).join(" ") || "",
          email: q.prospect_email || "",
          phone: q.prospect_phone || "",
        }));
      }

      setQuote(q);

      const { data: l } = await supabase
        .from("quote_lines" as any)
        .select("*")
        .eq("quote_id", q.id)
        .order("created_at", { ascending: true });
      setLines(l || []);

      const { data: a } = await supabase
        .from("quote_adjustments" as any)
        .select("*")
        .eq("quote_id", q.id)
        .eq("approval_status", "approved")
        .order("created_at", { ascending: true });
      setAdjustments(a || []);
    } catch {
      setError("Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };

  const needsIdentityCapture = quote?.requires_identity_capture && !identitySaved;

  const validateIdentity = (): boolean => {
    const errs: Record<string, string> = {};
    if (!identityForm.firstName.trim()) errs.firstName = "Requis";
    if (!identityForm.lastName.trim()) errs.lastName = "Requis";
    if (!identityForm.email.trim() || !/\S+@\S+\.\S+/.test(identityForm.email)) errs.email = "Courriel invalide";
    if (!validateCanadianPhone(identityForm.phone)) errs.phone = "Téléphone invalide (10 chiffres)";
    if (!identityForm.serviceAddress.trim()) errs.serviceAddress = "Requis";
    setIdentityErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveIdentity = async () => {
    if (!validateIdentity() || !quote) return;
    try {
      const fullName = `${identityForm.firstName} ${identityForm.lastName}`.trim();
      await supabase.from("quotes" as any).update({
        prospect_name: fullName,
        prospect_email: identityForm.email,
        prospect_phone: formatCanadianPhone(identityForm.phone),
        checkout_data: {
          ...(quote.checkout_data || {}),
          identity_captured: true,
          first_name: identityForm.firstName,
          last_name: identityForm.lastName,
          email: identityForm.email,
          phone: formatCanadianPhone(identityForm.phone),
          service_address: identityForm.serviceAddress,
          captured_at: new Date().toISOString(),
        },
      }).eq("id", quote.id);

      await supabase.from("quote_events" as any).insert({
        quote_id: quote.id,
        event_type: "identity_captured",
        actor_role: "client",
        message: `Identité capturée: ${fullName} (${identityForm.email})`,
        metadata: { name: fullName, email: identityForm.email, phone: formatCanadianPhone(identityForm.phone) },
      });

      setIdentitySaved(true);
      setQuote({ ...quote, prospect_name: fullName, prospect_email: identityForm.email, prospect_phone: formatCanadianPhone(identityForm.phone) });
      toast.success("Vos informations ont été enregistrées.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la sauvegarde");
    }
  };

  const handleAccept = async () => {
    if (!quote || !token) return;
    setAccepting(true);
    try {
      const { checkoutToken } = await acceptQuoteByClient(quote.id, token);
      setQuote({ ...quote, status: "accepted_pending_checkout", checkout_token: checkoutToken });
      toast.success("Soumission acceptée !");
      navigate(`/quote-checkout?token=${encodeURIComponent(checkoutToken)}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'acceptation");
    } finally {
      setAccepting(false);
    }
  };

  const handleGoToCheckout = () => {
    if (quote?.checkout_token) {
      navigate(`/quote-checkout?token=${encodeURIComponent(quote.checkout_token)}`);
    }
  };

  const handleDownloadPDF = () => {
    if (!quote) return;
    const showAnonymous = quote.requires_identity_capture && !identitySaved;
    const pdfData: QuotePDFData = {
      quoteNumber: quote.quote_number || "—",
      clientName: showAnonymous ? "En attente d'identification" : (quote.prospect_name || quote.is_prospect ? (quote.prospect_name || "En attente d'identification") : "Client"),
      clientEmail: showAnonymous ? undefined : (quote.is_prospect ? quote.prospect_email : undefined),
      clientPhone: showAnonymous ? undefined : undefined,
      isProspect: quote.is_prospect || false,
      validUntil: quote.valid_until,
      clientNote: quote.client_note,
      lines: lines.map((l: any) => ({
        label: l.label,
        quantity: l.quantity,
        unitPrice: l.unit_price,
        billingFrequency: l.billing_frequency,
        lineType: l.line_type,
      })),
      adjustments: adjustments.map((a: any) => ({
        label: a.label,
        amount: a.amount,
        adjustmentType: a.adjustment_type,
      })),
      subtotal: Number(quote.subtotal || 0),
      discountsTotal: Number(quote.discounts_total || 0),
      creditsTotal: Number(quote.credits_total || 0),
      taxesTotal: Number(quote.taxes_total || 0),
      totalDueNow: Number(quote.total_due_now || 0),
      totalMonthly: Number(quote.total_monthly || 0),
      createdAt: quote.created_at,
      status: quote.status,
    };
    const blob = generateQuotePDF(pdfData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Soumission-${quote.quote_number}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Soumission introuvable</h2>
            <p className="text-sm text-muted-foreground">{error || "Ce lien est invalide ou a expiré."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const st = STATUS_MAP[quote.status] || STATUS_MAP.draft;
  const StatusIcon = st.icon;
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date() && !["accepted_pending_checkout", "checkout_in_progress", "checkout_completed", "converted"].includes(quote.status);
  const canAccept = st.canAccept && !isExpired && !needsIdentityCapture;
  const needsCheckout = ["accepted_pending_checkout", "checkout_in_progress"].includes(quote.status);

  const monthlyLines = lines.filter((l: any) => l.billing_frequency === "monthly");
  const oneTimeLines = lines.filter((l: any) => l.billing_frequency === "one_time");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">N</span>
            </div>
            <div>
              <p className="font-bold text-sm">{NIVRA.tradeName}</p>
              <p className="text-[10px] text-muted-foreground">Soumission {quote.quote_number}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Status Banner */}
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          canAccept ? "border-primary/20 bg-primary/5" :
          needsCheckout ? "border-amber-500/20 bg-amber-500/5" :
          ["checkout_completed", "converted"].includes(quote.status) ? "border-emerald-500/20 bg-emerald-500/5" :
          "border-border bg-muted/30"
        }`}>
          <StatusIcon className={`h-6 w-6 ${st.color}`} />
          <div className="flex-1">
            <p className={`font-semibold ${st.color}`}>
              {isExpired ? "Soumission expirée" : st.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {needsCheckout && "Complétez vos informations pour démarrer votre commande."}
              {quote.valid_until && !isExpired && st.canAccept && `Valide jusqu'au ${format(new Date(quote.valid_until), "d MMMM yyyy", { locale: fr })}`}
              {isExpired && "Cette soumission n'est plus valide."}
            </p>
          </div>
          <ShieldCheck className="h-5 w-5 text-muted-foreground/30" />
        </div>

        {/* ═══ IDENTITY CAPTURE GATE ═══ */}
        {needsIdentityCapture && st.canAccept && !isExpired && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-amber-600">Identification requise</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Avant d'accepter cette soumission, veuillez remplir vos informations. Ces données serviront à créer votre dossier client.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Prénom <span className="text-destructive">*</span></Label>
                  <Input
                    value={identityForm.firstName}
                    onChange={e => { setIdentityForm(p => ({ ...p, firstName: e.target.value })); setIdentityErrors(p => ({ ...p, firstName: "" })); }}
                    placeholder="Prénom"
                    className={identityErrors.firstName ? "border-destructive" : ""}
                  />
                  {identityErrors.firstName && <p className="text-[10px] text-destructive">{identityErrors.firstName}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Nom <span className="text-destructive">*</span></Label>
                  <Input
                    value={identityForm.lastName}
                    onChange={e => { setIdentityForm(p => ({ ...p, lastName: e.target.value })); setIdentityErrors(p => ({ ...p, lastName: "" })); }}
                    placeholder="Nom"
                    className={identityErrors.lastName ? "border-destructive" : ""}
                  />
                  {identityErrors.lastName && <p className="text-[10px] text-destructive">{identityErrors.lastName}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> Courriel <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={identityForm.email}
                    onChange={e => { setIdentityForm(p => ({ ...p, email: e.target.value })); setIdentityErrors(p => ({ ...p, email: "" })); }}
                    placeholder="email@exemple.com"
                    className={identityErrors.email ? "border-destructive" : ""}
                  />
                  {identityErrors.email && <p className="text-[10px] text-destructive">{identityErrors.email}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium flex items-center gap-1"><Phone className="h-3 w-3" /> Téléphone <span className="text-destructive">*</span></Label>
                  <Input
                    value={identityForm.phone}
                    onChange={e => { setIdentityForm(p => ({ ...p, phone: e.target.value })); setIdentityErrors(p => ({ ...p, phone: "" })); }}
                    placeholder="514-000-0000"
                    className={identityErrors.phone ? "border-destructive" : ""}
                  />
                  {identityErrors.phone && <p className="text-[10px] text-destructive">{identityErrors.phone}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> Adresse de service <span className="text-destructive">*</span></Label>
                <Input
                  value={identityForm.serviceAddress}
                  onChange={e => { setIdentityForm(p => ({ ...p, serviceAddress: e.target.value })); setIdentityErrors(p => ({ ...p, serviceAddress: "" })); }}
                  placeholder="123 rue Exemple, Montréal, QC"
                  className={identityErrors.serviceAddress ? "border-destructive" : ""}
                />
                {identityErrors.serviceAddress && <p className="text-[10px] text-destructive">{identityErrors.serviceAddress}</p>}
              </div>
              <Button onClick={handleSaveIdentity} className="w-full gap-2">
                <CheckCircle className="h-4 w-4" />
                Confirmer mes informations
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Services */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Services inclus</h3>
            {monthlyLines.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Mensuel récurrent</p>
                {monthlyLines.map((l: any) => (
                  <div key={l.id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                    <div>
                      <span className="font-medium">{l.label}</span>
                      {l.quantity > 1 && <span className="text-muted-foreground ml-1">× {l.quantity}</span>}
                    </div>
                    <span className="font-medium">{(l.unit_price * l.quantity).toFixed(2)} $ /mois</span>
                  </div>
                ))}
              </div>
            )}
            {oneTimeLines.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Frais uniques</p>
                {oneTimeLines.map((l: any) => (
                  <div key={l.id} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                    <div>
                      <span className="font-medium">{l.label}</span>
                      {l.quantity > 1 && <span className="text-muted-foreground ml-1">× {l.quantity}</span>}
                    </div>
                    <span className="font-medium">{(l.unit_price * l.quantity).toFixed(2)} $</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Adjustments */}
        {adjustments.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Ajustements</h3>
              {adjustments.map((a: any) => (
                <div key={a.id} className="flex justify-between py-2 text-sm text-destructive">
                  <span>{a.label}</span>
                  <span className="font-medium">-{Number(a.amount).toFixed(2)} $</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Totals */}
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{Number(quote.subtotal).toFixed(2)} $</span>
            </div>
            {Number(quote.discounts_total) > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Rabais</span>
                <span>-{Number(quote.discounts_total).toFixed(2)} $</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxes (TPS + TVQ)</span>
              <span>{Number(quote.taxes_total).toFixed(2)} $</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-3 border-t border-border">
              <span>Total dû maintenant</span>
              <span>{Number(quote.total_due_now).toFixed(2)} $</span>
            </div>
            <div className="flex justify-between text-sm text-primary font-semibold">
              <span>Mensuel récurrent</span>
              <span>{Number(quote.total_monthly).toFixed(2)} $ /mois</span>
            </div>
          </CardContent>
        </Card>

        {/* Client Note */}
        {quote.client_note && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">Message</h3>
              <p className="text-sm text-muted-foreground">{quote.client_note}</p>
            </CardContent>
          </Card>
        )}

        {/* Accept CTA — only if not yet accepted AND identity captured (if required) */}
        {canAccept && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6 text-center">
              <h3 className="text-lg font-bold mb-2">Prêt à commander ?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Acceptez cette soumission pour compléter vos informations et finaliser votre commande.
              </p>
              <Button size="lg" onClick={handleAccept} disabled={accepting} className="gap-2">
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {accepting ? "Traitement..." : "Accepter et continuer"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Identity saved confirmation — show accept button */}
        {identitySaved && st.canAccept && !isExpired && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-medium text-emerald-600">Informations enregistrées</p>
              <Button size="lg" onClick={handleAccept} disabled={accepting} className="gap-2">
                {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {accepting ? "Traitement..." : "Accepter et continuer"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Needs checkout — show continue button */}
        {needsCheckout && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-6 text-center">
              <Clock className="h-10 w-10 text-amber-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-amber-600 mb-1">Finalisation requise</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Vous avez accepté cette soumission. Complétez vos informations pour démarrer votre commande.
              </p>
              <Button size="lg" onClick={handleGoToCheckout} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Compléter ma commande
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Checkout completed */}
        {quote.status === "checkout_completed" && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-emerald-600 mb-1">Informations reçues</h3>
              <p className="text-sm text-muted-foreground">
                Votre commande est en cours de traitement. Notre équipe vous contactera prochainement.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Fully converted */}
        {quote.status === "converted" && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-emerald-600 mb-1">Commande confirmée</h3>
              <p className="text-sm text-muted-foreground">
                Votre commande a été créée. Vous recevrez une confirmation sous peu.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border space-y-1">
          <p>{NIVRA.legalName}</p>
          <p>{NIVRA.address}</p>
          <p>{NIVRA.email} · {NIVRA.website}</p>
          <p className="text-[10px]">{NIVRA.tpsLabel} | {NIVRA.tvqLabel}</p>
        </div>
      </div>
    </div>
  );
}