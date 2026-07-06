/**
 * MarketingAudiencesPage — Gestion des audiences (segments dynamiques).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";
import MarketingNav from "./MarketingNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Users, Loader2, Trash2, RefreshCw, Target } from "lucide-react";
import { toast } from "sonner";

interface Audience {
  id: string;
  name: string;
  description: string | null;
  rules: any;
  member_count: number;
  last_refreshed_at: string | null;
  is_archived: boolean;
  created_at: string;
}

const SOURCES = [
  { value: "crm_contacts", label: "Contacts CRM (228 prospects)" },
  { value: "clients", label: "Clients Nivra (avec compte)" },
  { value: "custom", label: "Contacts importés (CSV)" },
  { value: "all", label: "Tous (CRM + Clients + Imports)" },
];

export default function MarketingAudiencesPage() {
  const [rows, setRows] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    source: "crm_contacts",
    city: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mkt_audiences")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Audience[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const refreshCounts = async () => {
    toast.loading("Calcul des membres…", { id: "refresh" });
    for (const a of rows) {
      const count = await countMembers(a.rules);
      await supabase.from("mkt_audiences")
        .update({ member_count: count, last_refreshed_at: new Date().toISOString() })
        .eq("id", a.id);
    }
    toast.success("Audiences rafraîchies", { id: "refresh" });
    load();
  };

  const create = async () => {
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    const rules: any = { source: form.source, filters: {} };
    if (form.city.trim()) rules.filters.city = form.city.trim();
    if (form.tags.trim()) {
      rules.filters.tags = form.tags.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (form.source === "crm_contacts") rules.filters.marketing_consent = true;

    const count = await countMembers(rules);
    const { error } = await supabase.from("mkt_audiences").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      rules,
      member_count: count,
      last_refreshed_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Audience créée · ${count} membres`);
    setDialogOpen(false);
    setForm({ name: "", description: "", source: "crm_contacts", city: "", tags: "" });
    load();
  };

  const archive = async (id: string) => {
    if (!confirm("Archiver cette audience ?")) return;
    await supabase.from("mkt_audiences").update({ is_archived: true }).eq("id", id);
    load();
  };

  return (
    <MKPage
      title="Audiences"
      subtitle="Segments dynamiques pour cibler tes envois"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshCounts}>
            <RefreshCw className="h-4 w-4 mr-1" /> Rafraîchir
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-[#7C3AED] hover:bg-[#6D28D9]">
            <Plus className="h-4 w-4 mr-1" /> Nouvelle audience
          </Button>
        </div>
      }
    >
      <MarketingNav />

      <MKCard>
        <MKCardHeader title={`${rows.length} audiences`} />
        {loading ? (
          <div className="p-8 text-center text-[#888]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[#888]">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Aucune audience. Crée-en une pour commencer à envoyer.
          </div>
        ) : (
          <div className="divide-y divide-[#1E1E2E]">
            {rows.map(a => (
              <div key={a.id} className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white">{a.name}</div>
                    <span className="text-[10px] uppercase tracking-widest text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-0.5 rounded">
                      {a.rules?.source ?? "?"}
                    </span>
                  </div>
                  {a.description && <div className="text-xs text-[#888] mt-1">{a.description}</div>}
                  {a.rules?.filters?.city && (
                    <div className="text-[11px] text-[#888] mt-1">Ville: {a.rules.filters.city}</div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-white flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[#7C3AED]" />
                      {a.member_count}
                    </div>
                    <div className="text-[10px] text-[#888]">membres</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => archive(a.id)}>
                    <Trash2 className="h-4 w-4 text-[#EF4444]" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </MKCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle audience</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Prospects Montréal" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Filtre par ville (optionnel)</Label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Montréal" />
            </div>
            {form.source === "custom" && (
              <div>
                <Label>Tags (séparés par virgules)</Label>
                <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="promo, hiver2026" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={create} disabled={saving} className="bg-[#7C3AED] hover:bg-[#6D28D9]">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MKPage>
  );
}

async function countMembers(rules: any): Promise<number> {
  const source = rules?.source ?? "crm_contacts";
  const filters = rules?.filters ?? {};
  let total = 0;

  if (source === "crm_contacts" || source === "all") {
    let q = supabase.from("crm_contacts").select("id", { count: "exact", head: true })
      .not("email", "is", null).neq("email", "");
    if (filters.marketing_consent !== false) q = q.eq("marketing_consent", true);
    if (filters.city) q = q.ilike("city", `%${filters.city}%`);
    const { count } = await q;
    total += count ?? 0;
  }
  if (source === "clients" || source === "all") {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true })
      .not("email", "is", null).neq("email", "");
    total += count ?? 0;
  }
  if (source === "custom" || source === "all") {
    let q = supabase.from("mkt_contacts_custom").select("id", { count: "exact", head: true })
      .not("email", "is", null).eq("is_active", true);
    if (filters.tags?.length) q = q.overlaps("tags", filters.tags);
    const { count } = await q;
    total += count ?? 0;
  }
  return total;
}
