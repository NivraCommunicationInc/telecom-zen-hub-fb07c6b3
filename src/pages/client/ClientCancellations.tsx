import { motion } from "framer-motion";
import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useWriteGuard } from "@/hooks/useWriteGuard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import {
  XCircle, Plus, ArrowLeft, Calendar, Clock, CheckCircle,
  AlertTriangle, Loader2, FileX, Info, ChevronRight,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { usePortalActivityLog } from "@/hooks/usePortalActivityLog";
import { useClientBlockStatus } from "@/hooks/useClientBlockStatus";
import BlockedActionWrapper from "@/components/client/BlockedActionWrapper";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

/* ─── Types ───────────────────────────────────────────────── */
type ServiceType = "mobile" | "internet" | "tv" | "security" | "streaming" | "bundle";
type ReasonCode  = "price" | "moving" | "not_needed" | "service_issue" | "billing_issue" | "other";
type CancelStatus = "requested" | "under_review" | "awaiting_client" | "approved" | "scheduled" | "completed" | "declined";

const SERVICE_LABELS: Record<ServiceType, string> = {
  mobile:"Mobile", internet:"Internet", tv:"Télévision",
  security:"Sécurité", streaming:"Streaming", bundle:"Forfait combiné",
};
const REASON_LABELS: Record<ReasonCode, string> = {
  price:"Prix trop élevé", moving:"Déménagement", not_needed:"Service non nécessaire",
  service_issue:"Problème de service", billing_issue:"Problème de facturation", other:"Autre raison",
};

/* ─── Status config ───────────────────────────────────────── */
type StatusCfg = { label: string; bg: string; color: string; border: string; icon: React.ReactNode };
const STATUS: Record<CancelStatus, StatusCfg> = {
  requested:      { label:"Demandé",          bg:"rgba(245,158,11,0.12)",  color:"#fbbf24", border:"rgba(245,158,11,0.3)",  icon:<Clock size={12}/> },
  under_review:   { label:"En révision",      bg:"rgba(96,165,250,0.12)",  color:"#60a5fa", border:"rgba(96,165,250,0.3)",  icon:<Clock size={12}/> },
  awaiting_client:{ label:"Info requise",     bg:"rgba(167,139,250,0.12)", color:"#a78bfa", border:"rgba(167,139,250,0.3)", icon:<AlertTriangle size={12}/> },
  approved:       { label:"Approuvé",         bg:"rgba(16,185,129,0.12)",  color:"#34d399", border:"rgba(16,185,129,0.3)",  icon:<CheckCircle size={12}/> },
  scheduled:      { label:"Planifié",         bg:"rgba(6,182,212,0.12)",   color:"#22d3ee", border:"rgba(6,182,212,0.3)",   icon:<Calendar size={12}/> },
  completed:      { label:"Complété",         bg:"rgba(107,107,133,0.12)", color:"#a0a0b8", border:"rgba(107,107,133,0.3)", icon:<CheckCircle size={12}/> },
  declined:       { label:"Refusé",           bg:"rgba(239,68,68,0.12)",   color:"#f87171", border:"rgba(239,68,68,0.3)",   icon:<XCircle size={12}/> },
};
const statusOf = (s: string): StatusCfg => STATUS[s as CancelStatus] ?? STATUS.requested;

/* ─── Design tokens ───────────────────────────────────────── */
const D = {
  bg:     "#020209",
  card:   "rgba(255,255,255,0.03)",
  border: "rgba(124,58,237,0.22)",
  input:  "#12122A",
  text:   "#FFFFFF",
  muted:  "rgba(255,255,255,0.4)",
  mono:   "'JetBrains Mono', monospace",
  display:"'Space Grotesk', sans-serif",
};

/* ─── Shared input style ──────────────────────────────────── */
const inputSx: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: D.input, border: "1px solid rgba(124,58,237,0.25)",
  borderRadius: 12, padding: "10px 14px",
  color: "#fff", fontSize: 14, outline: "none",
};

/* ─── Glass card ──────────────────────────────────────────── */
const GCard = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 18, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", overflow: "hidden", ...style }}>
    {children}
  </div>
);

/* ─── Status pill ─────────────────────────────────────────── */
const SPill = ({ status }: { status: string }) => {
  const c = statusOf(status);
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:c.bg, color:c.color, border:`1px solid ${c.border}`, borderRadius:999, fontSize:11, fontWeight:700, padding:"4px 10px" }}>
      {c.icon} {c.label}
    </span>
  );
};

/* ─── Section label ───────────────────────────────────────── */
const SLabel = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.35)", fontFamily:D.mono, marginBottom:6 }}>{children}</p>
);

/* ─── Fade-up variant ─────────────────────────────────────── */
const up = {
  hidden:  { opacity:0, y:16 },
  visible: (i=0) => ({ opacity:1, y:0, transition:{ duration:.45, delay:i*.07, ease:[.22,1,.36,1] as const } }),
};

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
const ClientCancellations = () => {
  const { user }              = useClientAuth();
  const { isAccountBlocked }  = useClientBlockStatus();
  const { toast }             = useToast();
  const queryClient           = useQueryClient();
  const { logActivity }       = usePortalActivityLog();
  const [dialogOpen, setDialogOpen]           = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [form, setForm] = useState({
    service_type: "" as ServiceType | "",
    service_identifier: "",
    reason_code: "" as ReasonCode | "",
    reason_details: "",
    requested_effective_date: "",
  });

  const { data: canonical, isLoading } = useCanonicalClientData(user?.id);
  const requests = ((canonical?.cancellationRequests ?? []) as any[])
    .slice().sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));

  const activeSubscriptions = ((canonical?.subscriptions ?? []) as any[])
    .filter(s => ["active","paused","pause_requested"].includes(String(s.status || "").toLowerCase()));

  const mapCategoryToType = (cat: string): ServiceType => {
    const c = (cat || "").toLowerCase();
    if (c.includes("internet")) return "internet";
    if (c.includes("tv") || c.includes("télé") || c.includes("tele")) return "tv";
    if (c.includes("mobile") || c.includes("cellulaire")) return "mobile";
    if (c.includes("streaming")) return "streaming";
    if (c.includes("security") || c.includes("sécurité")) return "security";
    if (c.includes("bundle") || c.includes("combo")) return "bundle";
    return "bundle";
  };

  /* Mutation */
  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { data, error } = await portalSupabase
        .from("service_cancellation_requests")
        .insert([{
          user_id: user?.id as string,
          service_type: f.service_type as ServiceType,
          service_identifier: f.service_identifier || null,
          reason_code: f.reason_code as ReasonCode,
          reason_details: f.reason_details || null,
          requested_effective_date: f.requested_effective_date || null,
          created_by_role: "client",
        }])
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
      logActivity("create", "cancellation_request", data.id, { service_type: data.service_type, request_number: data.request_number });
      toast({ title: "Demande soumise", description: `Votre demande ${data.request_number} a été reçue.` });
      setDialogOpen(false);
      setForm({ service_type:"", service_identifier:"", reason_code:"", reason_details:"", requested_effective_date:"" });
    },
    onError: () => toast({ title:"Erreur", description:"Impossible de soumettre la demande", variant:"destructive" }),
  });

  const writeGuard = useWriteGuard();
  const handleSubmit = writeGuard(() => {
    if (!form.service_type || !form.reason_code) {
      toast({ title:"Champs requis", description:"Veuillez remplir tous les champs obligatoires", variant:"destructive" });
      return;
    }
    mutation.mutate(form);
  });

  /* ── KEYFRAMES (inline once) ── */
  const KF = `
    @keyframes aurora-1{0%,100%{transform:translate(0,0) scale(1);opacity:.45;}33%{transform:translate(60px,-40px) scale(1.1);opacity:.6;}66%{transform:translate(-40px,30px) scale(.95);opacity:.4;}}
    @keyframes aurora-2{0%,100%{transform:translate(0,0) scale(1);opacity:.3;}40%{transform:translate(-70px,50px) scale(1.15);opacity:.45;}75%{transform:translate(50px,-50px) scale(.9);opacity:.25;}}
    @keyframes scanline{0%{transform:translateY(-100%);opacity:0;}5%{opacity:.4;}95%{opacity:.4;}100%{transform:translateY(100vh);opacity:0;}}
  `;

  /* ── WRAPPER ── */
  const Wrapper = ({ children: c }: { children: React.ReactNode }) => (
    <ClientLayout>
      <style>{KF}</style>
      <div style={{ background: D.bg, minHeight:"100vh", position:"relative" }}>
        {/* Auroras */}
        <div aria-hidden style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
          <div style={{ position:"absolute", top:"-15%", right:"-10%", width:600, height:600, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 65%)", animation:"aurora-1 16s ease-in-out infinite" }} />
          <div style={{ position:"absolute", bottom:"-15%", left:"-10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)", animation:"aurora-2 20s ease-in-out infinite" }} />
        </div>
        <div aria-hidden style={{ position:"fixed", inset:0, backgroundImage:"linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize:"80px 80px", pointerEvents:"none", zIndex:0 }} />
        <div aria-hidden style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:1, overflow:"hidden" }}>
          <div style={{ position:"absolute", left:0, right:0, height:1, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.5) 20%, rgba(6,182,212,0.6) 50%, rgba(124,58,237,0.5) 80%, transparent)", animation:"scanline 10s linear infinite", boxShadow:"0 0 16px rgba(124,58,237,0.25)" }} />
        </div>
        <div style={{ position:"relative", zIndex:2, padding:"32px 0 56px" }}>{c}</div>
      </div>
    </ClientLayout>
  );

  /* ════ DETAIL VIEW ══════════════════════════════════════════ */
  if (selectedRequest) {
    const s = statusOf(selectedRequest.status);
    return (
      <Wrapper>
        <motion.div initial="hidden" animate="visible" variants={up}>
          {/* Back */}
          <button
            onClick={() => setSelectedRequest(null)}
            style={{ display:"inline-flex", alignItems:"center", gap:6, background:"none", border:"none", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:14, fontWeight:600, marginBottom:24, padding:0 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
          >
            <ArrowLeft size={16} /> Retour aux demandes
          </button>

          <GCard>
            {/* Header strip */}
            <div style={{ padding:"24px 28px 20px", borderBottom:`1px solid rgba(124,58,237,0.15)`, display:"flex", flexWrap:"wrap", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", display:"flex", alignItems:"center", justifyContent:"center", color:"#f87171" }}>
                    <FileX size={18} />
                  </div>
                  <div>
                    <p style={{ fontFamily:D.display, fontWeight:800, fontSize:18, color:"#fff", lineHeight:1.2 }}>Demande {selectedRequest.request_number}</p>
                    <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontFamily:D.mono }}>
                      Soumise le {format(new Date(selectedRequest.created_at), "d MMMM yyyy 'à' HH:mm", { locale:fr })}
                    </p>
                  </div>
                </div>
              </div>
              <SPill status={selectedRequest.status} />
            </div>

            <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", gap:20 }}>
              {/* Service info grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div>
                  <SLabel>Type de service</SLabel>
                  <p style={{ color:"#fff", fontWeight:600, fontSize:15 }}>{SERVICE_LABELS[selectedRequest.service_type as ServiceType]}</p>
                </div>
                {selectedRequest.service_identifier && (
                  <div>
                    <SLabel>Identifiant</SLabel>
                    <p style={{ color:"#fff", fontWeight:600, fontSize:15, fontFamily:D.mono }}>{selectedRequest.service_identifier}</p>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <SLabel>Raison</SLabel>
                <p style={{ color:"#fff", fontWeight:600, fontSize:15 }}>{REASON_LABELS[selectedRequest.reason_code as ReasonCode]}</p>
                {selectedRequest.reason_details && (
                  <p style={{ color:"rgba(255,255,255,0.5)", fontSize:14, marginTop:4 }}>{selectedRequest.reason_details}</p>
                )}
              </div>

              {/* Dates */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                {selectedRequest.requested_effective_date && (
                  <div>
                    <SLabel>Date demandée</SLabel>
                    <p style={{ color:"#fff", fontWeight:600, fontSize:15 }}>
                      {format(new Date(selectedRequest.requested_effective_date), "d MMMM yyyy", { locale:fr })}
                    </p>
                  </div>
                )}
                {selectedRequest.effective_date && (
                  <div>
                    <SLabel>Date effective</SLabel>
                    <p style={{ color:"#a78bfa", fontWeight:700, fontSize:15 }}>
                      {format(new Date(selectedRequest.effective_date), "d MMMM yyyy", { locale:fr })}
                    </p>
                  </div>
                )}
              </div>

              {/* Staff message */}
              {selectedRequest.public_message && (
                <div style={{ background:"rgba(124,58,237,0.08)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:14, padding:"14px 18px" }}>
                  <SLabel>Message de Nivra</SLabel>
                  <p style={{ color:"rgba(255,255,255,0.8)", fontSize:14 }}>{selectedRequest.public_message}</p>
                </div>
              )}

              {/* Declined reason */}
              {selectedRequest.status === "declined" && selectedRequest.decline_reason && (
                <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderRadius:14, padding:"14px 18px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <XCircle size={14} style={{ color:"#f87171" }} />
                    <span style={{ color:"#f87171", fontWeight:700, fontSize:13 }}>Raison du refus</span>
                  </div>
                  <p style={{ color:"rgba(255,255,255,0.7)", fontSize:14 }}>{selectedRequest.decline_reason}</p>
                </div>
              )}

              {/* Timeline */}
              <div style={{ borderTop:"1px solid rgba(124,58,237,0.15)", paddingTop:20 }}>
                <SLabel>Historique</SLabel>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:"#34d399", flexShrink:0 }} />
                    <span style={{ color:"rgba(255,255,255,0.7)" }}>Demande soumise</span>
                    <span style={{ marginLeft:"auto", color:"rgba(255,255,255,0.35)", fontFamily:D.mono, fontSize:11 }}>
                      {format(new Date(selectedRequest.created_at), "d MMM HH:mm", { locale:fr })}
                    </span>
                  </div>
                  {selectedRequest.processed_at && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:"#7c3aed", flexShrink:0 }} />
                      <span style={{ color:"rgba(255,255,255,0.7)" }}>Traité par {selectedRequest.processed_by_name ?? "Nivra"}</span>
                      <span style={{ marginLeft:"auto", color:"rgba(255,255,255,0.35)", fontFamily:D.mono, fontSize:11 }}>
                        {format(new Date(selectedRequest.processed_at), "d MMM HH:mm", { locale:fr })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </GCard>
        </motion.div>
      </Wrapper>
    );
  }

  /* ════ LIST VIEW ════════════════════════════════════════════ */
  return (
    <Wrapper>
      {/* ── Page header ── */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={up} style={{ marginBottom:28 }}>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
          <div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:999, padding:"5px 14px", marginBottom:14 }}>
              <FileX size={12} style={{ color:"#f87171" }} />
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#f87171", fontFamily:D.mono }}>Résiliations</span>
            </div>
            <h1 style={{ fontFamily:D.display, fontWeight:800, fontSize:"clamp(26px,4vw,40px)", color:"#fff", letterSpacing:"-1.5px", lineHeight:1.1, marginBottom:8 }}>
              Annulation de service
            </h1>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:14 }}>
              Gérez vos demandes d'annulation de service Nivra.
            </p>
          </div>

          {/* New request button */}
          <button
            onClick={() => setDialogOpen(true)}
            style={{ display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#7c3aed,#6d28d9)", border:"1px solid rgba(124,58,237,0.5)", borderRadius:14, padding:"12px 22px", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 0 24px rgba(124,58,237,0.25)", transition:"all .18s ease", flexShrink:0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(124,58,237,0.4)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(124,58,237,0.25)"; }}
          >
            <Plus size={16} /> Nouvelle demande
          </button>
        </div>
      </motion.div>

      {/* ── Info notice ── */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={up} style={{ marginBottom:20 }}>
        <div style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:14, padding:"14px 18px", display:"flex", gap:12, alignItems:"flex-start" }}>
          <Info size={16} style={{ color:"#fbbf24", flexShrink:0, marginTop:1 }} />
          <p style={{ color:"rgba(255,255,255,0.6)", fontSize:13, lineHeight:1.6 }}>
            Votre demande sera examinée par notre équipe dans un délai de 48h ouvrables. Votre service reste actif jusqu'à confirmation de l'annulation.
          </p>
        </div>
      </motion.div>

      {/* ── List ── */}
      {isLoading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:"64px 0" }}>
          <Loader2 size={28} style={{ color:"rgba(124,58,237,0.6)", animation:"spin 1s linear infinite" }} />
          <style>{`@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}`}</style>
        </div>
      ) : requests.length > 0 ? (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {requests.map((req: any, i: number) => {
            const s = statusOf(req.status);
            return (
              <motion.div key={req.id} custom={i + 2} initial="hidden" animate="visible" variants={up}>
                <GCard>
                  <div
                    style={{ padding:"18px 22px", cursor:"pointer", transition:"background .18s ease" }}
                    onClick={() => setSelectedRequest(req)}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.04)")}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                      {/* Left */}
                      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                        <div style={{ width:42, height:42, borderRadius:13, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", display:"flex", alignItems:"center", justifyContent:"center", color:"#f87171", flexShrink:0 }}>
                          <FileX size={18} />
                        </div>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:4 }}>
                            <span style={{ fontFamily:D.mono, fontWeight:700, fontSize:13, color:"#fff", letterSpacing:1 }}>{req.request_number}</span>
                            <span style={{ background:"rgba(124,58,237,0.12)", border:"1px solid rgba(124,58,237,0.25)", borderRadius:999, fontSize:11, fontWeight:600, padding:"2px 9px", color:"#a78bfa" }}>
                              {SERVICE_LABELS[req.service_type as ServiceType]}
                            </span>
                          </div>
                          <p style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>
                            {REASON_LABELS[req.reason_code as ReasonCode]} · {format(new Date(req.created_at), "d MMM yyyy", { locale:fr })}
                          </p>
                        </div>
                      </div>
                      {/* Right */}
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <SPill status={req.status} />
                        <ChevronRight size={16} style={{ color:"rgba(124,58,237,0.4)" }} />
                      </div>
                    </div>
                    {req.effective_date && (
                      <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid rgba(124,58,237,0.1)", display:"flex", alignItems:"center", gap:6, fontSize:12, color:"rgba(255,255,255,0.35)" }}>
                        <Calendar size={13} /> Date effective : {format(new Date(req.effective_date), "d MMMM yyyy", { locale:fr })}
                      </div>
                    )}
                  </div>
                </GCard>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div initial="hidden" animate="visible" custom={2} variants={up}>
          <GCard style={{ textAlign:"center", padding:"64px 32px" }}>
            <div style={{ width:60, height:60, borderRadius:18, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", color:"#f87171" }}>
              <FileX size={26} />
            </div>
            <h3 style={{ fontFamily:D.display, fontWeight:800, fontSize:22, color:"#fff", marginBottom:8 }}>Aucune demande d'annulation</h3>
            <p style={{ color:"rgba(255,255,255,0.4)", fontSize:14, marginBottom:28 }}>
              Vous n'avez soumis aucune demande d'annulation de service.
            </p>
            <button
              onClick={() => setDialogOpen(true)}
              style={{ display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#7c3aed,#6d28d9)", border:"1px solid rgba(124,58,237,0.5)", borderRadius:14, padding:"12px 24px", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 0 20px rgba(124,58,237,0.2)" }}
            >
              <Plus size={16} /> Nouvelle demande
            </button>
          </GCard>
        </motion.div>
      )}

      {/* ════ DIALOG — Nouvelle demande ══════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ background:"#111130", border:"1px solid rgba(124,58,237,0.3)", borderRadius:20, maxWidth:480, color:"#fff" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily:D.display, fontWeight:800, fontSize:20, color:"#fff" }}>
              Demande d'annulation
            </DialogTitle>
            <p style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginTop:4 }}>
              Remplissez le formulaire ci-dessous. Notre équipe vous contactera sous 48h.
            </p>
          </DialogHeader>

          <div style={{ display:"flex", flexDirection:"column", gap:16, paddingTop:8 }}>
            {/* Service selection — from active subscriptions */}
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:7, letterSpacing:.5 }}>
                Service à annuler <span style={{ color:"#f87171" }}>*</span>
              </label>
              {activeSubscriptions.length > 0 ? (
                <select
                  value={form.service_identifier}
                  onChange={e => {
                    const sub = activeSubscriptions.find((s: any) => s.id === e.target.value);
                    if (sub) {
                      setForm({
                        ...form,
                        service_type: mapCategoryToType(sub.service_category || sub.plan_code || ""),
                        service_identifier: sub.id,
                      });
                    }
                  }}
                  style={{ ...inputSx, appearance:"none" }}
                >
                  <option value="">Sélectionnez un service</option>
                  {activeSubscriptions.map((sub: any) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.plan_name || sub.plan_code || "Abonnement"} — {Number(sub.plan_price || 0).toFixed(2)} $/mois
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={form.service_type}
                  onChange={e => setForm({ ...form, service_type: e.target.value as ServiceType })}
                  style={{ ...inputSx, appearance:"none" }}
                >
                  <option value="">Sélectionnez un service</option>
                  {Object.entries(SERVICE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              )}
            </div>

            {/* Reason */}
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:7, letterSpacing:.5 }}>
                Raison <span style={{ color:"#f87171" }}>*</span>
              </label>
              <select
                value={form.reason_code}
                onChange={e => setForm({ ...form, reason_code: e.target.value as ReasonCode })}
                style={{ ...inputSx, appearance:"none" }}
              >
                <option value="">Sélectionnez une raison</option>
                {Object.entries(REASON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Details */}
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:7, letterSpacing:.5 }}>
                Détails <span style={{ color:"rgba(255,255,255,0.3)", fontWeight:400 }}>(optionnel)</span>
              </label>
              <textarea
                rows={3}
                value={form.reason_details}
                onChange={e => setForm({ ...form, reason_details: e.target.value })}
                placeholder="Expliquez votre situation..."
                style={{ ...inputSx, resize:"vertical", minHeight:80 }}
              />
            </div>

            {/* Date */}
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.5)", display:"block", marginBottom:7, letterSpacing:.5 }}>
                Date souhaitée <span style={{ color:"rgba(255,255,255,0.3)", fontWeight:400 }}>(optionnel)</span>
              </label>
              <input
                type="date"
                value={form.requested_effective_date}
                min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                onChange={e => setForm({ ...form, requested_effective_date: e.target.value })}
                style={{ ...inputSx, colorScheme:"dark" }}
              />
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:5 }}>
                Si non spécifié, l'annulation sera effective à la fin de votre période.
              </p>
            </div>
          </div>

          <DialogFooter style={{ marginTop:8, display:"flex", gap:10 }}>
            <button
              onClick={() => setDialogOpen(false)}
              style={{ flex:1, padding:"11px 0", borderRadius:12, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)", fontSize:14, fontWeight:600, cursor:"pointer" }}
            >
              Annuler
            </button>
            <BlockedActionWrapper action="request" showInlineNotice={isAccountBlocked}>
              <button
                onClick={handleSubmit}
                disabled={isAccountBlocked || mutation.isPending || writeGuard.isReadOnly}
                style={{ flex:1, padding:"11px 0", borderRadius:12, background:"linear-gradient(135deg,#7c3aed,#6d28d9)", border:"1px solid rgba(124,58,237,0.5)", color:"#fff", fontSize:14, fontWeight:700, cursor: mutation.isPending ? "default" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity: isAccountBlocked || writeGuard.isReadOnly ? .5 : 1 }}
              >
                {mutation.isPending && <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }} />}
                Soumettre la demande
              </button>
            </BlockedActionWrapper>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
};

export default ClientCancellations;
