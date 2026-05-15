import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Loader2 } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  contract: "Contrats",
  policy: "Politiques",
  guide: "Guides",
  form: "Formulaires",
  fiscal: "Fiscal",
  branding: "Image de marque",
  faq: "FAQ",
  other: "Autres",
};

export default function HubDocuments() {
  const { data, isLoading } = useQuery({
    queryKey: ["hub-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_documents")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const grouped: Record<string, any[]> = {};
  (data || []).forEach((d: any) => {
    (grouped[d.category] ||= []).push(d);
  });

  const isNew = (created: string) => {
    const days = (Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24);
    return days < 7;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat}>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            {CATEGORY_LABELS[cat] || cat}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((d) => (
              <div key={d.id} className="rounded-xl border border-border bg-card p-4 flex flex-col">
                <div className="flex items-start gap-3 mb-2">
                  <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-violet-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{d.title}</h3>
                    {isNew(d.created_at) && <span className="inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5">Nouveau</span>}
                  </div>
                </div>
                {d.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{d.description}</p>}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-[10px] text-muted-foreground font-mono">v{d.version}</span>
                  {d.file_url ? (
                    <a href={d.file_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-[12px] font-semibold text-violet-700 hover:underline min-h-[44px] sm:min-h-0 px-2">
                      <Download className="h-3.5 w-3.5" /> Télécharger
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">Bientôt disponible</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {(!data || data.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-16">Aucun document publié.</p>
      )}
    </div>
  );
}
