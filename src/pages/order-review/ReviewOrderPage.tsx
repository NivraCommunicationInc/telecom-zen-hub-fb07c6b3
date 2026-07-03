/**
 * PayerCommande — Public "Revoir votre commande" page for field-sale clients.
 * URL: /payer/:intentId
 *
 * NOT just a payment page. This is a full order review experience:
 *   1. Full order details (services, equipment, promos, taxes, install date, addresses)
 *   2. "Modifier mes informations" (contact + addresses only, prices locked)
 *   3. Confirmation & electronic signature + 3 legal checkboxes
 *   4. Square payment (only unlocked after signature)
 *   5. On success → redirect to /commande/confirmee/:intentId
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  CreditCard,
  Lock,
  Pencil,
  X,
  CalendarClock,
  MapPin,
  User as UserIcon,
  Package,
  Receipt as ReceiptIcon,
  Wrench,
  Sparkles,
  FileSignature,
} from "lucide-react";
import { PhotoBg } from "@/components/PhotoBg";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TypedSignatureInput } from "@/components/client/TypedSignatureInput";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";
const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("fr-CA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
};

interface IntentData {
  intent: {
    id: string;
    quote_id?: string | null;
    amount: number;
    currency: string;
    status: string;
    customer_email: string | null;
    customer_name: string | null;
    paid_at: string | null;
    expires_at: string | null;
    created_at: string;
    description?: string | null;
    line_items?: any[] | null;
    signature?: any;
    consent_flags?: any;
  };
  quote: null | {
    id: string;
    client_info: any;
    services: any[];
    equipment: any[];
    discount: any;
    activation_fee: number;
    subtotal: number;
    tps: number;
    tvq: number;
    total: number;
    valid_until: string | null;
    install_date: string | null;
    install_mode: string | null;
  };
  agent_name: string;
}

export default function ReviewOrderPage() {
  const { intentId } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<IntentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);

  // Signature state
  const [consentAccuracy, setConsentAccuracy] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentActivation, setConsentActivation] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [signatureSaved, setSignatureSaved] = useState<any>(null);
  const [savingSig, setSavingSig] = useState(false);

  // Square
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [sqLoading, setSqLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const refresh = async () => {
    if (!intentId) return;
    const { data: rpc } = await supabase.rpc(
      "get_field_payment_intent_public" as never,
      { p_id: intentId },
    );
    if (rpc) setData(rpc as IntentData);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!intentId) {
        setError("Lien invalide");
        setLoading(false);
        return;
      }
      const { data: rpc, error: rpcErr } = await supabase.rpc(
        "get_field_payment_intent_public" as never,
        { p_id: intentId },
      );
      if (cancelled) return;
      if (rpcErr || !rpc) {
        setError("Commande introuvable. Contactez votre représentant Nivra.");
      } else {
        const d = rpc as IntentData;
        setData(d);
        // Pre-fill signature name from existing client info
        const ci = d.quote?.client_info;
        setSignatureName(
          `${ci?.first_name || ""} ${ci?.last_name || ""}`.trim() || d.intent.customer_name || "",
        );
        // Restore saved signature if any
        if (d.intent.signature) {
          setSignatureSaved(d.intent.signature);
          const cf = d.intent.consent_flags || {};
          setConsentAccuracy(!!cf.accuracy);
          setConsentTerms(!!cf.terms);
          setConsentActivation(!!cf.activation);
        }
        // Journal — link_opened (best-effort, fire-and-forget)
        supabase.rpc("log_field_order_event" as never, {
          p_intent_id: intentId,
          p_event_type: "link_opened",
          p_payload: { ua: navigator.userAgent.slice(0, 200) } as never,
        }).then(undefined, () => {});
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [intentId]);

  const isCompleted = useMemo(
    () => data?.intent?.status === "completed" || !!data?.intent?.paid_at,
    [data],
  );

  const isCancelled = data?.intent?.status === "cancelled";
  const isExpired =
    !isCompleted &&
    data?.intent?.expires_at &&
    new Date(data.intent.expires_at).getTime() < Date.now();

  const allConsentsGiven = consentAccuracy && consentTerms && consentActivation;
  const canPay = allConsentsGiven && !!signatureSaved;

  // Redirect if already paid
  useEffect(() => {
    if (isCompleted && intentId) {
      const t = setTimeout(() => navigate(`/commande/confirmee/${intentId}`, { replace: true }), 800);
      return () => clearTimeout(t);
    }
  }, [isCompleted, intentId, navigate]);

  // Load Square when signature is ready
  useEffect(() => {
    if (!canPay || isCompleted || !data) return;

    let destroyed = false;
    setSqLoading(true);

    const init = async () => {
      try {
        if (!(window as any).Square) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[src*="web.squarecdn.com"]');
            if (existing) {
              const poll = setInterval(() => {
                if ((window as any).Square) {
                  clearInterval(poll);
                  resolve();
                }
              }, 100);
              return;
            }
            const s = document.createElement("script");
            s.src = "https://web.squarecdn.com/v1/square.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Impossible de charger Square"));
            document.head.appendChild(s);
          });
        }
        if (destroyed) return;
        const payments = (window as any).Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        await card.attach(containerRef.current!);
        if (destroyed) {
          card.destroy();
          return;
        }
        cardRef.current = card;
        setSqLoading(false);
      } catch (e: any) {
        if (!destroyed) {
          toast.error("Erreur Square : " + (e?.message || String(e)));
          setSqLoading(false);
        }
      }
    };

    init();
    return () => {
      destroyed = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, [canPay, data, isCompleted]);

  const handleSaveSignature = async (dataUrl: string, method: "typed" | "drawn") => {
    if (!intentId) return;
    if (!signatureName || signatureName.trim().length < 3) {
      toast.error("Entrez votre nom complet.");
      return;
    }
    if (!allConsentsGiven) {
      toast.error("Cochez les 3 confirmations avant de signer.");
      return;
    }
    setSavingSig(true);
    try {
      const res = await fetch(`${BACKEND_URL}/functions/v1/field-payment-intent-update`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent_id: intentId,
          mode: "signature",
          signature: { name: signatureName.trim(), data_url: dataUrl, method },
          consent_flags: {
            accuracy: consentAccuracy,
            terms: consentTerms,
            activation: consentActivation,
          },
        }),
      });
      const d = await res.json();
      if (!d?.ok) throw new Error(d?.error || "Erreur");
      setSignatureSaved({ name: signatureName.trim(), method, signed_at: d.signed_at });
      toast.success("Signature enregistrée. Vous pouvez maintenant payer.");
    } catch (e: any) {
      toast.error("Impossible d'enregistrer la signature : " + (e?.message || String(e)));
    } finally {
      setSavingSig(false);
    }
  };

  const handlePay = async () => {
    if (!cardRef.current || !intentId) return;
    setPaying(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        toast.error(result.errors?.[0]?.message || "Informations de carte invalides");
        return;
      }
      const res = await fetch(`${BACKEND_URL}/functions/v1/square-charge-invoice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source_id: result.token, intent_id: intentId }),
      });
      const d = await res.json();
      if (!d?.ok) {
        if (d?.already_paid) {
          toast.info("Cette commande a déjà été payée.");
          navigate(`/commande/confirmee/${intentId}`, { replace: true });
          return;
        }
        if (d?.cancelled) {
          toast.error("Cette commande a été annulée.");
          await refresh();
          return;
        }
        if (d?.in_progress) {
          toast.info("Un paiement est en cours de traitement. Merci de patienter quelques secondes.");
          return;
        }
        toast.error(d?.error || "Paiement refusé");
        return;
      }
      navigate(`/commande/confirmee/${intentId}`, { replace: true });
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: "#020209" }} className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Page>
        <Card>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-bold text-white">Commande introuvable</h2>
              <p className="mt-2 text-sm text-white/60">
                {error || "Ce lien n'est plus valide."}{" "}
                <a className="text-violet-400 underline" href="mailto:support@nivra-telecom.ca">
                  support@nivra-telecom.ca
                </a>
              </p>
            </div>
          </div>
        </Card>
      </Page>
    );
  }

  if (isCancelled) {
    return (
      <Page>
        <Card>
          <div className="text-center space-y-3 py-4">
            <AlertCircle className="h-14 w-14 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Cette commande n'est plus disponible.</h2>
            <p className="text-sm text-white/60">
              Elle a été annulée. Contactez votre représentant Nivra pour repartir sur une nouvelle commande.
            </p>
            <Button
              onClick={() => (window.location.href = "mailto:support@nivra-telecom.ca")}
              className="mt-2 bg-violet-600 hover:bg-violet-500"
            >
              Contacter mon représentant
            </Button>
          </div>
        </Card>
      </Page>
    );
  }

  if (isExpired) {
    return (
      <Page>
        <Card>
          <div className="text-center space-y-3 py-4">
            <AlertCircle className="h-14 w-14 text-amber-500 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Ce lien a expiré.</h2>
            <p className="text-sm text-white/60">
              Pour des raisons de sécurité, ce lien de commande était valide 7 jours.
              Contactez votre représentant pour en recevoir un nouveau.
            </p>
            <Button
              onClick={() => (window.location.href = "mailto:support@nivra-telecom.ca")}
              className="mt-2 bg-violet-600 hover:bg-violet-500"
            >
              Contacter mon représentant
            </Button>
          </div>
        </Card>
      </Page>
    );
  }


  const { intent, quote, agent_name } = data;
  const ci = quote?.client_info || {};
  const firstName = ci.first_name || "";
  const amount = Number(intent.amount);

  const monthlyTotal = (quote?.services || []).reduce(
    (s: number, x: any) => s + Number(x?.monthlyPrice || 0),
    0,
  );
  const monthlyDiscount = Number(quote?.discount?.monthly_amount || quote?.discount?.amount || 0);
  const monthlyAfter = Math.max(0, monthlyTotal - monthlyDiscount);

  const billingAddr = ci.billing_address || {
    address: ci.address,
    apartment: ci.apartment,
    city: ci.city,
    province: ci.province,
    postal_code: ci.postal_code,
  };

  return (
    <Page>
      <Helmet>
        <title>Revoir votre commande — Nivra Telecom</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Hero */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/15 ring-1 ring-violet-500/40">
            <CheckCircle2 className="h-5 w-5 text-violet-300" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
              Bonjour {firstName || "et bienvenue"} !
            </h1>
            <p className="text-sm text-white/70 leading-relaxed">
              Votre représentant <span className="font-semibold text-white">{agent_name}</span> a
              préparé votre commande. Vérifiez les informations ci-dessous, confirmez, puis
              procédez au paiement sécurisé.
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="mt-5 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider">
          <Step n={1} label="Vérifier" active />
          <Step n={2} label="Confirmer" active={allConsentsGiven || !!signatureSaved} />
          <Step n={3} label="Signer" active={!!signatureSaved} />
          <Step n={4} label="Payer" active={canPay} />
        </div>
      </Card>

      {/* Order details */}
      <Card>
        <SectionHeader icon={<ReceiptIcon className="h-4 w-4" />} title="Détails de votre commande" />
        {quote ? (
          <div className="space-y-4">
            {/* Services */}
            {quote.services?.length > 0 && (
              <Block label="Forfaits">
                {quote.services.map((s: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{s?.name}</p>
                      {(s?.speed || s?.description) && (
                        <p className="text-[11px] text-white/50">
                          {s.speed && <span>Vitesse : {s.speed}</span>}
                          {s.speed && s.description ? " • " : ""}
                          {s.description}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-white flex-shrink-0">
                      {fmt(Number(s?.monthlyPrice || 0))}/mois
                    </span>
                  </div>
                ))}
              </Block>
            )}

            {/* Equipment */}
            {quote.equipment?.length > 0 && (
              <Block label="Équipements">
                {quote.equipment.map((e: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
                      <span className="text-sm text-white truncate">
                        {e?.name}
                        {e?.quantity > 1 ? ` ×${e.quantity}` : ""}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 flex-shrink-0">
                        {e?.rental ? "Location" : "Achat"}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-white flex-shrink-0">
                      {fmt(Number(e?.price || 0) * Number(e?.quantity || 1))}
                    </span>
                  </div>
                ))}
              </Block>
            )}

            {/* Promotions & discount */}
            {quote.discount && (
              <Block label="Promotion appliquée">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {quote.discount?.label || quote.discount?.name || "Rabais agent"}
                  </span>
                  <span className="text-sm font-semibold text-emerald-300">
                    − {fmt(Number(quote.discount?.amount || 0))}
                  </span>
                </div>
              </Block>
            )}

            {/* Fees */}
            <Block label="Frais">
              {Number(quote.activation_fee) > 0 && (
                <Row label="Frais d'activation (unique)" value={fmt(quote.activation_fee)} />
              )}
              <Row label="Sous-total" value={fmt(quote.subtotal)} muted />
              <Row label="TPS (5%)" value={fmt(quote.tps)} muted />
              <Row label="TVQ (9,975%)" value={fmt(quote.tvq)} muted />
            </Block>

            {/* Totals */}
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-white/70">Total mensuel après promotions</span>
                <span className="text-base font-bold text-white">{fmt(monthlyAfter)}/mois</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex items-baseline justify-between">
                <span className="text-base font-semibold text-white">Total à payer aujourd'hui</span>
                <span className="text-2xl font-bold text-violet-300">{fmt(quote.total)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-white/60">
            Total : <span className="font-bold text-white">{fmt(amount)}</span>
          </div>
        )}
      </Card>

      {/* Installation */}
      {quote && (
        <Card>
          <SectionHeader icon={<CalendarClock className="h-4 w-4" />} title="Installation" />
          <div className="space-y-2">
            <Row
              label="Mode d'installation"
              value={quote.install_mode === "self" ? "Auto-installation" : "Installation par technicien"}
            />
            <Row
              label="Date prévue"
              value={fmtDate(quote.install_date) || "À confirmer avec le technicien"}
            />
            <p className="text-xs text-white/40 pt-1">
              Besoin d'une autre date ? Écrivez à{" "}
              <a href="mailto:support@nivra-telecom.ca" className="text-violet-400 underline">
                support@nivra-telecom.ca
              </a>{" "}
              après confirmation.
            </p>
          </div>
        </Card>
      )}

      {/* Client info (locked + edit) */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <SectionHeader icon={<UserIcon className="h-4 w-4" />} title="Vos informations" noMargin />
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 px-2 py-1 rounded-md hover:bg-violet-500/10 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Modifier
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 relative">
          <div className="absolute -top-1 -right-1 text-white/30">
            <Lock className="h-3 w-3" />
          </div>
          <Field label="Titulaire" value={`${ci.first_name || ""} ${ci.last_name || ""}`.trim()} />
          <Field label="Téléphone" value={ci.phone} />
          <Field label="Courriel" value={ci.email || intent.customer_email} />
          <Field
            label="Adresse de service"
            value={[ci.address, ci.apartment && `App. ${ci.apartment}`, ci.city, ci.province, ci.postal_code]
              .filter(Boolean)
              .join(", ")}
            icon={<MapPin className="h-3 w-3" />}
          />
          <Field
            label="Adresse de facturation"
            value={[
              billingAddr.address,
              billingAddr.apartment && `App. ${billingAddr.apartment}`,
              billingAddr.city,
              billingAddr.province,
              billingAddr.postal_code,
            ]
              .filter(Boolean)
              .join(", ") || "Même que l'adresse de service"}
            icon={<MapPin className="h-3 w-3" />}
            full
          />
        </div>
      </Card>

      {/* Confirmation & signature */}
      <Card>
        <SectionHeader
          icon={<FileSignature className="h-4 w-4" />}
          title="Confirmation de la commande"
        />
        <div className="space-y-3">
          <ConsentRow
            checked={consentAccuracy}
            onCheckedChange={setConsentAccuracy}
            disabled={!!signatureSaved}
            label="Je confirme que les renseignements ci-dessus sont exacts."
          />
          <ConsentRow
            checked={consentTerms}
            onCheckedChange={setConsentTerms}
            disabled={!!signatureSaved}
            label={
              <>
                J'accepte les{" "}
                <a
                  href="/legal/conditions-service"
                  target="_blank"
                  rel="noopener"
                  className="text-violet-400 underline"
                >
                  conditions de service
                </a>{" "}
                de Nivra Telecom.
              </>
            }
          />
          <ConsentRow
            checked={consentActivation}
            onCheckedChange={setConsentActivation}
            disabled={!!signatureSaved}
            label="J'autorise l'activation du service selon les informations ci-dessus."
          />
        </div>

        <div className="mt-5 pt-5 border-t border-white/10">
          {signatureSaved ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    Signature enregistrée — {signatureSaved.name}
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">
                    Signé le{" "}
                    {new Date(signatureSaved.signed_at || Date.now()).toLocaleString("fr-CA")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="sig-name" className="text-white/80 text-sm">
                  Nom complet
                </Label>
                <Input
                  id="sig-name"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Prénom Nom"
                  className="mt-1.5 bg-white/[0.04] border-white/10 text-white"
                  disabled={!allConsentsGiven}
                />
              </div>
              <div className={allConsentsGiven ? "" : "opacity-40 pointer-events-none"}>
                <TypedSignatureInput
                  value={signatureName}
                  onChange={setSignatureName}
                  label="Votre signature"
                  placeholder="Tapez votre nom pour signer"
                  previewClassName="bg-white text-slate-900"
                />
              </div>
              <Button
                type="button"
                disabled={!allConsentsGiven || savingSig || signatureName.trim().length < 3}
                onClick={() => {
                  // Use the typed signature as a data URI (text preview is enough for record-keeping)
                  const canvas = document.createElement("canvas");
                  canvas.width = 600;
                  canvas.height = 150;
                  const ctx = canvas.getContext("2d")!;
                  ctx.fillStyle = "#ffffff";
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.fillStyle = "#0f172a";
                  ctx.font = "italic 42px 'Dancing Script', cursive";
                  ctx.textBaseline = "middle";
                  ctx.fillText(signatureName, 20, 75);
                  handleSaveSignature(canvas.toDataURL("image/png"), "typed");
                }}
                className="w-full h-12 bg-violet-600 hover:bg-violet-700"
              >
                {savingSig ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enregistrement…
                  </>
                ) : (
                  <>
                    <FileSignature className="h-4 w-4 mr-2" /> Confirmer et signer
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Payment */}
      <Card>
        <SectionHeader icon={<CreditCard className="h-4 w-4" />} title="Paiement sécurisé" />
        {!canPay ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
            <Lock className="h-8 w-8 text-white/30 mx-auto mb-2" />
            <p className="text-sm text-white/60">
              Confirmez et signez ci-dessus pour débloquer le paiement.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div ref={containerRef} id="sq-payer-card-container" className="min-h-[90px]" />
            {sqLoading && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-white/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement du formulaire…
              </div>
            )}
            <button
              type="button"
              disabled={sqLoading || paying}
              onClick={handlePay}
              className="w-full h-14 rounded-xl bg-violet-600 text-white font-bold text-base shadow-lg shadow-violet-600/30 hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Traitement…
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Payer {fmt(amount)}
                </>
              )}
            </button>
            <p className="flex items-center justify-center gap-2 text-xs text-white/40 pt-1">
              <Lock className="h-3.5 w-3.5" />
              Paiement sécurisé via Square — PCI-DSS
            </p>
          </div>
        )}
      </Card>

      {/* Edit dialog */}
      <EditInfoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        intentId={intentId!}
        initial={{
          phone: ci.phone || "",
          email: ci.email || intent.customer_email || "",
          service_address: {
            address: ci.address || "",
            apartment: ci.apartment || "",
            city: ci.city || "",
            province: ci.province || "QC",
            postal_code: ci.postal_code || "",
          },
          billing_address: {
            address: billingAddr.address || "",
            apartment: billingAddr.apartment || "",
            city: billingAddr.city || "",
            province: billingAddr.province || "QC",
            postal_code: billingAddr.postal_code || "",
          },
        }}
        onSaved={refresh}
      />
    </Page>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function Step({ n, label, active }: { n: number; label: string; active?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-lg py-2 border ${
        active
          ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
          : "border-white/5 bg-white/[0.02] text-white/40"
      }`}
    >
      <span className="text-xs font-bold">{n}</span>
      <span className="text-[9px]">{label}</span>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  noMargin,
}: {
  icon: React.ReactNode;
  title: string;
  noMargin?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${noMargin ? "" : "mb-4"}`}>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
        {icon}
      </div>
      <h2 className="text-base font-bold text-white">{title}</h2>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">{label}</p>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5 divide-y divide-white/[0.06]">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={`text-sm ${muted ? "text-white/50" : "text-white/75"}`}>{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          muted ? "text-white/60" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
  full,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-sm text-white break-words">{value || "—"}</p>
    </div>
  );
}

function ConsentRow({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.04] transition-colors ${
        disabled ? "opacity-70 cursor-not-allowed" : ""
      }`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => !disabled && onCheckedChange(!!v)}
        className="mt-0.5"
        disabled={disabled}
      />
      <span className="text-sm text-white/85 leading-relaxed">{label}</span>
    </label>
  );
}

/* ── Edit dialog ────────────────────────────────────────── */

interface EditInitial {
  phone: string;
  email: string;
  service_address: { address: string; apartment: string; city: string; province: string; postal_code: string };
  billing_address: { address: string; apartment: string; city: string; province: string; postal_code: string };
}

function EditInfoDialog({
  open,
  onOpenChange,
  intentId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  intentId: string;
  initial: EditInitial;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditInitial>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  const setSvc = (k: keyof EditInitial["service_address"], v: string) =>
    setForm((f) => ({ ...f, service_address: { ...f.service_address, [k]: v } }));
  const setBil = (k: keyof EditInitial["billing_address"], v: string) =>
    setForm((f) => ({ ...f, billing_address: { ...f.billing_address, [k]: v } }));

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/functions/v1/field-payment-intent-update`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ intent_id: intentId, mode: "edits", edits: form }),
      });
      const d = await res.json();
      if (!d?.ok) throw new Error(d?.error || "Erreur");
      toast.success("Vos informations ont été mises à jour.");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier mes informations</DialogTitle>
          <DialogDescription>
            Seuls votre téléphone, votre courriel et vos adresses peuvent être modifiés. Les prix et
            forfaits restent verrouillés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ed-phone">Téléphone</Label>
              <Input
                id="ed-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ed-email">Courriel</Label>
              <Input
                id="ed-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Adresse de service
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Adresse"
                value={form.service_address.address}
                onChange={(e) => setSvc("address", e.target.value)}
                className="sm:col-span-2"
              />
              <Input placeholder="App." value={form.service_address.apartment} onChange={(e) => setSvc("apartment", e.target.value)} />
              <Input placeholder="Ville" value={form.service_address.city} onChange={(e) => setSvc("city", e.target.value)} />
              <Input placeholder="Province" value={form.service_address.province} onChange={(e) => setSvc("province", e.target.value)} />
              <Input placeholder="Code postal" value={form.service_address.postal_code} onChange={(e) => setSvc("postal_code", e.target.value)} />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Adresse de facturation
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Adresse" value={form.billing_address.address} onChange={(e) => setBil("address", e.target.value)} className="sm:col-span-2" />
              <Input placeholder="App." value={form.billing_address.apartment} onChange={(e) => setBil("apartment", e.target.value)} />
              <Input placeholder="Ville" value={form.billing_address.city} onChange={(e) => setBil("city", e.target.value)} />
              <Input placeholder="Province" value={form.billing_address.province} onChange={(e) => setBil("province", e.target.value)} />
              <Input placeholder="Code postal" value={form.billing_address.postal_code} onChange={(e) => setBil("postal_code", e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Layout ─────────────────────────────────────────────── */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#020209" }} className="relative min-h-screen overflow-hidden">
      <PhotoBg
        url="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&q=80"
        opacity={0.1}
        filter="saturate(0.6) brightness(0.65)"
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-15%",
          right: "-8%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(124,58,237,0.14) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(2,2,9,0.85)",
          backdropFilter: "blur(12px)",
          position: "relative",
        }}
      >
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <a href="https://nivra-telecom.ca" className="flex items-center gap-2">
            <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-1px", color: "#A78BFA" }}>
              Nivra
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Telecom
            </span>
          </a>
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#06B6D4" }} /> Paiement sécurisé
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">{children}</main>
      <footer
        className="mx-auto max-w-2xl px-4 py-8 text-center"
        style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}
      >
        © {new Date().getFullYear()} Nivra Telecom — support@nivra-telecom.ca
      </footer>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(24px)",
        padding: 20,
      }}
    >
      {children}
    </div>
  );
}
