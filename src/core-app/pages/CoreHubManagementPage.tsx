/**
 * CoreHubManagementPage — Admin management of Nivra Source Hub.
 * Tabs: Annonces · Documents · Boutique · Formulaires · Calendrier · Notifications.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Trash2 } from "lucide-react";

const TABS = ["Annonces", "Documents", "Boutique", "Formulaires", "Calendrier", "Notifications push"] as const;
type Tab = typeof TABS[number];

export default function CoreHubManagementPage() {
  const [tab, setTab] = useState<Tab>("Annonces");

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-foreground tracking-tight">Nivra Source — Administration</h1>
        <p className="text-xs text-muted-foreground">Gérer le hub interne accessible aux portails Field, Employee, RH.</p>
      </div>

      <div className="border-b border-border mb-4 overflow-x-auto">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 ${tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "Annonces" && <AnnouncementsAdmin />}
      {tab === "Documents" && <DocumentsAdmin />}
      {tab === "Boutique" && <ItemsAdmin />}
      {tab === "Formulaires" && <p className="text-sm text-muted-foreground">Les formulaires sont actuellement des liens email. Ajoutez d'autres types via une mise à jour produit.</p>}
      {tab === "Calendrier" && <CalendarAdmin />}
      {tab === "Notifications push" && <p className="text-sm text-muted-foreground">À venir — diffusion push à toute l'équipe.</p>}
    </div>
  );
}

function AnnouncementsAdmin() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");

  const { data } = useQuery({
    queryKey: ["admin-hub-announcements"],
    queryFn: async () => (await supabase.from("hub_announcements").select("*").order("created_at", { ascending: false })).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hub_announcements").insert({ title, content, category, is_published: true, published_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Annonce publiée"); setTitle(""); setContent(""); qc.invalidateQueries({ queryKey: ["admin-hub-announcements"] }); qc.invalidateQueries({ queryKey: ["hub-announcements"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("hub_announcements").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Supprimée"); qc.invalidateQueries({ queryKey: ["admin-hub-announcements"] }); qc.invalidateQueries({ queryKey: ["hub-announcements"] }); },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Contenu" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {["general","pricing","system","contest","urgent","formation","policy"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => create.mutate()} disabled={!title || !content || create.isPending} className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Publier
        </button>
      </div>
      <div className="space-y-2">
        {(data || []).map((a: any) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{a.title}</div>
              <div className="text-[11px] text-muted-foreground">{a.category}</div>
            </div>
            <button onClick={() => remove.mutate(a.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 min-h-[44px] sm:min-h-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsAdmin() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("guide");
  const [fileUrl, setFileUrl] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-hub-docs"],
    queryFn: async () => (await supabase.from("hub_documents").select("*").order("created_at", { ascending: false })).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hub_documents").insert({ title, category, file_url: fileUrl, is_published: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Document publié"); setTitle(""); setFileUrl(""); qc.invalidateQueries({ queryKey: ["admin-hub-docs"] }); qc.invalidateQueries({ queryKey: ["hub-documents"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {["contract","policy","guide","form","fiscal","branding","faq","other"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="URL du fichier" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={() => create.mutate()} disabled={!title || create.isPending} className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {(data || []).map((d: any) => (
          <div key={d.id} className="rounded-xl border border-border bg-card p-3 text-sm">
            <div className="font-semibold">{d.title}</div>
            <div className="text-[11px] text-muted-foreground">{d.category} · v{d.version}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemsAdmin() {
  const { data } = useQuery({
    queryKey: ["admin-hub-items"],
    queryFn: async () => (await supabase.from("hub_store_items").select("*").order("name")).data || [],
  });
  const { data: orders } = useQuery({
    queryKey: ["admin-hub-orders"],
    queryFn: async () => (await supabase.from("hub_store_orders").select("*").order("created_at", { ascending: false }).limit(50)).data || [],
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2">Articles ({(data || []).length})</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(data || []).map((it: any) => (
            <div key={it.id} className="rounded-xl border border-border bg-card p-3 text-sm">
              <div className="font-semibold">{it.name}</div>
              <div className="text-[11px] text-muted-foreground">{it.category}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2">Commandes récentes ({(orders || []).length})</h2>
        <div className="space-y-1.5">
          {(orders || []).map((o: any) => (
            <div key={o.id} className="rounded-lg border border-border bg-card p-2.5 text-xs flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">{o.id.slice(0, 8)}</span>
              <span className="flex-1">qty: {o.quantity} · {o.size || "—"}</span>
              <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-semibold uppercase">{o.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarAdmin() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [type, setType] = useState("general");

  const { data } = useQuery({
    queryKey: ["admin-hub-cal"],
    queryFn: async () => (await supabase.from("hub_calendar_events").select("*").order("start_date", { ascending: true })).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hub_calendar_events").insert({ title, start_date: new Date(start).toISOString(), event_type: type });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Événement créé"); setTitle(""); setStart(""); qc.invalidateQueries({ queryKey: ["admin-hub-cal"] }); qc.invalidateQueries({ queryKey: ["hub-calendar"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {["general","formation","contest","meeting","deadline","maintenance","other"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => create.mutate()} disabled={!title || !start || create.isPending} className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
        </button>
      </div>
      <div className="space-y-2">
        {(data || []).map((ev: any) => (
          <div key={ev.id} className="rounded-xl border border-border bg-card p-3 text-sm flex items-center gap-3">
            <div className="font-semibold flex-1">{ev.title}</div>
            <div className="text-[11px] text-muted-foreground">{new Date(ev.start_date).toLocaleString("fr-CA")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
