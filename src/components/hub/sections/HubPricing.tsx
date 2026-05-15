/**
 * HubPricing — Pricing posts (hub_posts section='pricing').
 * Used for sharing pricing grids and PDFs with prospects.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BarChart3, Download, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";

export default function HubPricing({ portal }: { portal: "field" | "employee" | "hr" }) {
  const { data, isLoading } = useQuery({
    queryKey: ["hub-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_posts")
        .select("*")
        .eq("section", "pricing")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (!data?.length) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucune grille de prix publiée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-4xl">
      {data.map((p: any) => (
        <article key={p.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground">{p.title}</h3>
              {p.content && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{p.content}</p>}
              <div className="text-[11px] text-muted-foreground mt-2">
                Mis à jour : {p.published_at ? format(new Date(p.published_at), "d MMM yyyy") : "—"}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {p.document_urls?.map((u: string, i: number) => (
                <a key={i} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 text-white px-3 py-2 text-xs font-semibold hover:bg-violet-700 min-h-[44px] sm:min-h-0">
                  <Download className="h-3.5 w-3.5" /> PDF
                </a>
              ))}
              {portal === "field" && (
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/pricing/${p.id}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary min-h-[44px] sm:min-h-0"
                >
                  <LinkIcon className="h-3.5 w-3.5" /> Lien
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
