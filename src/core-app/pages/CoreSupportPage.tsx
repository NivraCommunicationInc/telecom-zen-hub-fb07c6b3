/**
 * CoreSupportPage — Customer Support Ticket Management Console
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Headphones, Search, MessageSquare, Clock, CheckCircle, AlertCircle, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const TICKET_STATUSES: Record<string, { label: string; color: string }> = {
  open: { label: "Ouvert", color: "bg-blue-500/15 text-blue-400" },
  in_progress: { label: "En cours", color: "bg-amber-500/15 text-amber-400" },
  waiting_customer: { label: "Attente client", color: "bg-purple-500/15 text-purple-400" },
  resolved: { label: "Résolu", color: "bg-emerald-500/15 text-emerald-400" },
  closed: { label: "Fermé", color: "bg-[#64748B]/20 text-[#64748B]" },
};

export default function CoreSupportPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["core-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["core-ticket-messages", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", selected.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = tickets.filter((t: any) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.ticket_number?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q);
    }
    return true;
  });

  const openCount = tickets.filter((t: any) => t.status === "open" || t.status === "in_progress").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Centre de support</h1>
          <p className="text-xs text-[#94A3B8]">{openCount} tickets ouverts • {tickets.length} total</p>
        </div>
        <Headphones className="h-5 w-5 text-emerald-400" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(TICKET_STATUSES).map(([key, { label, color }]) => (
          <div key={key} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <span className="text-[11px] text-[#94A3B8] uppercase tracking-wider">{label}</span>
            <p className="text-xl font-bold text-[#F8FAFC] mt-1">{tickets.filter((t: any) => t.status === key).length}</p>
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
            placeholder="N° ticket, sujet, catégorie…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setStatusFilter("all")} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${statusFilter === "all" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"}`}>
            Tous
          </button>
          {Object.entries(TICKET_STATUSES).map(([key, { label }]) => (
            <button key={key} onClick={() => setStatusFilter(key)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${statusFilter === key ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"}`}>
              {label}
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
                {["Ticket", "Sujet", "Catégorie", "Statut", "Priorité", "Créé le", "Mis à jour"].map((h) => (
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
                <tr><td colSpan={7} className="text-center py-12 text-[#64748B]">Aucun ticket trouvé</td></tr>
              ) : (
                filtered.map((t: any) => {
                  const st = TICKET_STATUSES[t.status] || { label: t.status, color: "text-[#94A3B8]" };
                  return (
                    <tr key={t.id} onClick={() => setSelected(t)} className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#38BDF8]">{t.ticket_number || t.id?.slice(0, 8)}</td>
                      <td className="px-3 py-2.5 text-[#F8FAFC] font-medium max-w-[200px] truncate">{t.subject || "—"}</td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{t.category || "—"}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                      <td className="px-3 py-2.5 text-[#CBD5E1]">{t.priority || "normal"}</td>
                      <td className="px-3 py-2.5 text-[#94A3B8]">{t.created_at ? format(new Date(t.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}</td>
                      <td className="px-3 py-2.5 text-[#94A3B8]">{t.updated_at ? format(new Date(t.updated_at), "dd MMM HH:mm", { locale: fr }) : "—"}</td>
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
          <SheetHeader><SheetTitle className="text-[#F8FAFC]">Dossier ticket</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <div className="flex justify-between text-[12px]"><span className="text-[#94A3B8]">Ticket</span><span className="text-[#38BDF8] font-mono">{selected.ticket_number || selected.id?.slice(0, 8)}</span></div>
                <div className="flex justify-between text-[12px]"><span className="text-[#94A3B8]">Sujet</span><span className="text-[#F8FAFC] font-medium">{selected.subject}</span></div>
                <div className="flex justify-between text-[12px]"><span className="text-[#94A3B8]">Catégorie</span><span className="text-[#CBD5E1]">{selected.category || "—"}</span></div>
                <div className="flex justify-between text-[12px]"><span className="text-[#94A3B8]">Statut</span><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${TICKET_STATUSES[selected.status]?.color || ""}`}>{TICKET_STATUSES[selected.status]?.label || selected.status}</span></div>
              </div>

              {/* Messages timeline */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-3">Messages</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="text-[12px] text-[#64748B]">Aucun message</p>
                  ) : (
                    messages.map((m: any) => (
                      <div key={m.id} className={`rounded-md p-2.5 text-[12px] ${m.sender_type === "admin" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-[hsl(220,15%,14%)]"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium text-[#94A3B8] uppercase">{m.sender_type === "admin" ? "Agent" : "Client"}</span>
                          <span className="text-[10px] text-[#64748B]">{m.created_at ? format(new Date(m.created_at), "dd MMM HH:mm", { locale: fr }) : ""}</span>
                        </div>
                        <p className="text-[#CBD5E1]">{m.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions */}
              {selected.status !== "closed" && (
                <div className="flex gap-2">
                  <button className="flex-1 h-8 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors">
                    Résoudre
                  </button>
                  <button className="flex-1 h-8 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] border border-[hsl(220,15%,20%)] text-[12px] font-medium hover:text-[#F8FAFC] transition-colors">
                    Fermer
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
