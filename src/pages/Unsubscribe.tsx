/**
 * Public Unsubscribe page — /unsubscribe?token=...
 * No login required. Bilingual FR/EN (browser language).
 * Calls the email-unsubscribe edge function.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MailX, MailCheck, AlertCircle } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "ready"; email: string; status: "subscribed" | "unsubscribed" }
  | { kind: "error"; message: string }
  | { kind: "working" }
  | { kind: "done"; email: string; status: "subscribed" | "unsubscribed" };

const COPY = {
  fr: {
    title: "Désabonnement",
    loading: "Vérification du lien…",
    invalid: "Lien invalide ou expiré.",
    invalidHint: "Veuillez vérifier le lien dans votre courriel ou contactez le support.",
    confirmTitle: "Vous vous désabonnez de la liste Nivra Telecom",
    confirmText: (email: string) =>
      `Confirmez le désabonnement de ${email} de tous nos courriels marketing. Cette action prend effet immédiatement.`,
    confirmBtn: "Confirmer le désabonnement",
    workingBtn: "Traitement en cours…",
    successTitle: "Vous avez été désabonné avec succès",
    successText:
      "Vous ne recevrez plus nos courriels marketing. Les courriels essentiels liés à votre compte (factures, support) restent actifs.",
    resubBtn: "Me réabonner",
    alreadyTitle: "Vous êtes désabonné",
    alreadyText: "Cette adresse n'est plus inscrite à nos courriels marketing.",
    resubTitle: "Vous êtes réabonné",
    resubText: "Vous recevrez à nouveau nos communications marketing.",
    unsubBtn: "Me désabonner à nouveau",
    contact: "Une question ? Écrivez-nous à",
  },
  en: {
    title: "Unsubscribe",
    loading: "Verifying link…",
    invalid: "Invalid or expired link.",
    invalidHint: "Please check the link in your email or contact support.",
    confirmTitle: "You are unsubscribing from the Nivra Telecom mailing list",
    confirmText: (email: string) =>
      `Confirm the unsubscription of ${email} from all marketing emails. This takes effect immediately.`,
    confirmBtn: "Confirm unsubscribe",
    workingBtn: "Processing…",
    successTitle: "You have been unsubscribed successfully",
    successText:
      "You will no longer receive our marketing emails. Account-related emails (invoices, support) remain active.",
    resubBtn: "Re-subscribe",
    alreadyTitle: "You are unsubscribed",
    alreadyText: "This address is no longer subscribed to our marketing emails.",
    resubTitle: "You are re-subscribed",
    resubText: "You will receive our marketing communications again.",
    unsubBtn: "Unsubscribe again",
    contact: "Questions? Email us at",
  },
} as const;

function pickLang(): "fr" | "en" {
  if (typeof navigator === "undefined") return "fr";
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "fr";
}

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });
  const lang = pickLang();
  const t = COPY[lang];

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: t.invalid });
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { method: "GET" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setState({ kind: "error", message: t.invalid });
        } else {
          setState({ kind: "ready", email: data.email, status: data.status });
        }
      })
      .catch(() => setState({ kind: "error", message: t.invalid }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const performAction = async (action: "unsubscribe" | "resubscribe") => {
    if (!token) return;
    setState({ kind: "working" });
    try {
      const { data, error } = await supabase.functions.invoke("email-unsubscribe", {
        body: { token, action },
      });
      if (error || !data?.ok) {
        setState({ kind: "error", message: error?.message || t.invalid });
        return;
      }
      setState({ kind: "done", email: data.email, status: data.status });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-lg p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <MailX className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t.title}</h1>
            <p className="text-xs text-muted-foreground">Nivra Telecom</p>
          </div>
        </div>

        {state.kind === "loading" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t.loading}</span>
          </div>
        )}

        {state.kind === "error" && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-medium">{state.message}</p>
                <p className="text-sm text-muted-foreground mt-1">{t.invalidHint}</p>
              </div>
            </div>
          </div>
        )}

        {(state.kind === "ready" || state.kind === "working") && state.kind === "ready" && state.status === "subscribed" && (
          <div className="space-y-4">
            <div>
              <h2 className="font-medium mb-2">{t.confirmTitle}</h2>
              <p className="text-sm text-muted-foreground">{t.confirmText(state.email)}</p>
            </div>
            <Button
              onClick={() => performAction("unsubscribe")}
              className="w-full"
              variant="destructive"
            >
              {t.confirmBtn}
            </Button>
          </div>
        )}

        {state.kind === "ready" && state.status === "unsubscribed" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <MailX className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h2 className="font-medium">{t.alreadyTitle}</h2>
                <p className="text-sm text-muted-foreground">{t.alreadyText}</p>
                <p className="text-xs text-muted-foreground mt-1">{state.email}</p>
              </div>
            </div>
            <Button onClick={() => performAction("resubscribe")} variant="outline" className="w-full">
              {t.resubBtn}
            </Button>
          </div>
        )}

        {state.kind === "working" && (
          <Button disabled className="w-full">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t.workingBtn}
          </Button>
        )}

        {state.kind === "done" && state.status === "unsubscribed" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <MailX className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h2 className="font-medium">{t.successTitle}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t.successText}</p>
                <p className="text-xs text-muted-foreground mt-1">{state.email}</p>
              </div>
            </div>
            <Button onClick={() => performAction("resubscribe")} variant="outline" className="w-full">
              {t.resubBtn}
            </Button>
          </div>
        )}

        {state.kind === "done" && state.status === "subscribed" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2">
              <MailCheck className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h2 className="font-medium">{t.resubTitle}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t.resubText}</p>
                <p className="text-xs text-muted-foreground mt-1">{state.email}</p>
              </div>
            </div>
            <Button onClick={() => performAction("unsubscribe")} variant="outline" className="w-full">
              {t.unsubBtn}
            </Button>
          </div>
        )}

        <div className="pt-4 border-t text-xs text-muted-foreground text-center">
          {t.contact}{" "}
          <a href="mailto:support@nivra-telecom.ca" className="underline">
            support@nivra-telecom.ca
          </a>
        </div>
      </Card>
    </div>
  );
}
