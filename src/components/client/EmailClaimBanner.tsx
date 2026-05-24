/**
 * EmailClaimBanner — Phase 21
 * Détecte automatiquement les commandes/factures/soumissions orphelines
 * associées à l'email du compte connecté. Affiche une bannière proposant
 * la revendication via un code OTP envoyé par courriel.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Mail, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Counts {
  total: number;
  orders: number;
  quotes: number;
  auto_docs: number;
}

export default function EmailClaimBanner() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [email, setEmail] = useState<string>("");
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"intro" | "sent" | "success">("intro");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [appliedCounts, setAppliedCounts] = useState<Counts | null>(null);

  // Initial detect
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("account-claim-actions", {
          body: { action: "detect" },
        });
        if (cancelled) return;
        if (error || !data?.ok) return;
        if ((data.counts?.total ?? 0) > 0) {
          setCounts(data.counts);
          setEmail(data.email);
          // Auto-dismiss if user already dismissed this session
          const dis = sessionStorage.getItem(`claim_dismissed_${data.email}`);
          if (dis) setDismissed(true);
        }
      } catch {
        /* silent */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const sendCode = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-claim-actions", {
        body: { action: "request_code" },
      });
      if (error || !data?.ok) {
        const msg = (data as any)?.message || (error as any)?.message || "Impossible d'envoyer le code.";
        toast.error(msg);
        return;
      }
      toast.success("Code envoyé à " + data.sent_to);
      setStep("sent");
      setResendCooldown(60);
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Le code doit comporter 6 chiffres");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-claim-actions", {
        body: { action: "verify_code", code },
      });
      if (error || !data?.ok) {
        const msg = (data as any)?.message || ((data as any)?.error === "bad_code"
          ? `Code invalide (${(data as any)?.remaining_attempts ?? 0} tentative(s) restante(s))`
          : "Code invalide");
        toast.error(msg);
        return;
      }
      setAppliedCounts(data.applied);
      setStep("success");
      toast.success("Compte rattaché avec succès !");
      // Refresh page data
      setTimeout(() => {
        setOpen(false);
        setCounts(null);
        window.location.reload();
      }, 2500);
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setVerifying(false);
    }
  };

  const dismiss = () => {
    if (email) sessionStorage.setItem(`claim_dismissed_${email}`, "1");
    setDismissed(true);
  };

  if (!counts || counts.total === 0 || dismissed) return null;

  const parts: string[] = [];
  if (counts.orders > 0) parts.push(`${counts.orders} commande${counts.orders > 1 ? "s" : ""}`);
  if (counts.quotes > 0) parts.push(`${counts.quotes} soumission${counts.quotes > 1 ? "s" : ""}`);
  if (counts.auto_docs > 0) parts.push(`${counts.auto_docs} document${counts.auto_docs > 1 ? "s" : ""}`);

  return (
    <>
      <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 sm:p-5 shadow-sm">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
              Nous avons trouvé {parts.join(", ")} associé{counts.total > 1 ? "s" : ""} à votre adresse
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Vérifiez votre courriel <strong>{email}</strong> pour rattacher ces éléments à votre compte.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => { setOpen(true); setStep("intro"); }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Vérifier mon courriel
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} className="text-slate-600">
                Plus tard
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-md">
          {step === "intro" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  Vérification de votre adresse
                </DialogTitle>
                <DialogDescription>
                  Pour rattacher les éléments associés à <strong>{email}</strong>, nous allons vous envoyer un code à 6 chiffres par courriel.
                </DialogDescription>
              </DialogHeader>
              <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-1.5">
                {counts.orders > 0 && <div>📦 <strong>{counts.orders}</strong> commande(s)</div>}
                {counts.quotes > 0 && <div>📝 <strong>{counts.quotes}</strong> soumission(s)</div>}
                {counts.auto_docs > 0 && <div>📄 <strong>{counts.auto_docs}</strong> document(s) (factures, reçus…)</div>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={sendCode} disabled={sending} className="bg-blue-600 hover:bg-blue-700">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Mail className="h-4 w-4 mr-1.5" />}
                  Envoyer le code
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "sent" && (
            <>
              <DialogHeader>
                <DialogTitle>Entrez le code reçu</DialogTitle>
                <DialogDescription>
                  Un code à 6 chiffres a été envoyé à <strong>{email}</strong>. Il expire dans 10 minutes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={resendCooldown > 0 || sending}
                  className="text-xs text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? `Renvoyer dans ${resendCooldown}s`
                    : "Je n'ai rien reçu — renvoyer le code"}
                </button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={verifyCode} disabled={verifying || code.length !== 6} className="bg-blue-600 hover:bg-blue-700">
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                  Vérifier
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "success" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Rattachement réussi !
                </DialogTitle>
                <DialogDescription>
                  Votre adresse a été vérifiée et les éléments suivants ont été ajoutés à votre compte :
                </DialogDescription>
              </DialogHeader>
              <div className="bg-emerald-50 rounded-lg p-4 text-sm space-y-1.5">
                {(appliedCounts?.orders ?? 0) > 0 && <div>✅ <strong>{appliedCounts!.orders}</strong> commande(s)</div>}
                {(appliedCounts?.quotes ?? 0) > 0 && <div>✅ <strong>{appliedCounts!.quotes}</strong> soumission(s)</div>}
                {(appliedCounts?.auto_docs ?? 0) > 0 && <div>✅ <strong>{appliedCounts!.auto_docs}</strong> document(s)</div>}
              </div>
              <p className="text-xs text-slate-500 text-center">Rechargement du portail…</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
