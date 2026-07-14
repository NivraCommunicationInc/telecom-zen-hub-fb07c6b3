/**
 * TechTickets — Tickets terrain (SAV, équipement, escalade).
 */
import { useEffect, useState } from "react";
import { Plus, AlertTriangle, Package, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TechHeader from "../components/TechHeader";

const CATEGORIES = [
  { id: "equipment", label: "Équipement défectueux", icon: Package },
  { id: "client", label: "Client absent / accès", icon: User },
  { id: "escalation", label: "Escalade urgente", icon: AlertTriangle },
];

export default function TechTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("equipment");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("internal_tickets")
      .select("id, ticket_number, title, category, priority, status, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setTickets(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée");
      const { error } = await supabase.from("internal_tickets").insert({
        title: title.trim(),
        description: desc.trim() || null,
        category,
        priority: category === "escalation" ? "high" : "normal",
        status: "open",
        created_by: user.id,
        source: "tech_portal",
      } as any);
      if (error) throw error;
      toast.success("Ticket créé");
      setShowForm(false); setTitle(""); setDesc(""); setCategory("equipment");
      load();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TechHeader title="Tickets" subtitle="Support terrain" right={
        <button
          onClick={() => setShowForm(true)}
          className="h-10 w-10 rounded-md flex items-center justify-center"
          style={{ background: "#fbbf24", color: "#18181b" }}
          aria-label="Créer un ticket"
        >
          <Plus className="h-5 w-5" strokeWidth={3} />
        </button>
      } />

      {showForm && (
        <section className="px-4 mt-4">
          <div className="rounded-2xl bg-white border-2 border-amber-400 p-4 space-y-3">
            <h2 className="text-[15px] font-black italic uppercase text-zinc-900">Nouveau ticket</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className="p-2 rounded-lg flex flex-col items-center gap-1 text-center"
                    style={{
                      background: active ? "#18181b" : "#f4f4f5",
                      color: active ? "#fbbf24" : "#52525b",
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[9px] font-black italic uppercase leading-tight">{c.label}</span>
                  </button>
                );
              })}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du ticket"
              className="w-full h-11 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-[14px]"
            />
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Description (optionnel)"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-[14px]"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 h-11 rounded-lg bg-zinc-100 font-black italic uppercase text-[12px]">Annuler</button>
              <button onClick={submit} disabled={saving} className="flex-1 h-11 rounded-lg font-black italic uppercase text-[12px]" style={{ background: "#fbbf24", color: "#18181b" }}>
                {saving ? "…" : "Créer"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="px-4 mt-4 mb-8">
        <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Mes tickets</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
        ) : tickets.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-6">Aucun ticket ouvert.</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-white border border-zinc-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black italic uppercase tracking-wider text-zinc-500">#{t.ticket_number ?? t.id.slice(0, 8)}</span>
                  <span
                    className="text-[9px] font-black italic uppercase px-2 py-0.5 rounded-full"
                    style={{
                      background: t.status === "open" ? "#fbbf24" : t.status === "closed" ? "#e4e4e7" : "#18181b",
                      color: t.status === "closed" ? "#52525b" : t.status === "open" ? "#18181b" : "#fbbf24",
                    }}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="mt-1 text-[14px] font-black italic uppercase text-zinc-900">{t.title}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{new Date(t.created_at).toLocaleString("fr-CA")}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
