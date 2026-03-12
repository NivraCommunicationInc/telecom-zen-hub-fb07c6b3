/**
 * CoreKYCPage — Identity Verification & Compliance Console
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { Link } from "react-router-dom";
import { Shield, CheckCircle, XCircle, Clock, AlertTriangle, Eye, Search, Filter, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-500/15 text-amber-400" },
  in_review: { label: "En révision", color: "bg-blue-500/15 text-blue-400" },
  approved: { label: "Approuvé", color: "bg-emerald-500/15 text-emerald-400" },
  rejected: { label: "Rejeté", color: "bg-red-500/15 text-red-400" },
  expired: { label: "Expiré", color: "bg-[#64748B]/20 text-[#64748B]" },
};

export default function CoreKYCPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["core-kyc-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verification_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = sessions.filter((s: any) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.full_name?.toLowerCase().includes(q) ||
        s.document_number?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    total: sessions.length,
    pending: sessions.filter((s: any) => s.status === "pending" || s.status === "in_review").length,
    approved: sessions.filter((s: any) => s.status === "approved").length,
    rejected: sessions.filter((s: any) => s.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, n° document, ID session…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="flex gap-1.5">
          {["all", "pending", "in_review", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === s
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                  : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"
              }`}
            >
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
                {["Session", "Nom complet", "Document", "Score OCR", "Statut", "Créée le", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-[#64748B]">Aucune session trouvée</td></tr>
              ) : (
                filtered.map((s: any) => {
                  const st = STATUS_MAP[s.status] || { label: s.status, color: "text-[#94A3B8]" };
                  return (
                    <tr key={s.id} onClick={() => setSelected(s)} className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#38BDF8]">{s.id?.slice(0, 8)}…</td>
                      <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{s.full_name || "—"}</td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{s.document_type || "—"} {s.document_number ? `#${s.document_number}` : ""}</td>
                      <td className="px-3 py-2.5">
                        {s.match_score != null ? (
                          <span className={`font-mono text-[11px] ${s.match_score >= 80 ? "text-emerald-400" : s.match_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                            {s.match_score}%
                          </span>
                        ) : <span className="text-[#64748B]">—</span>}
                      </td>
                      <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                      <td className="px-3 py-2.5 text-[#94A3B8]">{s.created_at ? format(new Date(s.created_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}</td>
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

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-[#F8FAFC] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[#F8FAFC]">Dossier KYC</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <Section title="Identité">
                <Field label="Nom complet" value={selected.full_name} />
                <Field label="Date de naissance" value={selected.date_of_birth} />
                <Field label="Type de document" value={selected.document_type} />
                <Field label="N° document" value={selected.document_number} />
              </Section>
              <Section title="Vérification">
                <Field label="Statut" value={STATUS_MAP[selected.status]?.label || selected.status} />
                <Field label="Score OCR" value={selected.match_score != null ? `${selected.match_score}%` : "—"} />
                <Field label="Agent vérificateur" value={selected.reviewed_by || "—"} />
                <Field label="Date de révision" value={selected.reviewed_at ? format(new Date(selected.reviewed_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"} />
              </Section>
              <Section title="Liens">
                {selected.order_id && (
                  <Link to={corePath(`/orders/${selected.order_id}`)} className="text-[12px] text-[#38BDF8] hover:underline block">
                    Commande liée →
                  </Link>
                )}
                {selected.user_id && (
                  <Link to={corePath(`/clients/${selected.user_id}`)} className="text-[12px] text-[#38BDF8] hover:underline block">
                    Profil client →
                  </Link>
                )}
              </Section>
              {(selected.status === "pending" || selected.status === "in_review") && (
                <div className="flex gap-2 pt-2">
                  <button className="flex-1 h-8 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors">
                    Approuver
                  </button>
                  <button className="flex-1 h-8 rounded-md bg-red-600/20 text-red-400 border border-red-500/30 text-[12px] font-medium hover:bg-red-600/30 transition-colors">
                    Rejeter
                  </button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
      <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-[#94A3B8]">{label}</span>
      <span className="text-[#F8FAFC] font-medium">{value || "—"}</span>
    </div>
  );
}
