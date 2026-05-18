/**
 * CoreSOPsPage — Internal SOPs & procedures library.
 */
import { useEffect, useState } from "react";
import { backendClient } from "@/integrations/backend/client";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const CATEGORIES = ["tous", "ventes", "support", "technique", "rh", "facturation", "securite", "incidents", "general"];

type SOP = {
  id: string; title_fr: string; title_en: string | null; category: string;
  content_fr: string; content_en: string | null; version: string;
  is_active: boolean; is_public_to_agents: boolean; updated_at: string;
};

export default function CoreSOPsPage() {
  const [sops, setSops] = useState<SOP[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("tous");
  const [open, setOpen] = useState<SOP | null>(null);
  const [edit, setEdit] = useState<Partial<SOP> | null>(null);

  const load = async () => {
    const { data } = await backendClient.from("sop_documents" as any).select("*").eq("is_active", true).order("category");
    setSops((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = sops.filter(s =>
    (cat === "tous" || s.category === cat) &&
    (!q || s.title_fr.toLowerCase().includes(q.toLowerCase()) || s.content_fr.toLowerCase().includes(q.toLowerCase()))
  );

  const save = async () => {
    if (!edit?.title_fr || !edit?.category || !edit?.content_fr) { toast.error("Champs requis manquants"); return; }
    const row = { title_fr: edit.title_fr, title_en: edit.title_en, category: edit.category,
      content_fr: edit.content_fr, content_en: edit.content_en, version: edit.version || "1.0",
      is_active: true, is_public_to_agents: !!edit.is_public_to_agents };
    const { error } = edit.id
      ? await backendClient.from("sop_documents" as any).update(row).eq("id", edit.id)
      : await backendClient.from("sop_documents" as any).insert(row);
    if (error) toast.error(error.message); else { toast.success("Enregistré"); setEdit(null); load(); }
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SOPs & Procédures</h1>
          <p className="text-slate-500 mt-1">Bibliothèque interne des procédures</p>
        </div>
        <Button onClick={() => setEdit({ category: "general", version: "1.0" })}><Plus className="w-4 h-4 mr-2" />Nouveau SOP</Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(c => (
            <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>{c}</Button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(s => (
          <Card key={s.id} className="cursor-pointer hover:shadow-md" onClick={() => setOpen(s)}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{s.category}</Badge>
                {s.is_public_to_agents && <Badge>Agents</Badge>}
                <span className="text-xs text-slate-500 ml-auto">v{s.version}</span>
              </div>
              <h3 className="font-semibold">{s.title_fr}</h3>
              <p className="text-xs text-slate-500">Mis à jour le {new Date(s.updated_at).toLocaleDateString("fr-CA")}</p>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-slate-500 col-span-full text-center py-12">Aucun SOP</p>}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{open?.title_fr}</DialogTitle></DialogHeader>
          {open && (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{open.content_fr}</ReactMarkdown>
              <div className="mt-4 pt-4 border-t flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEdit(open); setOpen(null); }}>Modifier</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Modifier SOP" : "Nouveau SOP"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Input placeholder="Titre (FR) *" value={edit.title_fr || ""} onChange={e => setEdit({ ...edit, title_fr: e.target.value })} />
              <Input placeholder="Titre (EN)" value={edit.title_en || ""} onChange={e => setEdit({ ...edit, title_en: e.target.value })} />
              <Select value={edit.category} onValueChange={v => setEdit({ ...edit, category: v })}>
                <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>{CATEGORIES.filter(c => c !== "tous").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea rows={12} placeholder="Contenu Markdown (FR) *" value={edit.content_fr || ""} onChange={e => setEdit({ ...edit, content_fr: e.target.value })} />
              <Textarea rows={6} placeholder="Contenu (EN)" value={edit.content_en || ""} onChange={e => setEdit({ ...edit, content_en: e.target.value })} />
              <Input placeholder="Version" value={edit.version || "1.0"} onChange={e => setEdit({ ...edit, version: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!edit.is_public_to_agents} onCheckedChange={c => setEdit({ ...edit, is_public_to_agents: c })} />
                Visible aux agents Field
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEdit(null)}>Annuler</Button>
                <Button onClick={save}>Enregistrer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
