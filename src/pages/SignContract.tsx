/**
 * SignContract — Public click-to-sign page (/signer/:token)
 *
 * - No login required
 * - Bilingual (FR/EN based on browser language, FR fallback)
 * - Mobile-first design
 * - Calls public edge function `sign-contract-public` for fetch + sign
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2, FileText } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const FN_URL = `${SUPABASE_URL}/functions/v1/sign-contract-public`;

type Lang = "fr" | "en";

const t = {
  fr: {
    loading: "Chargement de votre contrat…",
    title: "Signer votre contrat Nivra Telecom",
    subtitle: "Confirmez votre acceptation pour finaliser votre commande.",
    summary: "Récapitulatif de votre contrat",
    contractNumber: "Numéro de contrat",
    orderNumber: "Numéro de commande",
    accountNumber: "Numéro de compte",
    client: "Client",
    email: "Courriel",
    serviceType: "Service",
    serviceAddress: "Adresse de service",
    monthlyPrice: "Prix mensuel récurrent (taxes incluses)",
    monthlySubtotal: "Prix mensuel avant taxes",
    firstInvoiceTotal: "Total 1ʳᵉ facture (équipement, frais, activation)",
    invoiceTotal: "Total facturé",
    itemsTitle: "Détail de la commande",
    itemQty: "Qté",
    itemUnit: "Prix unitaire",
    itemTotal: "Total",
    recurringBadge: "Récurrent /mois",
    oneTimeBadge: "Unique",
    keyTerms: "Conditions clés",
    term1: "Sans engagement, résiliable à tout moment",
    term2: "Garantie 30 jours satisfait ou remboursé",
    term3: "Aucun frais caché — facturation transparente",
    term4: "Support local au Québec, en français",
    viewPdf: "Voir le contrat complet (PDF)",
    openingPdf: "Ouverture du PDF…",
    pdfUnavailable: "PDF pas encore disponible",
    fullText: "Texte complet du contrat",
    fullTextBody:
      "En cliquant sur \"Signer le contrat\", vous reconnaissez avoir lu et accepté les Conditions de service de Nivra Telecom, la Politique de confidentialité (Loi 25), la Politique de remboursement et les Modalités de paiement disponibles sur nivra-telecom.ca. Cette signature électronique a la même valeur légale qu'une signature manuscrite (Loi sur l'encadrement technologique, Québec).",
    consent:
      "J'ai lu et j'accepte les conditions du contrat Nivra Telecom et confirme que les informations ci-dessus sont exactes.",
    nameLabel: "Votre nom complet (tel qu'il apparaîtra sur la signature)",
    namePlaceholder: "Prénom Nom",
    sign: "Signer le contrat",
    signing: "Signature en cours…",
    successTitle: "Contrat signé — Merci !",
    successBody:
      "Votre contrat a bien été enregistré. Votre équipement sera expédié sous peu. Vous recevrez un courriel de confirmation et de suivi.",
    alreadySignedTitle: "Contrat déjà signé",
    alreadySignedBody: "Ce contrat a déjà été signé. Aucune action supplémentaire requise.",
    expiredTitle: "Lien expiré",
    expiredBody: "Le lien de signature de ce contrat a expiré. Contactez le support pour obtenir un nouveau lien.",
    notFoundTitle: "Lien invalide",
    notFoundBody: "Ce lien de signature est invalide ou a déjà été utilisé.",
    errorTitle: "Erreur",
    errorBody: "Une erreur est survenue. Veuillez réessayer ou contacter le support.",
    legalNotice:
      "Cette signature est juridiquement contraignante (Loi 25 du Québec). Votre adresse IP, votre navigateur et l'horodatage sont enregistrés à titre de preuve.",
    poweredBy: "Nivra Telecom · Télécommunications prépayées au Québec",
  },
  en: {
    loading: "Loading your contract…",
    title: "Sign your Nivra Telecom contract",
    subtitle: "Confirm your acceptance to finalize your order.",
    summary: "Contract summary",
    contractNumber: "Contract number",
    orderNumber: "Order number",
    accountNumber: "Account number",
    client: "Client",
    email: "Email",
    serviceType: "Service",
    serviceAddress: "Service address",
    monthlyPrice: "Recurring monthly price (taxes included)",
    monthlySubtotal: "Monthly price before taxes",
    firstInvoiceTotal: "1st invoice total (equipment, fees, activation)",
    invoiceTotal: "Invoice total",
    itemsTitle: "Order details",
    itemQty: "Qty",
    itemUnit: "Unit price",
    itemTotal: "Total",
    recurringBadge: "Recurring /mo",
    oneTimeBadge: "One-time",
    keyTerms: "Key terms",
    term1: "No commitment, cancel anytime",
    term2: "30-day satisfaction guarantee",
    term3: "No hidden fees — transparent billing",
    term4: "Local Quebec support, in French",
    viewPdf: "View full contract (PDF)",
    openingPdf: "Opening PDF…",
    pdfUnavailable: "PDF not yet available",
    fullText: "Full contract text",
    fullTextBody:
      "By clicking \"Sign contract\", you acknowledge that you have read and accepted the Nivra Telecom Terms of Service, Privacy Policy (Law 25), Refund Policy, and Payment Terms available on nivra-telecom.ca. This electronic signature has the same legal value as a handwritten signature (Quebec Act to establish a legal framework for IT).",
    consent:
      "I have read and accept the Nivra Telecom contract terms, and confirm the information above is accurate.",
    nameLabel: "Your full name (as it will appear on the signature)",
    namePlaceholder: "First Last",
    sign: "Sign contract",
    signing: "Signing…",
    successTitle: "Contract signed — Thank you!",
    successBody:
      "Your contract has been recorded. Your equipment will be shipped shortly. You will receive a confirmation and tracking email.",
    alreadySignedTitle: "Contract already signed",
    alreadySignedBody: "This contract has already been signed. No further action required.",
    expiredTitle: "Link expired",
    expiredBody: "This contract signature link has expired. Please contact support for a new link.",
    notFoundTitle: "Invalid link",
    notFoundBody: "This signature link is invalid or has already been used.",
    errorTitle: "Error",
    errorBody: "An error occurred. Please try again or contact support.",
    legalNotice:
      "This signature is legally binding (Quebec Law 25). Your IP address, browser, and timestamp are recorded as proof.",
    poweredBy: "Nivra Telecom · Prepaid telecom in Quebec",
  },
} as const;

function detectLang(): Lang {
  if (typeof navigator === "undefined") return "fr";
  const lang = (navigator.language || "fr").toLowerCase();
  return lang.startsWith("en") ? "en" : "fr";
}

function fmtMoney(amount?: number | null, lang: Lang = "fr"): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(amount));
}

interface ContractData {
  success: boolean;
  already_signed?: boolean;
  signed_at?: string;
  contract_number?: string;
  error?: string;
  contract?: {
    id: string;
    contract_number?: string;
    contract_name?: string;
    version?: number;
    created_at?: string;
    expires_at?: string;
  };
  order?: {
    id: string;
    order_number?: string;
    service_type?: string;
    total_amount?: number;
    created_at?: string;
    service_address?: string;
    service_city?: string;
    service_postal_code?: string;
    service_province?: string;
  };
  client?: { full_name?: string; email?: string; phone?: string };
  account_number?: string;
  invoice?: {
    invoice_number?: string;
    total?: number;
    subtotal?: number;
  };
}

export default function SignContract() {
  const { token } = useParams<{ token: string }>();
  const [lang, setLang] = useState<Lang>("fr");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ContractData | null>(null);
  const [errorKind, setErrorKind] = useState<string | null>(null);

  const [consent, setConsent] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signing, setSigning] = useState(false);
  const [signedOk, setSignedOk] = useState(false);

  const tr = t[lang];

  useEffect(() => {
    setLang(detectLang());
  }, []);

  useEffect(() => {
    if (!token) {
      setErrorKind("TOKEN_NOT_FOUND");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
          method: "GET",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        });
        const json = (await res.json()) as ContractData;
        setData(json);
        if (!json.success) setErrorKind(json.error || "UNKNOWN");
        else if (json.client?.full_name) setSignerName(json.client.full_name);
      } catch (e) {
        console.error("[SignContract] fetch failed:", e);
        setErrorKind("NETWORK");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSign = async () => {
    if (!token || !consent || !signerName.trim() || signing) return;
    setSigning(true);
    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, consent: true, name: signerName.trim() }),
      });
      const json = await res.json();
      if (json?.success) {
        setSignedOk(true);
      } else {
        setErrorKind(json?.error || "UNKNOWN");
      }
    } catch (e) {
      console.error("[SignContract] sign failed:", e);
      setErrorKind("NETWORK");
    } finally {
      setSigning(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <ShellPage>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">{tr.loading}</span>
        </div>
      </ShellPage>
    );
  }

  // ── Success state ──
  if (signedOk || data?.already_signed) {
    const isAlready = data?.already_signed && !signedOk;
    return (
      <ShellPage lang={lang} setLang={setLang}>
        <div className="px-4 py-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            {isAlready ? tr.alreadySignedTitle : tr.successTitle}
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {isAlready ? tr.alreadySignedBody : tr.successBody}
          </p>
          {data?.contract_number && (
            <p className="mt-4 text-xs text-muted-foreground">
              {tr.contractNumber}: <span className="font-mono">{data.contract_number}</span>
            </p>
          )}
        </div>
      </ShellPage>
    );
  }

  // ── Error states ──
  if (errorKind) {
    let title: string = tr.errorTitle;
    let body: string = tr.errorBody;
    if (errorKind === "TOKEN_EXPIRED") {
      title = tr.expiredTitle;
      body = tr.expiredBody;
    } else if (errorKind === "TOKEN_NOT_FOUND" || errorKind === "TOKEN_INVALID") {
      title = tr.notFoundTitle;
      body = tr.notFoundBody;
    }
    return (
      <ShellPage lang={lang} setLang={setLang}>
        <div className="px-4 py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-foreground">{title}</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{body}</p>
        </div>
      </ShellPage>
    );
  }

  // ── Active signing form ──
  const c = data?.contract;
  const o = data?.order;
  const cl = data?.client;
  const inv = data?.invoice;
  const fullAddr = [o?.service_address, o?.service_city, o?.service_province, o?.service_postal_code]
    .filter(Boolean)
    .join(", ");

  return (
    <ShellPage lang={lang} setLang={setLang}>
      {/* Header */}
      <div className="px-5 pt-6 sm:px-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-foreground sm:text-xl">{tr.title}</h1>
            <p className="text-xs text-muted-foreground">{tr.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 px-5 sm:px-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{tr.summary}</h2>
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-sm sm:grid-cols-2">
          {c?.contract_number && <Field label={tr.contractNumber} value={c.contract_number} mono />}
          {o?.order_number && <Field label={tr.orderNumber} value={o.order_number} mono />}
          {data?.account_number && <Field label={tr.accountNumber} value={data.account_number} mono />}
          {cl?.full_name && <Field label={tr.client} value={cl.full_name} />}
          {cl?.email && <Field label={tr.email} value={cl.email} />}
          {o?.service_type && <Field label={tr.serviceType} value={o.service_type} />}
          {fullAddr && <Field label={tr.serviceAddress} value={fullAddr} full />}
          {o?.total_amount != null && (
            <Field label={tr.monthlyPrice} value={fmtMoney(o.total_amount, lang)} highlight />
          )}
          {inv?.total != null && (
            <Field label={tr.invoiceTotal} value={fmtMoney(inv.total, lang)} highlight />
          )}
        </div>
      </div>

      {/* Key terms */}
      <div className="mt-5 px-5 sm:px-8">
        <h2 className="mb-2 text-sm font-semibold text-foreground">{tr.keyTerms}</h2>
        <ul className="space-y-1.5 text-sm text-foreground/80">
          {[tr.term1, tr.term2, tr.term3, tr.term4].map((term) => (
            <li key={term} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{term}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Full text scrollable */}
      <div className="mt-5 px-5 sm:px-8">
        <h2 className="mb-2 text-sm font-semibold text-foreground">{tr.fullText}</h2>
        <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          {tr.fullTextBody}
        </div>
      </div>

      {/* Signature form */}
      <div className="mt-5 px-5 pb-2 sm:px-8">
        <label htmlFor="signer-name" className="mb-1 block text-xs font-medium text-foreground/80">
          {tr.nameLabel}
        </label>
        <input
          id="signer-name"
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder={tr.namePlaceholder}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="mt-3 px-5 sm:px-8">
        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground/90">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-ring"
          />
          <span>{tr.consent}</span>
        </label>
      </div>

      {/* Sign button */}
      <div className="mt-5 px-5 sm:px-8">
        <button
          type="button"
          onClick={handleSign}
          disabled={!consent || !signerName.trim() || signing}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {signing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {tr.signing}
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              {tr.sign}
            </>
          )}
        </button>
      </div>

      {/* Legal notice */}
      <div className="mt-4 px-5 pb-6 sm:px-8">
        <p className="text-[11px] leading-relaxed text-muted-foreground">{tr.legalNotice}</p>
      </div>
    </ShellPage>
  );
}

/* ── Sub-components ── */
function ShellPage({
  children,
  lang,
  setLang,
}: {
  children: React.ReactNode;
  lang?: Lang;
  setLang?: (l: Lang) => void;
}) {
  const tr = useMemo(() => t[lang || "fr"], [lang]);
  return (
    <div style={{ background: '#020209' }} className="relative min-h-screen px-3 py-6 sm:px-0 overflow-hidden">
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-5%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.1) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl shadow-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)' }}>
        {setLang && (
          <div className="flex justify-end gap-2 px-5 pt-4 sm:px-8">
            <button
              type="button"
              onClick={() => setLang("fr")}
              className={`rounded px-2 py-1 text-xs ${lang === "fr" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`rounded px-2 py-1 text-xs ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              EN
            </button>
          </div>
        )}
        {children}
        <div className="border-t px-5 py-3 sm:px-8" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-center text-[10px] text-muted-foreground">{tr.poweredBy}</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  highlight,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 ${mono ? "font-mono" : "font-medium"} ${highlight ? "font-bold text-primary" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
