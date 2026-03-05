/**
 * WorkbenchKYCTab - KYC session status, documents with signed URL thumbnails, approve/reject via RPC
 */
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Shield, CheckCircle, XCircle, Clock, FileText, ImageIcon, AlertTriangle, Loader2 } from "lucide-react";
import { canPerformAction } from "@/lib/workbenchRoles";
import { adminClient } from "@/integrations/supabase/adminClient";
import { toast } from "sonner";

interface Props {
  order: any;
  kycSession: any;
  role: string | null;
  onAction: (action: string) => void;
}

const KYC_STATUS: Record<string, { color: string; label: string; icon: any }> = {
  created: { color: "bg-muted text-muted-foreground", label: "Créé", icon: Clock },
  submitted: { color: "bg-blue-500/20 text-blue-400", label: "Soumis", icon: FileText },
  manual_review: { color: "bg-purple-500/20 text-purple-400", label: "En révision manuelle", icon: Shield },
  in_review: { color: "bg-purple-500/20 text-purple-400", label: "En révision", icon: Shield },
  pending_docs: { color: "bg-amber-500/20 text-amber-400", label: "Documents manquants", icon: Clock },
  approved: { color: "bg-emerald-500/20 text-emerald-400", label: "Approuvé", icon: CheckCircle },
  rejected: { color: "bg-red-500/20 text-red-400", label: "Rejeté", icon: XCircle },
};

interface DocInfo {
  doc_type: string;
  storage_bucket: string;
  object_path: string;
  created_at: string;
  signedUrl?: string;
  error?: string;
}

export function WorkbenchKYCTab({ order, kycSession, role, onAction }: Props) {
  const idStatus = order?.id_verification_status || "pending";
  const [documents, setDocuments] = useState<DocInfo[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  // FIX #3: Load documents via RPC + generate signed URLs
  useEffect(() => {
    if (!kycSession?.id) return;
    
    const loadDocs = async () => {
      setDocsLoading(true);
      try {
        const { data: docsMeta, error } = await adminClient.rpc("get_kyc_document_urls", {
          p_session_id: kycSession.id,
        });

        if (error) {
          console.error("[KYC Docs] RPC error:", error);
          setDocuments([]);
          return;
        }

        const rawDocs = Array.isArray(docsMeta) ? docsMeta : [];
        const docs: DocInfo[] = rawDocs.map((d: any) => ({
          doc_type: d.doc_type || "",
          storage_bucket: d.storage_bucket || "id-documents",
          object_path: d.object_path || "",
          created_at: d.created_at || "",
        }));
        
        // Generate signed URLs for each document
        const docsWithUrls = await Promise.all(
          docs.map(async (doc) => {
            try {
              const { data } = await adminClient.storage
                .from(doc.storage_bucket)
                .createSignedUrl(doc.object_path, 300); // 5 min
              return { ...doc, signedUrl: data?.signedUrl || undefined };
            } catch (err) {
              return { ...doc, error: "Impossible de générer l'URL signée" };
            }
          })
        );
        
        setDocuments(docsWithUrls);
      } catch (err) {
        console.error("[KYC Docs] Failed to load:", err);
      } finally {
        setDocsLoading(false);
      }
    };

    loadDocs();
  }, [kycSession?.id]);

  // FIX #4: Approve/reject via RPC
  const handleDecision = async (decision: "approved" | "rejected") => {
    if (!kycSession?.id) return;
    setDeciding(true);
    try {
      const { data, error } = await adminClient.rpc("approve_kyc_session", {
        p_session_id: kycSession.id,
        p_decision: decision,
        p_note: decisionNote || null,
      });

      if (error) {
        console.error("[KYC Decision] RPC error:", error);
        toast.error(`Échec: ${error.message}`);
        return;
      }

      toast.success(decision === "approved" ? "KYC approuvé ✓" : "KYC rejeté");
      setDecisionNote("");
      // Trigger parent refresh
      onAction(decision === "approved" ? "approve_kyc" : "reject_kyc");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la décision KYC");
    } finally {
      setDeciding(false);
    }
  };

  const DOC_LABELS: Record<string, string> = {
    front: "Recto",
    back: "Verso",
    selfie: "Selfie",
  };

  return (
    <div className="space-y-4">
      {/* ID Verification Status on Order */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Vérification d'identité (commande)</p>
              <p className="text-white mt-1">{idStatus}</p>
            </div>
            <Badge className={
              idStatus === "verified" ? "bg-emerald-500/20 text-emerald-400" :
              idStatus === "rejected" ? "bg-red-500/20 text-red-400" :
              "bg-amber-500/20 text-amber-400"
            }>
              {idStatus === "verified" ? "Vérifié" : idStatus === "rejected" ? "Rejeté" : "En attente"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* KYC Session */}
      {kycSession ? (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Session KYC</p>
                <p className="font-mono text-sm text-white mt-1">{kycSession.case_number || kycSession.id?.slice(0, 8)}</p>
              </div>
              {(() => {
                const cfg = KYC_STATUS[kycSession.status] || KYC_STATUS.created;
                return <Badge className={cfg.color}>{cfg.label}</Badge>;
              })()}
            </div>

            {/* Documents soumis — FIX #3: signed URL thumbnails */}
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">Documents soumis</p>
              {docsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Chargement...
                </div>
              ) : documents.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {documents.map((doc, i) => (
                    <div key={i} className="rounded bg-slate-700/30 p-2 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{DOC_LABELS[doc.doc_type] || doc.doc_type}</p>
                      {doc.signedUrl ? (
                        <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={doc.signedUrl}
                            alt={doc.doc_type}
                            className="w-full h-20 object-cover rounded border border-slate-600 hover:border-primary transition-colors"
                          />
                        </a>
                      ) : (
                        <div className="w-full h-20 flex flex-col items-center justify-center rounded border border-red-500/30 bg-red-500/10">
                          <AlertTriangle className="h-4 w-4 text-red-400 mb-1" />
                          <p className="text-[10px] text-red-400">{doc.error || "URL indisponible"}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-full px-1">{doc.object_path}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-slate-700/20 rounded">
                  <ImageIcon className="h-3 w-3" /> Aucun document trouvé
                </div>
              )}
            </div>

            {kycSession.ocr_result && (
              <div className="mt-3 p-3 rounded bg-slate-700/30 text-xs">
                <p className="text-muted-foreground mb-1">Résultat OCR</p>
                <p className="text-white">{typeof kycSession.ocr_result === "string" ? kycSession.ocr_result : JSON.stringify(kycSession.ocr_result)}</p>
              </div>
            )}

            {/* KYC Decision — FIX #4: via RPC with mandatory note */}
            {(kycSession.status === "submitted" || kycSession.status === "in_review" || kycSession.status === "manual_review") && (
              <div className="mt-4 space-y-3 border-t border-slate-700/50 pt-3">
                <Textarea
                  placeholder="Note interne (obligatoire pour rejet, recommandée pour approbation)"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  className="bg-slate-700/30 border-slate-600 text-white text-sm min-h-[60px]"
                />
                <div className="flex gap-2 justify-end">
                  {canPerformAction(role, "approve_kyc") && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={deciding}
                      onClick={() => handleDecision("approved")}
                    >
                      {deciding ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                      Approuver
                    </Button>
                  )}
                  {canPerformAction(role, "reject_kyc") && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deciding || !decisionNote.trim()}
                      onClick={() => handleDecision("rejected")}
                    >
                      {deciding ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                      Rejeter
                    </Button>
                  )}
                </div>
                {!decisionNote.trim() && (
                  <p className="text-[10px] text-amber-400">Note obligatoire pour rejeter</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            Aucune session KYC liée à ce client.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
