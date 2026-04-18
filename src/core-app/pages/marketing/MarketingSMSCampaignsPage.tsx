/**
 * MarketingSMSCampaignsPage — CSV import + SMS broadcast (Nivra dark theme).
 * Backend logic preserved: sms_campaigns table + marketing-send-sms edge function.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, Send, Users, MessageSquare, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Campaign = {
  id: string;
  message: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
};

function parseCSV(text: string): string[] {
  return text
    .split(/[\n,;]/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter((s) => /^\+?[0-9 .()-]{7,}$/.test(s))
    .map((s) => s.replace(/[^\d+]/g, ""))
    .filter(Boolean);
}

export default function MarketingSMSCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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

  const send = async () => {
    setConfirmOpen(false);
    setSending(true);
    setProgress({ done: 0, total: recipients.length, failed: 0 });

    const { data: { user } } = await supabase.auth.getUser();
    const { data: campaign } = await supabase.from("sms_campaigns").insert({
      message, recipients_count: recipients.length, status: "sending",
      sent_by_email: user?.email || null,
    }).select().single();

    let sent = 0, failed = 0;
    for (const to of recipients) {
      try {
        const { data, error } = await supabase.functions.invoke("marketing-send-sms", { body: { to, message } });
        if (error || (data as any)?.error) failed++; else sent++;
      } catch { failed++; }
      setProgress({ done: sent + failed, total: recipients.length, failed });
      await new Promise((r) => setTimeout(r, 350));
    }

    if (campaign?.id) {
      await supabase.from("sms_campaigns").update({
        sent_count: sent, failed_count: failed, status: "sent",
      }).eq("id", campaign.id);
    }

    setSending(false);
    toast.success(`Campagne terminée: ${sent} envoyés, ${failed} échecs`);
    setMessage(""); setRecipients([]); setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const charCount = message.length;
  const charColor = charCount > 160 ? "#EF4444" : charCount > 140 ? "#F59E0B" : "#888";
  const estimatedSec = Math.ceil(recipients.length * 0.35);

  return (
    <MKPage title="Campagnes SMS" subtitle="Importez une liste de numéros et envoyez un SMS à tous via OpenPhone">
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
                {progress.failed > 0 && (
                  <div className="text-xs text-[#EF4444] inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {progress.failed} échecs
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={sending || !message.trim() || recipients.length === 0}
              className="w-full rounded-[10px] text-white border-0 h-11 font-semibold"
              style={{ background: sending ? "#1E1E2E" : "#7C3AED" }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer à {recipients.length} contacts
            </Button>
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

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-[#0D0D1A] border-[#1E1E2E] text-white rounded-[10px]">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmer l'envoi</DialogTitle>
            <DialogDescription className="text-[#888]">
              Cette action enverra le SMS à tous les contacts importés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-[10px] bg-[#1E1E2E] p-3 text-sm">
              <div className="flex justify-between"><span className="text-[#888]">Contacts</span><span className="font-semibold tabular-nums">{recipients.length}</span></div>
              <div className="flex justify-between mt-1"><span className="text-[#888]">Caractères</span><span className="font-semibold tabular-nums">{charCount}</span></div>
              <div className="flex justify-between mt-1"><span className="text-[#888]">Temps estimé</span><span className="font-semibold tabular-nums">~{estimatedSec}s</span></div>
            </div>
            <div className="rounded-[10px] bg-[#0D0D1A] border border-[#1E1E2E] p-3 text-xs text-white whitespace-pre-wrap">
              {message}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}
              className="rounded-[10px] border-[#1E1E2E] bg-transparent text-white hover:bg-[#1E1E2E]">
              Annuler
            </Button>
            <Button onClick={send}
              className="rounded-[10px] text-white border-0"
              style={{ background: "#7C3AED" }}>
              <Send className="h-4 w-4 mr-1.5" /> Confirmer l'envoi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MKPage>
  );
}
