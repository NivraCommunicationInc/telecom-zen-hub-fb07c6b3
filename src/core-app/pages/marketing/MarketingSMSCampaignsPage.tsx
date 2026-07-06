/**
 * MarketingSMSCampaignsPage — CSV import + SMS broadcast (Nivra dark theme).
 * Backend: sms_campaigns + marketing-send-sms edge function.
 *
 * Failure handling:
 * - Pre-validates phone format (E.164) and Quebec/Canada area code → skipped, not "failed"
 * - Edge function returns structured { reason } for grouping
 * - Grouped summary + CSV export + retry of carrier failures
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload, Send, Users, MessageSquare, AlertTriangle, FileSpreadsheet, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import MarketingNav from "./MarketingNav";

type Campaign = {
  id: string;
  message: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
};

// Quebec + nearby Canadian area codes (fallback list — accept all Canadian if number is valid)
const QC_AREA_CODES = new Set([
  "514", "438", "450", "579", "819", "873", "418", "367", "581",
  // Other CA codes we still allow to send to
  "416", "647", "437", "905", "289", "365", "613", "343", "705", "249", "807",
  "204", "431", "306", "639", "403", "587", "780", "825", "236", "604", "778", "672", "250",
  "902", "782", "506", "709", "867",
]);

type SkipReason = "format_invalid" | "out_of_zone";
type FailReason = "no_credits" | "auth_error" | "rate_limited" | "invalid_recipient" | "carrier_blocked" | "openphone_server_error" | "openphone_error" | "network_error";

const REASON_LABELS: Record<SkipReason | FailReason, string> = {
  format_invalid: "Format invalide",
  out_of_zone: "Hors zone Canada",
  no_credits: "Crédits OpenPhone épuisés",
  auth_error: "Authentification OpenPhone",
  rate_limited: "Limite de débit atteinte",
  invalid_recipient: "Numéro refusé par OpenPhone",
  carrier_blocked: "Bloqué par le transporteur",
  openphone_server_error: "Erreur serveur OpenPhone",
  openphone_error: "Erreur OpenPhone",
  network_error: "Erreur réseau",
};

function normalizeE164(raw: string): { e164: string | null; reason?: SkipReason } {
  if (!raw) return { e164: null, reason: "format_invalid" };
  const trimmed = String(raw).trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (digits.length < 10) return { e164: null, reason: "format_invalid" };
    return { e164: `+${digits}` };
  }
  if (digits.length === 10) return { e164: `+1${digits}` };
  if (digits.length === 11 && digits.startsWith("1")) return { e164: `+${digits}` };
  return { e164: null, reason: "format_invalid" };
}

function isCanadianAreaCode(e164: string): boolean {
  // +1XXX...
  if (!e164.startsWith("+1") || e164.length < 5) return false;
  const ac = e164.substring(2, 5);
  return QC_AREA_CODES.has(ac);
}

function parseCSV(text: string): string[] {
  return text
    .split(/[\n,;]/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => /^\+?[0-9 .()-]{7,}$/.test(s))
    .map((s) => s.replace(/[^\d+]/g, ""))
    .filter(Boolean);
}

type ResultEntry = {
  phone: string;
  status: "sent" | "skipped" | "failed";
  reason?: SkipReason | FailReason;
  providerMessage?: string | null;
};

export default function MarketingSMSCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0, skipped: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [lastMessage, setLastMessage] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("sms_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setCampaigns((data || []) as Campaign[]);
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const numbers = parseCSV(text);
    setRecipients(numbers);
    setFileName(file.name);
    toast.success(`${numbers.length} numéros importés`);
  };

  const onFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await handleFile(f);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) await handleFile(f);
  };

  /**
   * Core send loop. Accepts a list of phones + message and produces a results array.
   * Used by both the initial send and the retry-failed action.
   */
  const runSend = async (phones: string[], msg: string): Promise<ResultEntry[]> => {
    const out: ResultEntry[] = [];
    let sent = 0, failed = 0, skipped = 0;
    setProgress({ done: 0, total: phones.length, failed: 0, skipped: 0 });

    for (const raw of phones) {
      // 1) Local format check — skip, don't count as failure
      const { e164, reason: fmtReason } = normalizeE164(raw);
      if (!e164) {
        skipped++;
        out.push({ phone: raw, status: "skipped", reason: fmtReason });
        setProgress({ done: out.length, total: phones.length, failed, skipped });
        continue;
      }
      // 2) Out-of-zone check
      if (!isCanadianAreaCode(e164)) {
        skipped++;
        out.push({ phone: e164, status: "skipped", reason: "out_of_zone" });
        setProgress({ done: out.length, total: phones.length, failed, skipped });
        continue;
      }
      // 3) Send via edge function
      try {
        const { data, error } = await supabase.functions.invoke("marketing-send-sms", {
          body: { to: e164, message: msg },
        });
        const payload = (data as any) || {};
        if (error) {
          failed++;
          out.push({ phone: e164, status: "failed", reason: "network_error", providerMessage: error.message });
        } else if (payload.success === false) {
          failed++;
          out.push({
            phone: e164,
            status: "failed",
            reason: (payload.reason as FailReason) || "openphone_error",
            providerMessage: payload.provider_message || null,
          });
        } else if (payload.success === true || payload.message_id) {
          sent++;
          out.push({ phone: e164, status: "sent" });
        } else {
          failed++;
          out.push({ phone: e164, status: "failed", reason: "openphone_error" });
        }
      } catch (e) {
        failed++;
        out.push({ phone: e164, status: "failed", reason: "network_error", providerMessage: (e as Error).message });
      }
      setProgress({ done: out.length, total: phones.length, failed, skipped });
      await new Promise((r) => setTimeout(r, 350));
    }
    return out;
  };

  const send = async () => {
    setConfirmOpen(false);
    setSending(true);
    setResults([]);
    setLastMessage(message);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: campaign } = await supabase.from("sms_campaigns").insert({
      message, recipients_count: recipients.length, status: "sending",
      sent_by_email: user?.email || null,
    }).select().single();

    const out = await runSend(recipients, message);
    const sent = out.filter((r) => r.status === "sent").length;
    const failed = out.filter((r) => r.status === "failed").length;

    if (campaign?.id) {
      await supabase.from("sms_campaigns").update({
        sent_count: sent, failed_count: failed, status: "sent",
      }).eq("id", campaign.id);
    }

    setResults(out);
    setSending(false);
    toast.success(`Campagne terminée: ${sent} envoyés, ${failed} échecs, ${out.length - sent - failed} ignorés`);
    setMessage(""); setRecipients([]); setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const retryFailed = async () => {
    const phones = results.filter((r) => r.status === "failed").map((r) => r.phone);
    if (!phones.length) return;
    setSending(true);
    const out = await runSend(phones, lastMessage);
    // Merge: replace failed entries with new results
    const merged = [...results.filter((r) => r.status !== "failed"), ...out];
    setResults(merged);
    setSending(false);
    const newSent = out.filter((r) => r.status === "sent").length;
    toast.success(`Réessai: ${newSent}/${phones.length} envoyés`);
  };

  const exportFailedCSV = () => {
    const failed = results.filter((r) => r.status === "failed" || r.status === "skipped");
    if (!failed.length) {
      toast.info("Aucun échec à exporter");
      return;
    }
    const rows = [
      ["phone", "status", "reason", "provider_message"],
      ...failed.map((r) => [r.phone, r.status, r.reason || "", r.providerMessage || ""]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sms-echecs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group results by reason for the summary
  const summary = (() => {
    const sent = results.filter((r) => r.status === "sent").length;
    const groups: Record<string, number> = {};
    for (const r of results) {
      if (r.status === "sent") continue;
      const key = r.reason || "openphone_error";
      groups[key] = (groups[key] || 0) + 1;
    }
    return { sent, total: results.length, groups };
  })();

  const charCount = message.length;
  const charColor = charCount > 160 ? "#EF4444" : charCount > 140 ? "#F59E0B" : "#888";
  const estimatedSec = Math.ceil(recipients.length * 0.35);

  return (
    <MKPage title="Campagnes SMS" subtitle="Importez une liste de numéros et envoyez un SMS à tous via OpenPhone">
      <MarketingNav />
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Composer */}
        <MKCard>
          <MKCardHeader title="Nouvelle campagne" />
          <div className="p-5 space-y-4">
            {/* Drop zone */}
            <div>
              <label className="text-[10px] uppercase tracking-[2px] text-[#888] mb-2 block">
                Liste de numéros
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "rounded-[10px] border-2 border-dashed p-6 text-center cursor-pointer transition",
                  dragOver ? "border-[#7C3AED] bg-[#7C3AED11]" : "border-[#1E1E2E] hover:border-[#7C3AED66]"
                )}
              >
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-[#7C3AED]" />
                {fileName ? (
                  <>
                    <div className="text-sm text-white font-medium">{fileName}</div>
                    <div className="text-xs text-[#10B981] mt-1 inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {recipients.length} contacts importés
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-white">Glissez votre fichier CSV ici</div>
                    <div className="text-xs text-[#888] mt-1">ou cliquez pour sélectionner</div>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFileInput} className="hidden" />
              </div>
              <p className="text-[11px] text-[#888] mt-1.5">
                Un numéro par ligne ou séparés par virgule. E.164 recommandé (+15145551234)
              </p>
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-[2px] text-[#888]">Message</label>
                <span className="text-xs tabular-nums" style={{ color: charColor }}>
                  {charCount}/160
                </span>
              </div>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={320}
                placeholder="Salut! Profitez de notre offre Internet sans contrat…"
                className="bg-[#1E1E2E] border-[#1E1E2E] text-white placeholder:text-[#888] rounded-[10px] resize-none"
              />
            </div>

            {/* Sending progress */}
            {sending && (
              <div className="rounded-[10px] border border-[#1E1E2E] p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white">Envoi en cours…</span>
                  <span className="text-[#888] tabular-nums">{progress.done}/{progress.total}</span>
                </div>
                <div className="h-2 rounded-full bg-[#1E1E2E] overflow-hidden">
                  <div
                    className="h-full transition-all rounded-full"
                    style={{
                      width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                      background: "#7C3AED",
                    }}
                  />
                </div>
                {(progress.failed > 0 || progress.skipped > 0) && (
                  <div className="text-xs text-[#888] inline-flex items-center gap-3">
                    {progress.failed > 0 && (
                      <span className="text-[#EF4444] inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {progress.failed} échecs
                      </span>
                    )}
                    {progress.skipped > 0 && (
                      <span className="text-[#F59E0B]">⊘ {progress.skipped} ignorés</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Grouped result summary */}
            {!sending && results.length > 0 && (
              <div className="rounded-[10px] border border-[#1E1E2E] p-4 space-y-3">
                <div className="text-sm font-semibold text-white">Résultats de la campagne</div>
                <div className="text-xs text-[#10B981]">✅ {summary.sent} envoyés avec succès</div>
                {Object.keys(summary.groups).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-[#EF4444]">
                      ❌ {summary.total - summary.sent} non envoyés:
                    </div>
                    <ul className="text-xs text-[#CCC] pl-4 space-y-0.5">
                      {Object.entries(summary.groups)
                        .sort((a, b) => b[1] - a[1])
                        .map(([reason, count]) => (
                          <li key={reason}>
                            <span className="tabular-nums font-medium">{count}</span>{" "}
                            {REASON_LABELS[reason as FailReason | SkipReason] || reason}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={retryFailed}
                    disabled={!results.some((r) => r.status === "failed")}
                    className="rounded-[10px] text-white border-0 h-9 text-xs"
                    style={{ background: "#7C3AED" }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1.5" /> Réessayer les échecs
                  </Button>
                  <Button
                    onClick={exportFailedCSV}
                    variant="outline"
                    className="rounded-[10px] border-[#1E1E2E] bg-transparent text-white hover:bg-[#1E1E2E] h-9 text-xs"
                  >
                    <Download className="h-3 w-3 mr-1.5" /> Exporter CSV
                  </Button>
                </div>
              </div>
            )}

            {confirmOpen ? (
              <div className="rounded-[10px] border border-border bg-secondary/40 p-4 space-y-3">
                <div className="text-sm font-black text-foreground">Confirmer l'envoi</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-[10px] bg-card p-3"><div className="text-muted-foreground">Contacts</div><div className="font-black tabular-nums text-foreground">{recipients.length}</div></div>
                  <div className="rounded-[10px] bg-card p-3"><div className="text-muted-foreground">Caractères</div><div className="font-black tabular-nums text-foreground">{charCount}</div></div>
                  <div className="rounded-[10px] bg-card p-3"><div className="text-muted-foreground">Temps</div><div className="font-black tabular-nums text-foreground">~{estimatedSec}s</div></div>
                </div>
                <div className="rounded-[10px] border border-border bg-card p-3 text-xs text-foreground whitespace-pre-wrap">{message}</div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmOpen(false)}>Annuler</Button>
                  <Button onClick={send}><Send className="h-4 w-4 mr-1.5" /> Confirmer l'envoi</Button>
                </DialogFooter>
              </div>
            ) : (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={sending || !message.trim() || recipients.length === 0}
                className="w-full rounded-[10px] text-white border-0 h-11 font-semibold"
                style={{ background: sending ? "#1E1E2E" : "#7C3AED" }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Envoyer à {recipients.length} contacts
              </Button>
            )}
          </div>
        </MKCard>

        {/* History */}
        <MKCard>
          <MKCardHeader title={`Historique · ${campaigns.length}`} />
          <div className="max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-[#888]">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement…
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-sm text-[#888] text-center py-12">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Aucune campagne
              </div>
            ) : (
              <div className="divide-y divide-[#1E1E2E]">
                {campaigns.map((c) => (
                  <div key={c.id} className="p-4 hover:bg-[#1A1A28] transition">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm text-white line-clamp-2 flex-1">{c.message}</p>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider shrink-0"
                        style={
                          c.status === "sent"
                            ? { background: "#10B98122", color: "#10B981" }
                            : c.status === "sending"
                              ? { background: "#F59E0B22", color: "#F59E0B" }
                              : { background: "#1E1E2E", color: "#888" }
                        }
                      >
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#888]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" /> {c.recipients_count}
                      </span>
                      <span className="text-[#10B981]">✓ {c.sent_count} envoyés</span>
                      {c.failed_count > 0 && <span className="text-[#EF4444]">✗ {c.failed_count} échecs</span>}
                      <span className="ml-auto">{format(new Date(c.created_at), "dd/MM HH:mm")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </MKCard>
      </div>

    </MKPage>
  );
}
