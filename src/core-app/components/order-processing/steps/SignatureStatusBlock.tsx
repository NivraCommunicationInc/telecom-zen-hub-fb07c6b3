/**
 * SignatureStatusBlock — Phase A click-to-sign status indicator + actions.
 *
 * Shows:
 *  • ✅ Signed badge (green) with date/time + masked IP when signed.
 *  • ⏳ Pending badge (orange, pulsing) with copy-link + resend buttons when not signed.
 *  • Warning banner blocking shipping until signed.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Copy, Send, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SignatureStatusBlockProps {
  contract: any;
  order: any;
  onRefresh?: () => void;
}

// Client-facing contract link must land on the dedicated public signer route.
// Canonical route used in emails: /portal/signer/:token
const SIGN_BASE_URL = "https://nivra-telecom.ca/portal/signer";

function maskIp(ip?: string | null): string {
  if (!ip) return "—";
  // IPv4: keep first two octets
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return `${v4[1]}.${v4[2]}.•••.•••`;
  // IPv6 / unknown: keep first 6 chars
  return ip.slice(0, 6) + "…";
}

export function SignatureStatusBlock({ contract, order, onRefresh }: SignatureStatusBlockProps) {
  const [busy, setBusy] = useState<"resend" | "generate" | "sendNow" | null>(null);

  const signed = !!contract?.client_signed_at;
  const token: string | null = contract?.signature_token || null;
  const signatureUrl = useMemo(() => (token ? `${SIGN_BASE_URL}/${encodeURIComponent(token)}` : null), [token]);
  const clientName =
    order?.client_full_name ||
    [order?.client_first_name, order?.client_last_name].filter(Boolean).join(" ") ||
    "Client";

  // ── One-click: generate token (if needed) + email link to client ──
  const handleGenerateAndSend = async () => {
    if (!contract?.id) {
      toast.error("Aucun contrat à signer");
      return;
    }
    const clientEmail =
      order?.client_email ||
      order?.profile?.email ||
      contract?.client_email ||
      null;
    if (!clientEmail) {
      toast.error("Aucun courriel client — ajoutez-en un d'abord");
      return;
    }

    setBusy("sendNow");
    try {
      // 1. Issue (or rotate) a fresh signature token
      const { data: tk, error: tkErr } = await supabase.rpc(
        "generate_contract_signature_token" as any,
        { p_contract_id: contract.id },
      );
      if (tkErr) throw tkErr;
      const freshToken = String(tk || "").trim();
      if (!freshToken) throw new Error("Token vide retourné par le serveur");
      const url = `${SIGN_BASE_URL}/${encodeURIComponent(freshToken)}`;

      // 2. Queue branded email through canonical pipeline
      const { error: qErr } = await supabase.from("email_queue").insert({
        event_key: `contract_sign_request_${contract.id}_${freshToken.slice(0, 12)}`,
        to_email: clientEmail,
        template_key: "contract_sign_request",
        subject: "Votre contrat est prêt à signer — Nivra",
        entity_type: "contract",
        entity_id: contract.id,
        message_type: "contract_signature_request",
        template_vars: {
          client_name: clientName,
          client_first_name: order?.client_first_name || "",
          client_last_name: order?.client_last_name || "",
          signature_url: url,
          sign_url: url,
          order_number: order?.order_number || "",
          contract_number: contract?.contract_number || "",
        } as any,
        priority: 10,
        status: "queued",
      } as any);
      if (qErr) throw qErr;

      // 3. Update sent_at / sent_count for traceability
      await supabase
        .from("contracts")
        .update({
          sent_at: new Date().toISOString(),
          sent_count: (contract.sent_count || 0) + 1,
        })
        .eq("id", contract.id);

      toast.success(`Lien de signature envoyé à ${clientEmail}`);
      onRefresh?.();
    } catch (err: any) {
      console.error("[SignatureStatusBlock] generate+send error:", err);
      toast.error(err?.message || "Erreur lors de l'envoi du lien");
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    if (!signatureUrl) {
      toast.error("Aucun lien — générez d'abord le contrat");
      return;
    }
    try {
      await navigator.clipboard.writeText(signatureUrl);
      toast.success("Lien de signature copié");
    } catch {
      toast.error("Impossible de copier — copiez manuellement");
    }
  };

  const handleGenerateToken = async () => {
    if (!contract?.id) return;
    setBusy("generate");
    try {
      const { data, error } = await supabase.rpc(
        "generate_contract_signature_token" as any,
        { p_contract_id: contract.id },
      );
      if (error) throw error;
      toast.success("Lien de signature généré");
      onRefresh?.();
    } catch (err: any) {
      console.error("[SignatureStatusBlock] generate token error:", err);
      toast.error(err?.message || "Erreur lors de la génération du lien");
    } finally {
      setBusy(null);
    }
  };

  const handleResend = async () => {
    if (!signatureUrl || !contract?.id) {
      toast.error("Aucun lien à renvoyer");
      return;
    }
    const clientEmail =
      order?.client_email ||
      order?.profile?.email ||
      contract?.client_email ||
      null;

    if (!clientEmail) {
      toast.error("Aucun courriel client");
      return;
    }

    setBusy("resend");
    try {
      // Queue email through canonical pipeline
      const { error } = await supabase.from("email_queue").insert({
        event_key: `contract_sign_request_${contract.id}_${Date.now()}`,
        to_email: clientEmail,
        template_key: "contract_sign_request",
        subject: "Votre contrat est prêt à signer — Nivra",
        entity_type: "contract",
        entity_id: contract.id,
        message_type: "contract_signature_request",
        template_vars: {
          client_name: clientName,
          client_first_name: order?.client_first_name || "",
          client_last_name: order?.client_last_name || "",
          signature_url: signatureUrl,
          sign_url: signatureUrl,
          order_number: order?.order_number || "",
          contract_number: contract?.contract_number || "",
        } as any,
        priority: 10,
        status: "queued",
      } as any);
      if (error) throw error;

      // Bump sent_count for traceability
      await supabase
        .from("contracts")
        .update({
          sent_at: new Date().toISOString(),
          sent_count: (contract.sent_count || 0) + 1,
        })
        .eq("id", contract.id);

      toast.success(`Lien renvoyé à ${clientEmail}`);
      onRefresh?.();
    } catch (err: any) {
      console.error("[SignatureStatusBlock] resend error:", err);
      toast.error(err?.message || "Erreur lors du renvoi");
    } finally {
      setBusy(null);
    }
  };

  // ── Already signed state ──
  if (signed) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Signé électroniquement
              </span>
              <span className="text-xs text-muted-foreground">
                le{" "}
                <strong className="text-foreground">
                  {format(new Date(contract.client_signed_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                </strong>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-muted-foreground">Signataire :</span>{" "}
                <span className="font-medium text-foreground">
                  {contract.client_signer_name || order?.client_full_name || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Méthode :</span>{" "}
                <span className="font-medium text-foreground">
                  {contract.signature_method || "click_to_sign"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">IP :</span>{" "}
                <span className="font-mono text-foreground">{maskIp(contract.client_signed_ip)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Not signed state ──
  return (
    <div className="mt-4 space-y-2">
      {/* Warning banner — blocks shipping */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-amber-400">
            ⚠️ Impossible d'expédier avant signature du contrat
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Le client doit signer électroniquement avant que la commande puisse passer au statut « expédié ».
          </p>
        </div>
      </div>

      {/* Status row + actions */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
              </span>
              <Clock className="h-3 w-3" />
              En attente de signature client
            </span>
            {contract?.sent_count > 0 && (
              <span className="text-[11px] text-muted-foreground">
                Envoyé {contract.sent_count}×
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {!signatureUrl ? (
              <Button
                size="sm"
                onClick={handleGenerateAndSend}
                disabled={busy === "sendNow"}
                className="h-7 text-xs"
              >
                {busy === "sendNow" ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Send className="h-3 w-3 mr-1" />
                )}
                Générer & envoyer le lien
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-7 text-xs"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copier
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateAndSend}
                  disabled={busy === "sendNow"}
                  className="h-7 text-xs"
                >
                  {busy === "sendNow" ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Send className="h-3 w-3 mr-1" />
                  )}
                  {contract?.sent_count > 0 ? "Renvoyer le lien" : "Envoyer par courriel"}
                </Button>
              </>
            )}
          </div>
        </div>

        {signatureUrl && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Lien de signature</p>
            <code className="text-[11px] font-mono text-foreground break-all">{signatureUrl}</code>
          </div>
        )}
      </div>
    </div>
  );
}

export default SignatureStatusBlock;
