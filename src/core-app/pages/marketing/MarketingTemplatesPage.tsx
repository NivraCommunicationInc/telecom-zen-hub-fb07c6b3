/**
 * MarketingTemplatesPage — Bibliothèque de templates email.
 * V1: éditeur HTML avec preview. V2 (à venir): éditeur drag-drop blocs.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";
import MarketingNav from "./MarketingNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Trash2, LayoutTemplate, Eye, Save } from "lucide-react";
import { toast } from "sonner";
import { OFFICIAL_MARKETING_BODY, MARKETING_EMAIL_SNIPPETS, normalizeOfficialMarketingBody, renderOfficialMarketingEmail } from "./officialMarketingEmail";

interface Template {
  id: string;
  name: string;
  description: string | null;
  html: string | null;
  category: string;
  is_system: boolean;
  created_at: string;
}

const STARTER_HTML = OFFICIAL_MARKETING_BODY;

export default function MarketingTemplatesPage() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("mkt_templates")
      .select("*").eq("is_archived", false).order("created_at", { ascending: false });
    setRows((data ?? []) as Template[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      html: normalizeOfficialMarketingBody(editing.html || STARTER_HTML),
      category: editing.category || "general",
    };
    const { error } = editing.id
      ? await supabase.from("mkt_templates").update(payload).eq("id", editing.id)
      : await supabase.from("mkt_templates").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template sauvegardé");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Archiver ce template ?")) return;
    await supabase.from("mkt_templates").update({ is_archived: true }).eq("id", id);
    load();
  };

  return (
    <MKPage
      title="Templates"
      subtitle="Modèles d'emails réutilisables — brand Nivra bleu"
      actions={
        <Button size="sm" onClick={() => setEditing({ name: "", html: STARTER_HTML, category: "general" })}
          className="rounded-full font-black">
          <Plus className="h-4 w-4 mr-1" /> Nouveau template
        </Button>
      }
    >
      <MarketingNav />

      <MKCard>
        <MKCardHeader title={`${rows.length} templates`} />
        {loading ? (
          <div className="p-8 text-center text-[#888]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[#888]">
            <LayoutTemplate className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Aucun template. Crée-en un pour tes campagnes.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {rows.map(t => (
              <div key={t.id} className="rounded-[10px] border border-[#1E1E2E] bg-[#0D0D1A] overflow-hidden">
                <div className="aspect-[4/3] bg-white overflow-hidden text-[8px]"
                     style={{ transform: "scale(1)" }}>
                  <iframe srcDoc={renderOfficialMarketingEmail({ title: t.name, bodyHtml: t.html || STARTER_HTML })} className="w-full h-full pointer-events-none border-0" />
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold text-white truncate">{t.name}</div>
                  {t.description && <div className="text-[11px] text-[#888] truncate mt-0.5">{t.description}</div>}
                  <div className="flex gap-1 mt-2">
                    <Button size="sm" variant="ghost" onClick={() => setPreview(renderOfficialMarketingEmail({ title: t.name, bodyHtml: t.html || STARTER_HTML }))}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                      Éditer
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => remove(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-[#EF4444]" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </MKCard>

      {editing && (
        <MKCard className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-black leading-tight text-foreground">{editing?.id ? "Éditer" : "Nouveau"} template</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
            <div className="space-y-3 overflow-y-auto pr-2">
              <div>
                <Label>Nom</Label>
                <Input value={editing?.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editing?.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <Label>HTML</Label>
                <div className="mb-2 flex flex-wrap gap-1">
                  {MARKETING_EMAIL_SNIPPETS.map((snippet) => (
                    <Button
                      key={snippet.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing({ ...editing, html: `${editing?.html ?? ""}\n${snippet.html}` })}
                    >
                      {snippet.label}
                    </Button>
                  ))}
                </div>
                <Textarea rows={20} className="font-mono text-xs"
                  value={editing?.html ?? ""} onChange={e => setEditing({ ...editing, html: e.target.value })} />
                <p className="text-[10px] text-[#888] mt-1">
                  Éditez seulement le corps du message. L'en-tête, le footer, le support et le désabonnement officiels sont ajoutés automatiquement. Variables: <code>{"{{first_name}}"}</code>, <code>{"{{full_name}}"}</code>, <code>{"{{city}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{unsubscribe_url}}"}</code>
                </p>
              </div>
            </div>
            <div className="min-h-[520px] overflow-hidden rounded-[10px] border border-[#1E1E2E] bg-white">
              <iframe srcDoc={renderOfficialMarketingEmail({ title: editing?.name || "Nivra Telecom", bodyHtml: editing?.html ?? STARTER_HTML })} className="h-full min-h-[520px] w-full border-0" title="preview" />
            </div>
          </div>
          <DialogFooter className="border-t border-border p-5">
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </MKCard>
      )}

      {preview && (
        <MKCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-black leading-tight text-foreground">Aperçu</h2>
            <Button variant="outline" size="sm" onClick={() => setPreview(null)}>Fermer</Button>
          </div>
          <iframe srcDoc={preview ?? ""} className="h-[720px] w-full border-0 bg-white" />
        </MKCard>
      )}
    </MKPage>
  );
}
