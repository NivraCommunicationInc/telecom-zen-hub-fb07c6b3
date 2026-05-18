/**
 * FieldProcedures — SOPs visible aux agents Field.
 * Groupé par catégorie, contenu Markdown rendu dans un modal.
 */
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react";

type Sop = {
  id: string;
  title_fr: string;
  category: string;
  content_fr: string;
  version: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  ventes: "Ventes",
  support: "Support",
  technique: "Technique",
  rh: "RH",
  facturation: "Facturation",
  securite: "Sécurité",
  incidents: "Incidents",
  general: "Général",
};

function renderMarkdown(md: string) {
  // Minimal safe markdown → HTML (headings, bold, italics, lists, code, paragraphs).
  const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const lines = escape(md).split(/\r?\n/);
  const html: string[] = [];
  let inList = false;
  for (const ln of lines) {
    const h = ln.match(/^(#{1,3})\s+(.*)$/);
    const li = ln.match(/^\s*[-*]\s+(.*)$/);
    if (h) {
      if (inList) { html.push("</ul>"); inList = false; }
      const lvl = h[1].length;
      html.push(`<h${lvl} class="font-semibold mt-4 mb-2 ${lvl === 1 ? "text-xl" : lvl === 2 ? "text-lg" : "text-base"}">${h[2]}</h${lvl}>`);
    } else if (li) {
      if (!inList) { html.push("<ul class='list-disc pl-5 space-y-1'>"); inList = true; }
      html.push(`<li>${li[1]}</li>`);
    } else if (ln.trim() === "") {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push("<br/>");
    } else {
      if (inList) { html.push("</ul>"); inList = false; }
      let p = ln
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code class='bg-gray-800 px-1 rounded'>$1</code>");
      html.push(`<p class="text-sm text-gray-200 leading-relaxed">${p}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  return html.join("");
}

export default function FieldProcedures() {
  const [sops, setSops] = useState<Sop[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Sop | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("sop_documents")
        .select("id, title_fr, category, content_fr, version")
        .eq("is_public_to_agents", true)
        .eq("is_active", true)
        .order("category")
        .order("title_fr");
      setSops((data as any) || []);
      const cats: Record<string, boolean> = {};
      (data || []).forEach((s: any) => { cats[s.category] = true; });
      setOpenCats(cats);
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, Sop[]> = {};
    for (const s of sops) (g[s.category] ||= []).push(s);
    return g;
  }, [sops]);

  return (
    <div className="p-4 md:p-6 space-y-4 internal-ui">
      <header>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Procédures (SOPs)
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Procédures opérationnelles partagées avec les agents Field.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-8 text-center text-gray-400">
            Aucune procédure publiée pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, items]) => (
            <Collapsible
              key={cat}
              open={openCats[cat]}
              onOpenChange={(v) => setOpenCats((s) => ({ ...s, [cat]: v }))}
            >
              <Card className="bg-gray-900 border-gray-800">
                <CollapsibleTrigger className="w-full text-left">
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      {openCats[cat] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {CATEGORY_LABEL[cat] || cat}
                      <span className="text-xs text-gray-400 font-normal">({items.length})</span>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 grid gap-2">
                    {items.map((sop) => (
                      <button
                        key={sop.id}
                        onClick={() => setSelected(sop)}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-left"
                      >
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm text-white flex-1">{sop.title_fr}</span>
                        <span className="text-xs text-gray-500">v{sop.version}</span>
                      </button>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-3xl bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{selected?.title_fr}</DialogTitle>
            <p className="text-xs text-gray-400">
              {selected && (CATEGORY_LABEL[selected.category] || selected.category)} · v{selected?.version}
            </p>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-3">
            {selected && (
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.content_fr) }} />
            )}
          </ScrollArea>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setSelected(null)}>Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
