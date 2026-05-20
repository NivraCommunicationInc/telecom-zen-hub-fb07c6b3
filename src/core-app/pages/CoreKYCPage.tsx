/**
 * CoreKYCPage — Identity Verification & Compliance Console
 * Full KYC review workflow with document viewer, OCR data, approve/reject, timeline
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { Link } from "react-router-dom";
import {
  Shield, CheckCircle, XCircle, Clock, AlertTriangle, Eye, Search,
  ArrowLeft, FileText, User, Camera, CreditCard, ZoomIn, ZoomOut,
  RotateCw, Download, ChevronRight, Hash, Calendar, MapPin, Globe,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { ProfileName, useProfileName } from "@/hooks/useProfileName";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-500/15 text-amber-400" },
  submitted: { label: "Soumis", color: "bg-blue-500/15 text-blue-400" },
  in_review: { label: "En révision", color: "bg-blue-500/15 text-blue-400" },
  approved: { label: "Approuvé", color: "bg-emerald-500/15 text-emerald-400" },
  rejected: { label: "Rejeté", color: "bg-red-500/15 text-red-400" },
  expired: { label: "Expiré", color: "bg-[#64748B]/20 text-[#64748B]" },
};

export default function CoreKYCPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [activeDocTab, setActiveDocTab] = useState<"front" | "back" | "selfie">("front");
  const [reviewReason, setReviewReason] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const reviewerName = useProfileName(selected?.reviewed_by ?? null, "—");

  // ═══ QUERIES ═══
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["core-kyc-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verification_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      // Enrich with profiles
      const userIds = [...new Set((data || []).map((s: any) => s.user_id).filter(Boolean))];
      if (userIds.length === 0) return data || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, client_number, date_of_birth")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((s: any) => ({ ...s, profile: profileMap.get(s.user_id) || null }));
    },
  });

  // Get signed URLs for documents
  const { data: docUrls } = useQuery({
    queryKey: ["core-kyc-doc-urls", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const paths = [selected.document_front_path, selected.document_back_path, selected.selfie_path].filter(Boolean);
      if (paths.length === 0) return {};
      const results: Record<string, string> = {};
      for (const path of paths) {
        const { data } = await supabase.storage.from("id-documents").createSignedUrl(path, 600);
        if (data?.signedUrl) results[path] = data.signedUrl;
      }
      return results;
    },
  });

  // ═══ MUTATIONS ═══
  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, status, reason }: { sessionId: string; status: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
      };
      if (reason) updates.review_reason = reason;
      const { error } = await supabase
        .from("identity_verification_sessions")
        .update(updates)
        .eq("id", sessionId);
      if (error) throw error;
      // Also update order if linked
      if (selected?.order_id) {
        await supabase.from("orders").update({
          id_verification_status: status === "approved" ? "approved" : status === "rejected" ? "rejected" : "in_review",
          id_verified_at: status === "approved" ? new Date().toISOString() : null,
        }).eq("id", selected.order_id);
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["core-kyc-sessions"] });
      toast.success(vars.status === "approved" ? "KYC approuvé" : vars.status === "rejected" ? "KYC rejeté" : "Statut mis à jour");
      setSelected((prev: any) => prev ? { ...prev, status: vars.status, reviewed_at: new Date().toISOString() } : null);
      setReviewReason("");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  // ═══ FILTERING ═══
  const filtered = useMemo(() => {
    return sessions.filter((s: any) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.profile?.full_name?.toLowerCase().includes(q) ||
          s.profile?.email?.toLowerCase().includes(q) ||
          s.case_number?.toLowerCase().includes(q) ||
          s.id?.toLowerCase().includes(q) ||
          s.order_number?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sessions, search, statusFilter]);

  const counts = {
    total: sessions.length,
    pending: sessions.filter((s: any) => ["pending", "submitted", "in_review"].includes(s.status)).length,
    approved: sessions.filter((s: any) => s.status === "approved").length,
    rejected: sessions.filter((s: any) => s.status === "rejected").length,
  };

  // ═══ DETAIL VIEW ═══
  if (selected) {
    const extracted = selected.extracted_fields || {};
    const matchResult = selected.match_result || {};
    const matchScore = matchResult.score ?? matchResult.match_score ?? null;
    const frontUrl = selected.document_front_path ? docUrls?.[selected.document_front_path] : null;
    const backUrl = selected.document_back_path ? docUrls?.[selected.document_back_path] : null;
    const selfieUrl = selected.selfie_path ? docUrls?.[selected.selfie_path] : null;
    const currentDocUrl = activeDocTab === "front" ? frontUrl : activeDocTab === "back" ? backUrl : selfieUrl;
    const st = STATUS_MAP[selected.status] || { label: selected.status, color: "text-[#94A3B8]" };

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => { setSelected(null); setZoomLevel(1); }} className="flex items-center gap-1.5 text-[13px] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Retour aux sessions
          </button>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium ${st.color}`}>{st.label}</span>
            <span className="font-mono text-[12px] text-[#38BDF8]">{selected.case_number || selected.id?.slice(0, 8)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* LEFT: Document viewer */}
          <div className="space-y-3">
            {/* Document tabs */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {([
                  { id: "front" as const, label: "Recto", icon: CreditCard, available: !!selected.document_front_path },
                  { id: "back" as const, label: "Verso", icon: CreditCard, available: !!selected.document_back_path },
                  { id: "selfie" as const, label: "Selfie", icon: Camera, available: !!selected.selfie_path },
                ]).map((tab) => (
                  <button key={tab.id} onClick={() => { setActiveDocTab(tab.id); setZoomLevel(1); }}
                    disabled={!tab.available}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-md transition-colors ${
                      activeDocTab === tab.id
                        ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                        : tab.available
                          ? "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"
                          : "text-[#64748B] border border-[hsl(220,15%,14%)] opacity-40 cursor-not-allowed"
                    }`}>
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {!tab.available && <span className="text-[9px]">(absent)</span>}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))} className="h-7 w-7 flex items-center justify-center rounded border border-[hsl(220,15%,18%)] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors">
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] text-[#64748B] w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))} className="h-7 w-7 flex items-center justify-center rounded border border-[hsl(220,15%,18%)] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors">
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setZoomLevel(1)} className="h-7 w-7 flex items-center justify-center rounded border border-[hsl(220,15%,18%)] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors">
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Document image area */}
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,7%)] min-h-[400px] flex items-center justify-center overflow-auto">
              {currentDocUrl ? (
                <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center", transition: "transform 0.2s ease" }}>
                  <img
                    src={currentDocUrl}
                    alt={`Document ${activeDocTab}`}
                    className="max-w-full max-h-[600px] object-contain rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              ) : (
                <div className="text-center py-16">
                  <FileText className="h-12 w-12 text-[#64748B] mx-auto mb-3 opacity-40" />
                  <p className="text-[13px] text-[#64748B]">
                    {activeDocTab === "front" && !selected.document_front_path ? "Aucun document recto soumis" :
                     activeDocTab === "back" && !selected.document_back_path ? "Aucun document verso soumis" :
                     activeDocTab === "selfie" && !selected.selfie_path ? "Aucun selfie soumis" :
                     "Chargement du document…"}
                  </p>
                </div>
              )}
            </div>

            {/* OCR Extracted Fields */}
            {Object.keys(extracted).length > 0 && (
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Données extraites (OCR)</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(extracted).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-[12px] gap-2">
                      <span className="text-[#94A3B8] capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-[#F8FAFC] font-medium text-right">{String(value || "—")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Match Result */}
            {Object.keys(matchResult).length > 0 && (
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Résultat de correspondance</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(matchResult).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-[12px] gap-2">
                      <span className="text-[#94A3B8] capitalize">{key.replace(/_/g, " ")}</span>
                      <span className={`font-medium text-right ${
                        key.includes("score") ? (Number(value) >= 80 ? "text-emerald-400" : Number(value) >= 50 ? "text-amber-400" : "text-red-400") : "text-[#F8FAFC]"
                      }`}>{key.includes("score") ? `${value}%` : String(value || "—")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review reason / notes */}
            {["pending", "submitted", "in_review"].includes(selected.status) && (
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Décision de vérification</h3>
                <textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Raison de la décision (optionnel pour approbation, requis pour rejet)…"
                  rows={3}
                  className="w-full rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] p-3 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => updateSessionMutation.mutate({ sessionId: selected.id, status: "approved", reason: reviewReason })}
                    disabled={updateSessionMutation.isPending}
                    className="flex-1 h-9 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Approuver
                  </button>
                  <button
                    onClick={() => {
                      if (!reviewReason.trim()) { toast.error("Raison requise pour le rejet"); return; }
                      updateSessionMutation.mutate({ sessionId: selected.id, status: "rejected", reason: reviewReason });
                    }}
                    disabled={updateSessionMutation.isPending}
                    className="flex-1 h-9 rounded-md bg-red-600/20 text-red-400 border border-red-500/30 text-[12px] font-medium hover:bg-red-600/30 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Rejeter
                  </button>
                  <button
                    onClick={() => updateSessionMutation.mutate({ sessionId: selected.id, status: "in_review", reason: reviewReason })}
                    disabled={updateSessionMutation.isPending || selected.status === "in_review"}
                    className="h-9 px-3 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[12px] font-medium hover:bg-blue-600/30 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Eye className="h-3.5 w-3.5" /> En révision
                  </button>
                </div>
              </div>
            )}

            {/* Already reviewed */}
            {selected.review_reason && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <h4 className="text-[11px] font-medium text-amber-400 uppercase mb-1">Raison de la décision</h4>
                <p className="text-[12px] text-[#CBD5E1]">{selected.review_reason}</p>
              </div>
            )}
          </div>

          {/* RIGHT: Session info sidebar */}
          <div className="space-y-3">
            {/* Client info */}
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
              <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Client</h3>
              <div className="space-y-1.5 text-[12px]">
                <Row label="Nom" value={selected.profile?.full_name} />
                <Row label="Email" value={selected.profile?.email} />
                <Row label="Téléphone" value={selected.profile?.phone} />
                <Row label="N° client" value={selected.profile?.client_number} mono />
                <Row label="DDN" value={selected.profile?.date_of_birth} />
              </div>
              {selected.user_id && (
                <Link to={corePath(`/clients/${selected.user_id}`)} className="text-[11px] text-[#38BDF8] hover:underline block mt-2">
                  Voir profil client →
                </Link>
              )}
            </div>

            {/* Session details */}
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
              <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Session KYC</h3>
              <div className="space-y-1.5 text-[12px]">
                <Row label="ID session" value={selected.id?.slice(0, 12) + "…"} mono />
                <Row label="N° dossier" value={selected.case_number} mono />
                <Row label="Statut" value={st.label} />
                <Row label="Type document" value={selected.document_type || selected.id_type} />
                <Row label="Province" value={selected.id_province} />
                <Row label="Tentatives" value={`${selected.submission_attempts} / ${selected.max_attempts}`} />
                <Row label="Soumis le" value={selected.submitted_at ? format(new Date(selected.submitted_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"} />
                <Row label="Créé le" value={selected.created_at ? format(new Date(selected.created_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"} />
                <Row label="Expire le" value={selected.expires_at ? format(new Date(selected.expires_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"} />
              </div>
            </div>

            {/* Score */}
            {matchScore != null && (
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Score OCR</h3>
                <div className="flex items-center gap-3">
                  <div className={`text-3xl font-bold ${matchScore >= 80 ? "text-emerald-400" : matchScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                    {matchScore}%
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-[hsl(220,15%,14%)] overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${matchScore >= 80 ? "bg-emerald-500" : matchScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(100, matchScore)}%` }} />
                    </div>
                    <p className="text-[10px] text-[#64748B] mt-1">
                      {matchScore >= 80 ? "Haute correspondance" : matchScore >= 50 ? "Correspondance moyenne" : "Faible correspondance"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Review info */}
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
              <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Vérification</h3>
              <div className="space-y-1.5 text-[12px]">
                <Row label="Agent vérificateur" value={selected.reviewed_by ? reviewerName : "—"} />
                <Row label="Révisé le" value={selected.reviewed_at ? format(new Date(selected.reviewed_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"} />
                <Row label="Rétention" value={selected.retention_status} />
              </div>
            </div>

            {/* Order link */}
            {selected.order_id && (
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Commande liée</h3>
                <Link to={corePath(`/orders/${selected.order_id}`)} className="text-[12px] text-[#38BDF8] hover:underline flex items-center gap-1.5">
                  {selected.order_number || selected.order_id?.slice(0, 8)} <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Status change for already reviewed */}
            {["approved", "rejected"].includes(selected.status) && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <h3 className="text-[11px] font-medium text-amber-400 uppercase tracking-wider mb-2">Modifier la décision</h3>
                <div className="flex gap-2">
                  {selected.status !== "approved" && (
                    <button onClick={() => updateSessionMutation.mutate({ sessionId: selected.id, status: "approved" })}
                      className="flex-1 h-8 rounded-md bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-500 transition-colors">
                      Approuver
                    </button>
                  )}
                  {selected.status !== "rejected" && (
                    <button onClick={() => updateSessionMutation.mutate({ sessionId: selected.id, status: "rejected" })}
                      className="flex-1 h-8 rounded-md bg-red-600/20 text-red-400 border border-red-500/30 text-[11px] font-medium hover:bg-red-600/30 transition-colors">
                      Rejeter
                    </button>
                  )}
                  <button onClick={() => updateSessionMutation.mutate({ sessionId: selected.id, status: "in_review" })}
                    className="flex-1 h-8 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[11px] font-medium hover:bg-blue-600/30 transition-colors">
                    Réouvrir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══ LIST VIEW ═══
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Vérification d'identité (KYC)</h1>
          <p className="text-xs text-[#94A3B8]">Conformité et validation documentaire</p>
        </div>
        <Shield className="h-5 w-5 text-emerald-400" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total sessions", value: counts.total, icon: Shield },
          { label: "En attente", value: counts.pending, icon: Clock, accent: "text-amber-400" },
          { label: "Approuvées", value: counts.approved, icon: CheckCircle, accent: "text-emerald-400" },
          { label: "Rejetées", value: counts.rejected, icon: XCircle, accent: "text-red-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#94A3B8] uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.accent || "text-[#64748B]"}`} />
            </div>
            <p className={`text-xl font-bold ${kpi.accent || "text-[#F8FAFC]"}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, email, n° dossier, commande…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
        </div>
        <div className="flex gap-1.5">
          {["all", "pending", "submitted", "in_review", "approved", "rejected"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === s
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"
              }`}>
              {s === "all" ? "Tous" : STATUS_MAP[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Dossier", "Client", "Document", "Score", "Statut", "Soumis le", "Révisé par", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#64748B]">Aucune session trouvée</td></tr>
              ) : (
                filtered.map((s: any) => {
                  const stRow = STATUS_MAP[s.status] || { label: s.status, color: "text-[#94A3B8]" };
                  const score = s.match_result?.score ?? s.match_result?.match_score ?? null;
                  return (
                    <tr key={s.id} onClick={() => setSelected(s)} className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#38BDF8]">{s.case_number || s.id?.slice(0, 8)}</td>
                      <td className="px-3 py-2.5">
                        <div className="text-[#F8FAFC] font-medium">{s.profile?.full_name || "—"}</div>
                        <div className="text-[10px] text-[#64748B]">{s.profile?.email || ""}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{s.document_type || s.id_type || "—"}</td>
                      <td className="px-3 py-2.5">
                        {score != null ? (
                          <span className={`font-mono text-[11px] ${score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                            {score}%
                          </span>
                        ) : <span className="text-[#64748B]">—</span>}
                      </td>
                      <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${stRow.color}`}>{stRow.label}</span></td>
                      <td className="px-3 py-2.5 text-[#94A3B8]">{s.submitted_at ? format(new Date(s.submitted_at), "dd MMM HH:mm", { locale: fr }) : s.created_at ? format(new Date(s.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}</td>
                      <td className="px-3 py-2.5 text-[#94A3B8] font-mono text-[10px]">{s.reviewed_by?.slice(0, 8) || "—"}</td>
                      <td className="px-3 py-2.5">
                        <button className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors">
                          <Eye className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-[#94A3B8]">{label}</span>
      <span className={`text-[#F8FAFC] font-medium text-right max-w-[180px] break-all ${mono ? "font-mono text-[11px]" : ""}`}>{value || "—"}</span>
    </div>
  );
}
