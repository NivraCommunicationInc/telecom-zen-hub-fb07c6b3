/**
 * KycStep — full KYC review panel reading identity_verification_sessions.
 * UI only; logic preserved (uses proc.* mutations when present, otherwise
 * falls back to direct supabase + proc.updateOrder).
 */
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle2, XCircle, FileSearch, RefreshCw, ShieldCheck, ShieldAlert,
  FileText, Camera, User, Mail, Copy, Check, Clock, History,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props { proc: any; }

const DOC_BUCKET = "id-documents";

type StatusKey = "created" | "submitted" | "manual_review" | "approved" | "rejected" | "pending_docs" | "unknown";

const STATUS_BANNER: Record<StatusKey, { cls: string; label: string; Icon: any }> = {
  created:       { cls: "bg-blue-950/50 border-blue-700/50 text-blue-300",   label: "En attente de soumission du client", Icon: Clock },
  submitted:     { cls: "bg-amber-950/50 border-amber-700/50 text-amber-300", label: "Document soumis — en attente de révision", Icon: ShieldAlert },
  manual_review: { cls: "bg-amber-950/50 border-amber-700/50 text-amber-300", label: "En revue manuelle",                   Icon: FileSearch },
  pending_docs:  { cls: "bg-amber-950/50 border-amber-700/50 text-amber-300", label: "Documents additionnels requis",       Icon: ShieldAlert },
  approved:      { cls: "bg-green-950/50 border-green-700/50 text-green-300", label: "Identité vérifiée et approuvée",       Icon: ShieldCheck },
  rejected:      { cls: "bg-red-950/50 border-red-700/50 text-red-300",       label: "Document rejeté",                      Icon: XCircle },
  unknown:       { cls: "bg-slate-800/50 border-slate-700/50 text-slate-300", label: "Statut inconnu",                       Icon: ShieldAlert },
};

export function KycStep({ proc }: Props) {
  const { order, kycSession, profile } = proc;
  const [reviewNote, setReviewNote] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [linkCopied, setLinkCopied] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);

  const sessionId = kycSession?.id;
  const rawStatus = (kycSession?.status || "unknown") as string;
  const statusKey: StatusKey = (STATUS_BANNER as any)[rawStatus] ? (rawStatus as StatusKey) : "unknown";
  const sc = STATUS_BANNER[statusKey];
  const StatusIcon = sc.Icon;

  const frontPath = kycSession?.document_front_path;
  const backPath = kycSession?.document_back_path;
  const selfiePath = kycSession?.selfie_path;
  const hasDocuments = !!(frontPath || backPath || selfiePath);

  const extracted = (kycSession?.extracted_fields || {}) as Record<string, any>;
  const matchResult = (kycSession?.match_result || null) as Record<string, any> | null;
  const overallScore = matchResult?.overall_score != null ? Math.max(0, Math.min(100, Number(matchResult.overall_score))) : null;

  // Pre-fill email
  useEffect(() => {
    if (!emailValue) setEmailValue(profile?.email || order?.client_email || "");
  }, [profile?.email, order?.client_email]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate signed URLs for documents
  useEffect(() => {
    let cancelled = false;
    const paths: Array<[string, string]> = [];
    if (frontPath) paths.push(["front", frontPath]);
    if (backPath) paths.push(["back", backPath]);
    if (selfiePath) paths.push(["selfie", selfiePath]);
    if (paths.length === 0) return;
    (async () => {
      const next: Record<string, string> = {};
      for (const [key, path] of paths) {
        try {
          const { data } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(path, 600);
          if (data?.signedUrl) next[key] = data.signedUrl;
        } catch { /* ignore */ }
      }
      if (!cancelled) setSignedUrls(next);
    })();
    return () => { cancelled = true; };
  }, [frontPath, backPath, selfiePath]);

  /* ── Mutations: prefer proc.* if present, else fallback to inline ── */
  const hasApproveFn = typeof proc.approveKyc === "function";
  const hasRejectFn = typeof proc.rejectKyc === "function";
  const hasResubmitFn = typeof proc.requestKycResubmission === "function";
  const hasRequestLinkFn = typeof proc.requestIdentityVerification === "function";

  const handleApprove = async () => {
    setApproving(true);
    try {
      if (hasApproveFn) {
        await proc.approveKyc({ reason: reviewNote });
      } else {
        if (sessionId) {
          await supabase.from("identity_verification_sessions")
            .update({ status: "approved", reviewed_at: new Date().toISOString(), review_reason: reviewNote || null })
            .eq("id", sessionId);
        }
        await proc.updateOrder({
          id_verification_status: "approved",
          id_verified_at: new Date().toISOString(),
          id_verification_notes: reviewNote || undefined,
        });
        toast.success("KYC approuvé");
      }
      setReviewNote("");
    } catch (e: any) {
      // approveKyc already toasts on error
      if (!hasApproveFn) toast.error(e?.message || "Échec de l'approbation");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!reviewNote.trim()) {
      toast.error("Une raison est requise pour rejeter");
      return;
    }
    setRejecting(true);
    try {
      if (hasRejectFn) {
        await proc.rejectKyc({ reason: reviewNote });
      } else {
        if (sessionId) {
          await supabase.from("identity_verification_sessions")
            .update({ status: "rejected", reviewed_at: new Date().toISOString(), review_reason: reviewNote })
            .eq("id", sessionId);
        }
        await proc.updateOrder({
          id_verification_status: "rejected",
          id_verification_notes: reviewNote,
        });
        toast.warning("KYC rejeté");
      }
      setReviewNote("");
    } catch (e: any) {
      if (!hasRejectFn) toast.error(e?.message || "Échec du rejet");
    } finally {
      setRejecting(false);
    }
  };

  const handleResubmit = async () => {
    setResubmitting(true);
    try {
      if (hasResubmitFn) {
        await proc.requestKycResubmission({ reason: reviewNote });
      } else {
        if (sessionId) {
          await supabase.from("identity_verification_sessions")
            .update({ status: "pending_docs", review_reason: reviewNote || "Documents additionnels requis" })
            .eq("id", sessionId);
        }
        await proc.updateOrder({
          id_verification_status: "pending_docs",
          id_verification_notes: reviewNote || "Documents additionnels requis",
        });
        toast.info("Resoumission demandée");
      }
    } catch (e: any) {
      if (!hasResubmitFn) toast.error(e?.message || "Échec de la demande");
    } finally {
      setResubmitting(false);
    }
  };

  const handleSendLink = async () => {
    if (!hasRequestLinkFn) {
      toast.error("Envoi automatique non disponible");
      return;
    }
    setSendingLink(true);
    try {
      await proc.requestIdentityVerification({ email: emailValue });
      toast.success("Lien de vérification envoyé");
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'envoi");
    } finally {
      setSendingLink(false);
    }
  };

  const handleCopyLink = async () => {
    const token = kycSession?.public_token;
    if (!token) {
      toast.error("Aucun lien public disponible");
      return;
    }
    try {
      const url = `${window.location.origin}/verify-id/${token}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const extractedKeysShown = useMemo(() => ([
    ["first_name", "Prénom"],
    ["last_name", "Nom"],
    ["date_of_birth", "Date de naissance"],
    ["document_number", "N° document"],
    ["expiry_date", "Date d'expiration"],
    ["address", "Adresse"],
    ["nationality", "Nationalité"],
  ] as const), []);

  return (
    <TooltipProvider>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Vérification KYC</div>

        {/* SECTION 1 — Status banner */}
        <div className={`rounded-lg border ${sc.cls} px-4 py-3 mb-4 flex items-center gap-3`}>
          <div className="h-10 w-10 rounded-full bg-black/30 flex items-center justify-center shrink-0">
            <StatusIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{sc.label}</p>
            {kycSession?.submitted_at && (
              <p className="text-xs opacity-70 mt-0.5">
                Soumis le {new Date(kycSession.submitted_at).toLocaleString("fr-CA")}
              </p>
            )}
          </div>
          {(kycSession?.case_number || kycSession?.reference_code) && (
            <div className="text-right shrink-0">
              {kycSession?.case_number && (
                <p className="text-[10px] uppercase tracking-wider opacity-60">Case</p>
              )}
              {kycSession?.case_number && (
                <p className="text-xs font-mono font-medium">{kycSession.case_number}</p>
              )}
              {kycSession?.reference_code && (
                <p className="text-[10px] font-mono opacity-70 mt-0.5">Ref · {kycSession.reference_code}</p>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2 — Document viewer */}
        {frontPath && (
          <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
              <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Documents et données extraites</h4>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-4">
              {/* Left: photos */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Photos soumises</p>
                <DocImage label="Recto" url={signedUrls.front} icon={FileText} />
                {backPath && <DocImage label="Verso" url={signedUrls.back} icon={FileText} />}
                {selfiePath && <DocImage label="Selfie" url={signedUrls.selfie} icon={Camera} />}
              </div>

              {/* Right: extracted + match */}
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Champs extraits (OCR)</p>
                <div className="bg-[#0d1421] rounded-lg p-3 grid grid-cols-1 gap-1.5 text-xs">
                  {extractedKeysShown.filter(([k]) => extracted[k] != null && extracted[k] !== "").length === 0 ? (
                    <span className="text-slate-500 italic">Aucune donnée extraite</span>
                  ) : extractedKeysShown.map(([k, label]) => {
                    const val = extracted[k];
                    if (val == null || val === "") return null;
                    return (
                      <div key={k} className="flex justify-between gap-3">
                        <span className="text-slate-500">{label}</span>
                        <span className="text-slate-100 font-medium text-right truncate">{String(val)}</span>
                      </div>
                    );
                  })}
                </div>

                {matchResult && (
                  <div className="bg-[#0d1421] rounded-lg p-3 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">Résultat de correspondance</p>
                    {overallScore != null && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Score global</span>
                          <span className={`font-bold ${overallScore >= 80 ? "text-green-300" : overallScore >= 50 ? "text-amber-300" : "text-red-300"}`}>
                            {Math.round(overallScore)}%
                          </span>
                        </div>
                        <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${overallScore >= 80 ? "bg-green-500" : overallScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${overallScore}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <MatchBadge label="Nom" value={matchResult.name_match} />
                      <MatchBadge label="Naissance" value={matchResult.dob_match} />
                      <MatchBadge label="Adresse" value={matchResult.address_match} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!frontPath && (
          <div className="bg-[#111827] border border-slate-700/50 rounded-xl p-6 mb-4 text-center">
            <ShieldAlert className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Aucun document soumis</p>
          </div>
        )}

        {/* SECTION 3 — Document info grid 2x2 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <InfoCell label="Type de document" value={formatDocType(kycSession?.id_type || kycSession?.document_type)} />
          <InfoCell label="Province" value={kycSession?.id_province || "—"} />
          <InfoCell label="Politique KYC" value={order?.kyc_policy || "—"} />
          <InfoCell
            label="Tentatives"
            value={`${kycSession?.submission_attempts ?? 0} / ${kycSession?.max_attempts ?? 3}`}
          />
        </div>

        {/* SECTION 4 — Review actions (only when submitted) */}
        {(rawStatus === "submitted" || rawStatus === "manual_review") && (
          <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
              <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Révision administrative</h4>
            </div>
            <div className="p-4">
              <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">
                Raison / note de révision
              </Label>
              <Textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Justification de la décision (requise pour rejeter)…"
                className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg min-h-[56px] mb-3"
              />
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  available={hasApproveFn || true /* fallback supported */}
                  onClick={handleApprove}
                  disabled={proc.isUpdating}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  icon={CheckCircle2}
                >
                  Approuver
                </ActionButton>
                <ActionButton
                  available={hasRejectFn || true}
                  onClick={handleReject}
                  disabled={proc.isUpdating || !reviewNote.trim()}
                  className="bg-red-700 hover:bg-red-800 text-white"
                  icon={XCircle}
                >
                  Rejeter
                </ActionButton>
                <ActionButton
                  available={hasResubmitFn || true}
                  onClick={handleResubmit}
                  disabled={proc.isUpdating}
                  ghost
                  icon={RefreshCw}
                >
                  Demander resoumission
                </ActionButton>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5 — Send verification link (always visible) */}
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Lien de vérification
            </h4>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Courriel du client</Label>
              <Input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="client@exemple.com"
                className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                available={hasRequestLinkFn}
                onClick={handleSendLink}
                disabled={sendingLink || !emailValue}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                icon={Mail}
                unavailableReason="Mutation requestIdentityVerification non disponible"
              >
                {sendingLink ? "Envoi…" : "Envoyer lien de vérification"}
              </ActionButton>
              <Button
                size="sm"
                onClick={handleCopyLink}
                disabled={!kycSession?.public_token}
                className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                {linkCopied ? <Check className="w-3 h-3 mr-1 text-green-400" /> : <Copy className="w-3 h-3 mr-1" />}
                {linkCopied ? "Copié!" : "Copier lien public"}
              </Button>
            </div>
            {!kycSession?.public_token && (
              <p className="text-[11px] text-slate-500">Aucun jeton public disponible — générez un lien d'abord.</p>
            )}
          </div>
        </div>

        {/* SECTION 6 — Attempt history */}
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Historique
            </h4>
          </div>
          <div className="p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Tentatives de soumission</span>
              <span className="text-slate-100 font-medium">
                {kycSession?.submission_attempts ?? 0} / {kycSession?.max_attempts ?? 3}
              </span>
            </div>
            {kycSession?.created_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">Session créée le</span>
                <span className="text-slate-100">{new Date(kycSession.created_at).toLocaleString("fr-CA")}</span>
              </div>
            )}
            {kycSession?.expires_at && (
              <div className="flex justify-between">
                <span className="text-slate-500">Expire le</span>
                <span className="text-slate-100">{new Date(kycSession.expires_at).toLocaleString("fr-CA")}</span>
              </div>
            )}
            {kycSession?.reviewed_at && (
              <>
                <div className="border-t border-slate-700/50 my-2" />
                <div className="flex justify-between">
                  <span className="text-slate-500">Révisé le</span>
                  <span className="text-slate-100">{new Date(kycSession.reviewed_at).toLocaleString("fr-CA")}</span>
                </div>
                {kycSession?.reviewed_by && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Révisé par</span>
                    <span className="text-slate-100 font-mono">{String(kycSession.reviewed_by).slice(0, 8)}…</span>
                  </div>
                )}
                {kycSession?.review_reason && (
                  <div className="pt-1">
                    <p className="text-slate-500 mb-1">Raison</p>
                    <p className="text-slate-200 bg-[#0d1421] rounded p-2">{kycSession.review_reason}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ── Subcomponents ── */

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d1421] rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-100 font-medium">{value}</p>
    </div>
  );
}

function DocImage({ label, url, icon: Icon }: { label: string; url?: string; icon: any }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={label}
            className="rounded-lg border border-slate-700 w-full object-cover max-h-48 cursor-pointer hover:opacity-90 transition-opacity"
          />
        </a>
      ) : (
        <div className="rounded-lg border border-slate-700 bg-[#0d1421] w-full h-32 flex items-center justify-center">
          <span className="text-[11px] text-slate-500">Chargement…</span>
        </div>
      )}
    </div>
  );
}

function MatchBadge({ label, value }: { label: string; value: any }) {
  let cls = "bg-slate-800 text-slate-400";
  let txt = "Inconnu";
  if (value === true || value === "match" || value === "matched") {
    cls = "bg-green-900/50 text-green-300";
    txt = "Match";
  } else if (value === false || value === "mismatch" || value === "no_match") {
    cls = "bg-red-900/50 text-red-300";
    txt = "Mismatch";
  }
  return (
    <span className={`inline-flex text-[10px] font-medium px-2 py-1 rounded-full ${cls}`}>
      {label}: {txt}
    </span>
  );
}

function ActionButton({
  available, onClick, disabled, className, ghost, icon: Icon, children, unavailableReason,
}: {
  available: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  ghost?: boolean;
  icon?: any;
  children: React.ReactNode;
  unavailableReason?: string;
}) {
  const baseGhost = "bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800";
  const btn = (
    <Button
      size="sm"
      onClick={onClick}
      disabled={disabled || !available}
      className={`text-sm ${ghost ? baseGhost : className || ""}`}
    >
      {Icon && <Icon className="w-3 h-3 mr-1" />} {children}
    </Button>
  );
  if (!available) {
    return (
      <Tooltip>
        <TooltipTrigger asChild><span>{btn}</span></TooltipTrigger>
        <TooltipContent>{unavailableReason || "Non disponible"}</TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}

function formatDocType(type: string | null | undefined): string {
  if (!type) return "—";
  const map: Record<string, string> = {
    drivers_license: "Permis de conduire",
    passport: "Passeport",
    health_card: "Carte santé",
    national_id: "Carte d'identité",
    residence_permit: "Permis de résidence",
  };
  return map[type] || String(type).replace(/_/g, " ");
}
