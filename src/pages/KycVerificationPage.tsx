/**
 * KycVerificationPage — Public page accessed via secure token email link.
 * URL: /verification/:token
 *
 * Loads the KYC request via SECURITY DEFINER RPC, lets the client upload
 * a single ID document, then submits to the kyc-public-upload edge function.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, Upload, CheckCircle2, AlertCircle, Lock } from "lucide-react";

type State = "loading" | "ready" | "uploading" | "done" | "error" | "expired" | "already";

export default function KycVerificationPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<{ orderNumber?: string; planName?: string; expiresAt?: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    document.title = "Vérification d'identité · Nivra Telecom";
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setState("error");
        setErr("Lien invalide.");
        return;
      }
      const { data, error } = await supabase.rpc("get_kyc_request_by_token", { p_token: token });
      if (!active) return;
      if (error) {
        setState("error");
        setErr(error.message);
        return;
      }
      const row = (data as any[])?.[0];
      if (!row) {
        setState("error");
        setErr("Ce lien est introuvable ou a été révoqué.");
        return;
      }
      setInfo({ orderNumber: row.order_number, planName: row.plan_name, expiresAt: row.expires_at });
      if (new Date(row.expires_at).getTime() < Date.now()) {
        setState("expired");
        return;
      }
      if (row.status === "completed" || row.status === "approved") {
        setState("already");
        return;
      }
      if (row.status === "rejected") {
        setState("error");
        setErr("Cette demande a été refusée. Contactez-nous pour une nouvelle vérification.");
        return;
      }
      setState("ready");
    })();
    return () => { active = false; };
  }, [token]);

  const expiresLabel = useMemo(() => {
    if (!info?.expiresAt) return null;
    try {
      return new Date(info.expiresAt).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });
    } catch { return null; }
  }, [info]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !token) return;
    setState("uploading");
    setErr(null);
    try {
      const form = new FormData();
      form.append("token", token);
      form.append("file", file);

      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/kyc-public-upload`;
      const res = await fetch(url, {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Échec (${res.status})`);
      }
      setState("done");
    } catch (e: any) {
      setErr(e?.message || "Une erreur est survenue.");
      setState("ready");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Vérification d'identité</h1>
          {info?.orderNumber && (
            <p className="text-sm text-muted-foreground mt-1">Commande #{info.orderNumber}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
          {state === "loading" && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
            </div>
          )}

          {state === "expired" && (
            <div className="text-center py-6">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
              <h2 className="text-lg font-semibold text-foreground">Lien expiré</h2>
              <p className="text-sm text-muted-foreground mt-2">Ce lien de vérification n'est plus valide. Contactez notre équipe à <a className="text-primary underline" href="mailto:support@nivra-telecom.ca">support@nivra-telecom.ca</a> pour recevoir un nouveau lien.</p>
            </div>
          )}

          {state === "already" && (
            <div className="text-center py-6">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
              <h2 className="text-lg font-semibold text-foreground">Vérification déjà reçue</h2>
              <p className="text-sm text-muted-foreground mt-2">Votre pièce d'identité a déjà été soumise. Vous recevrez une confirmation par courriel une fois validée.</p>
            </div>
          )}

          {state === "error" && (
            <div className="text-center py-6">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
              <h2 className="text-lg font-semibold text-foreground">Lien invalide</h2>
              <p className="text-sm text-muted-foreground mt-2">{err}</p>
            </div>
          )}

          {state === "done" && (
            <div className="text-center py-6">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
              <h2 className="text-lg font-semibold text-foreground">Document reçu ✓</h2>
              <p className="text-sm text-muted-foreground mt-2">Merci. Notre équipe vérifiera votre identité dans les meilleurs délais et vous recevrez une confirmation par courriel.</p>
            </div>
          )}

          {(state === "ready" || state === "uploading") && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {info?.planName && (
                <div className="text-sm text-muted-foreground">
                  Pour finaliser votre commande <strong className="text-foreground">{info.planName}</strong>, veuillez soumettre une pièce d'identité valide.
                </div>
              )}

              <div className="rounded-lg bg-muted/40 border border-border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Documents acceptés :</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Permis de conduire québécois</li>
                  <li>Passeport canadien</li>
                  <li>Carte d'identité gouvernementale</li>
                </ul>
              </div>

              <label className="block">
                <span className="block text-sm font-medium text-foreground mb-2">Téléverser votre pièce d'identité</span>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/60 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-7 h-7 mb-2 text-muted-foreground" />
                      <p className="text-sm text-foreground"><strong>Cliquez pour choisir un fichier</strong></p>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, HEIC ou PDF (max 10 Mo)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                {file && (
                  <p className="text-xs text-muted-foreground mt-2">Sélectionné : <strong className="text-foreground">{file.name}</strong> ({Math.round(file.size / 1024)} Ko)</p>
                )}
              </label>

              {err && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">{err}</div>
              )}

              <button
                type="submit"
                disabled={!file || state === "uploading"}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-3 text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {state === "uploading" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</>
                ) : (
                  <>Soumettre ma pièce d'identité →</>
                )}
              </button>

              {expiresLabel && (
                <p className="text-xs text-center text-muted-foreground">Lien valide jusqu'au {expiresLabel}</p>
              )}
            </form>
          )}
        </div>

        <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p>Vos documents sont chiffrés et conservés de manière sécurisée. Ils sont automatiquement supprimés 30 jours après validation. Aucune copie n'est partagée.</p>
        </div>
      </div>
    </div>
  );
}
